import { cookies } from 'next/headers';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';
const AUTH_PREFIX = process.env.NEXT_PUBLIC_AUTH_PREFIX || '/auth';

export interface ApiResponse<T> {
  success: boolean;
  code: number;
  message: string;
  data: T | null;
  trace_id: string;
}

interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
}

async function getAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get('accessToken')?.value;
}

function decodeAccessToken(token: string): AccessTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as AccessTokenPayload;
  } catch {
    return null;
  }
}

async function writeAuthCookies(params: { accessToken?: string; refreshToken?: string }) {
  const cookieStore = await cookies();
  if (params.accessToken) {
    cookieStore.set('accessToken', params.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 15 * 60,
      path: '/',
    });
  }
  if (params.refreshToken) {
    cookieStore.set('refreshToken', params.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  }
}

async function refreshAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get('refreshToken')?.value;
  if (!refreshToken) return undefined;

  try {
    const response = await fetch(`${GATEWAY_URL}${AUTH_PREFIX}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });

    const result = await response.json();
    if (!response.ok || !result.success) return undefined;

    const nextAccessToken = result?.data?.accessToken as string | undefined;
    const nextRefreshToken = result?.data?.refreshToken as string | undefined;
    if (!nextAccessToken || !nextRefreshToken) return undefined;

    await writeAuthCookies({ accessToken: nextAccessToken, refreshToken: nextRefreshToken });
    return nextAccessToken;
  } catch {
    // Khi Gateway/Auth tam thoi khong reachable, tra ve undefined de caller xu ly mem.
    return undefined;
  }
}

export async function callApi<T>(
  path: string,
  init?: RequestInit,
  requireAuth = false,
  baseUrlOverride?: string,
): Promise<ApiResponse<T>> {
  const baseUrl = (baseUrlOverride ?? GATEWAY_URL).replace(/\/$/, '');
  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');

  if (requireAuth) {
    let token = await getAccessToken();
    if (!token) token = await refreshAccessToken();
    if (!token) {
      return { success: false, code: 401, message: 'Session expired. Please login again.', data: null, trace_id: '' };
    }

    const decoded = decodeAccessToken(token);
    if (!decoded?.userId) {
      return { success: false, code: 401, message: 'Invalid access token payload.', data: null, trace_id: '' };
    }

    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-user-id', decoded.userId);
    headers.set('x-user-role', (decoded.role || '').toLowerCase());
    if (decoded.email) headers.set('x-user-email', decoded.email);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: 'no-store' });
  } catch {
    return {
      success: false,
      code: 503,
      message: 'Service temporarily unavailable. Please try again.',
      data: null,
      trace_id: '',
    };
  }

  if (requireAuth && response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      const decoded = decodeAccessToken(refreshedToken);
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      if (decoded?.userId) {
        headers.set('x-user-id', decoded.userId);
        headers.set('x-user-role', (decoded.role || '').toLowerCase());
      }
      try {
        response = await fetch(`${baseUrl}${path}`, { ...init, headers, cache: 'no-store' });
      } catch {
        return {
          success: false,
          code: 503,
          message: 'Service temporarily unavailable. Please try again.',
          data: null,
          trace_id: '',
        };
      }
    }
  }

  const text = await response.text();
  try {
    return JSON.parse(text) as ApiResponse<T>;
  } catch {
    return { success: false, code: response.status, message: text.slice(0, 200) || 'Invalid response from server', data: null, trace_id: '' };
  }
}
