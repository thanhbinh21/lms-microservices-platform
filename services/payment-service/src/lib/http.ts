import { logger } from '@lms/logger';

type FetchInput = Parameters<typeof fetch>[0];
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

const BREAKER_FAILURE_THRESHOLD = Number(process.env.COURSE_CIRCUIT_FAILURE_THRESHOLD || 3);
const BREAKER_RESET_MS = Number(process.env.COURSE_CIRCUIT_RESET_MS || 10_000);

let courseCircuitState: CircuitState = 'CLOSED';
let courseCircuitFailures = 0;
let courseCircuitOpenedAt = 0;

export async function fetchWithTimeout(input: FetchInput, init: RequestInit = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function openCourseCircuit(reason: string): void {
  courseCircuitState = 'OPEN';
  courseCircuitOpenedAt = Date.now();
  logger.warn({ event: 'circuit.open', target: 'course-service', reason }, 'Course service circuit opened');
}

function recordCourseFailure(reason: string): void {
  courseCircuitFailures += 1;
  if (courseCircuitState === 'HALF_OPEN' || courseCircuitFailures >= BREAKER_FAILURE_THRESHOLD) {
    openCourseCircuit(reason);
  }
}

function closeCourseCircuit(): void {
  if (courseCircuitState !== 'CLOSED') {
    logger.info({ event: 'circuit.close', target: 'course-service' }, 'Course service circuit closed');
  }
  courseCircuitState = 'CLOSED';
  courseCircuitFailures = 0;
}

// Payment fail-fast de loi Course Service khong giu request tao order qua lau.
export async function fetchCourseWithCircuitBreaker(
  input: FetchInput,
  init: RequestInit = {},
  timeoutMs = Number(process.env.INTERNAL_HTTP_TIMEOUT_MS || 2_000),
): Promise<Response> {
  if (courseCircuitState === 'OPEN') {
    if (Date.now() - courseCircuitOpenedAt < BREAKER_RESET_MS) {
      logger.warn({ event: 'circuit.reject', target: 'course-service' }, 'Course service circuit rejected request');
      throw new Error('Course Service circuit is open');
    }
    courseCircuitState = 'HALF_OPEN';
    logger.info({ event: 'circuit.half_open', target: 'course-service' }, 'Course service circuit half-open');
  }

  try {
    const response = await fetchWithTimeout(input, init, timeoutMs);
    if (response.status >= 500) {
      recordCourseFailure(`HTTP ${response.status}`);
    } else {
      closeCourseCircuit();
    }
    return response;
  } catch (err) {
    recordCourseFailure(err instanceof Error ? err.message : String(err));
    throw err;
  }
}
