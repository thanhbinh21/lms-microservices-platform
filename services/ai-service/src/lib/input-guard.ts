/**
 * Input guard: sanitize + detect prompt injection.
 */
import { logger } from './logger.js';

// Patterns that may indicate prompt injection attempts
const INJECTION_PATTERNS = [
  /^(system|prompt|instruction|ignore|disregard|forget)/i,
  /\{\{.*?\}\}/, // template literal injection
  /<script/i,
  /javascript:/i,
  /data:/i,
  /on\w+\s*=/i, // event handler injection
];

// Maximum message length
const MAX_MESSAGE_LENGTH = 2000;

export interface InputGuardResult {
  allowed: boolean;
  sanitized: string;
  reason?: string;
}

export function guardInput(raw: string, traceId: string): InputGuardResult {
  if (!raw || typeof raw !== 'string') {
    return { allowed: false, sanitized: '', reason: 'Message is empty' };
  }

  const trimmed = raw.trim();

  if (trimmed.length === 0) {
    return { allowed: false, sanitized: '', reason: 'Message is empty' };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { allowed: false, sanitized: '', reason: `Message exceeds ${MAX_MESSAGE_LENGTH} characters` };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      logger.warn({ pattern: pattern.toString(), traceId }, 'Prompt injection pattern detected');
      return {
        allowed: false,
        sanitized: trimmed,
        reason: 'Message contains potentially unsafe content',
      };
    }
  }

  // Basic sanitization: escape control characters
  const sanitized = trimmed
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  return { allowed: true, sanitized };
}

/**
 * Output filter: redact PII from LLM response.
 */
export function redactPII(text: string): string {
  // Redact phone numbers (Vietnamese format)
  let redacted = text.replace(/\b0\d{9,10}\b/g, '[SỐ ĐIỆN THOẠI]');

  // Redact email addresses
  redacted = redacted.replace(/\b[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/g, '[EMAIL]');

  // Redact ID numbers (CMND/CCCD format)
  redacted = redacted.replace(/\b\d{9,12}\b/g, '[SỐ ID]');

  // Redact credit card-like patterns
  redacted = redacted.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[SỐ THẺ]');

  return redacted;
}
