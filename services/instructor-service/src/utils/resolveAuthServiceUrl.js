const fs = require('fs');

/**
 * URL gọi trực tiếp auth-service (PATCH /users/role).
 * Hostname `auth-service` chỉ resolve trong Docker network khi có service trùng tên;
 * khi chạy local hoặc auth chạy trên máy host thì cần localhost / host.docker.internal.
 */
function normalizeAuthServiceUrl() {
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

    let replacement;
    if (inDocker) {
      replacement = `http://host.docker.internal:${port}`;
    } else {
      replacement = `http://127.0.0.1:${port}`;
    }

    // eslint-disable-next-line no-console
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

function getAuthServiceBaseUrl() {
  return AUTH_SERVICE_BASE_URL;
}

module.exports = {
  getAuthServiceBaseUrl,
  normalizeAuthServiceUrl,
};
