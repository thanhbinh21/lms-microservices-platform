function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMessage(input: unknown): string | null {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      const parsed = tryParseJson(trimmed);
      return extractMessage(parsed) ?? trimmed;
    }

    return trimmed;
  }

  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    const direct = record.message ?? record.error ?? record.detail;
    const nested = direct ? extractMessage(direct) : null;
    if (nested) return nested;
  }

  return null;
}

export function mapUiErrorMessage(raw: unknown, fallback: string): string {
  const message = extractMessage(raw);
  if (!message) return fallback;

  const lower = message.toLowerCase();
  if (lower.includes('invalid or expired refresh token') || lower.includes('refresh token has expired')) {
    return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
  }
  if (lower.includes('missing access token') || lower.includes('unauthorized')) {
    return 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.';
  }
  if (lower.includes('route not found')) {
    return 'Hệ thống đang bận, vui lòng thử lại sau.';
  }

  return message;
}

export function mapUiSuccessMessage(raw: unknown, fallback: string): string {
  return extractMessage(raw) ?? fallback;
}