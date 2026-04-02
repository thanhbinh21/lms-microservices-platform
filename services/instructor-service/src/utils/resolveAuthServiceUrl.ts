import fs from 'fs';

/**
 * URL gọi trực tiếp auth-service (PATCH /users/role).
 * Hostname `auth-service` chỉ resolve trong Docker network khi có service trùng tên;
 * khi chạy local hoặc auth chạy trên máy host thì cần localhost / host.docker.internal.
 */
export function normalizeAuthServiceUrl(): string {
  let raw = process.env.AUTH_SERVICE_URL?.trim();
  if (!raw) {
    return 'http://127.0.0.1:3101';
  }

  raw = raw.replace(/\/$/, '');

  try {
    const u = new URL(raw);
    if (u.hostname !== 'auth-service') {
      return raw;
    }

    const inDocker = fs.existsSync('/.dockerenv');
    const port = u.port || '3101';

    const replacement = inDocker
      ? `http://host.docker.internal:${port}`
      : `http://127.0.0.1:${port}`;

    console.warn(
      `[instructor-service] AUTH_SERVICE_URL dùng hostname "auth-service" (không resolve được ngoài mạng Docker). ` +
        `Đã đổi thành ${replacement}. Đặt AUTH_SERVICE_URL rõ ràng trong .env để tránh cảnh báo này.`,
    );

    return replacement;
  } catch {
    return raw;
  }
}

const AUTH_SERVICE_BASE_URL = normalizeAuthServiceUrl();

export function getAuthServiceBaseUrl(): string {
  return AUTH_SERVICE_BASE_URL;
}
