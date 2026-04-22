/**
 * Boc Prisma query voi retry logic cho Neon cold-start / connection drop.
 *
 * Retry chi kich hoat khi gap connection-level errors (P1001, P1017, ...).
 * Business errors (unique constraint, foreign key, ...) KHONG duoc retry.
 */

// Ma loi Prisma lien quan den ket noi
const RETRYABLE_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
  'P2024', // Timed out fetching connection from pool
]);

// Tu khoa trong message khi khong co ma Prisma cu the
const RETRYABLE_MESSAGES = [
  'Closed',
  'Connection refused',
  'Connection reset',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'socket hang up',
  'connection pool',
];

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const anyErr = err as any;
  if (anyErr.code && RETRYABLE_CODES.has(anyErr.code)) return true;
  const msg = err.message || '';
  return RETRYABLE_MESSAGES.some((kw) => msg.includes(kw));
}

/**
 * Retry toi da maxRetries lan voi exponential backoff.
 * Warn log khi retry duoc kich hoat (khong throw, chi log).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isRetryableError(err) || attempt === maxRetries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt); // 500ms, 1000ms
      console.warn(
        `[withRetry] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms: ${(err as Error).message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
