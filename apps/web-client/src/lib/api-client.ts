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

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
    secure: isProduction,
    sameSite: isProduction ? ('none' as const) : ('lax' as const),
    path: '/',
  };
}

function setAuthCookie(cookieStore: CookieStore, name: string, value: string, maxAge: number) {
  const options = getAuthCookieOptions();
  if (options.domain) {
    cookieStore.set(name, '', { ...options, domain: undefined, maxAge: 0 });
  }
  cookieStore.set(name, value, { ...options, httpOnly: true, maxAge });
}

function clearAuthCookie(cookieStore: CookieStore, name: string) {
  const options = getAuthCookieOptions();
  cookieStore.set(name, '', { ...options, maxAge: 0 });
  if (options.domain) {
    cookieStore.set(name, '', { ...options, domain: undefined, maxAge: 0 });
  }
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
    setAuthCookie(cookieStore, 'accessToken', params.accessToken, 15 * 60);
  }
  if (params.refreshToken) {
    setAuthCookie(cookieStore, 'refreshToken', params.refreshToken, 7 * 24 * 60 * 60);
  }
}

async function clearAuthCookies() {
  const cookieStore = await cookies();
  clearAuthCookie(cookieStore, 'accessToken');
  clearAuthCookie(cookieStore, 'refreshToken');
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

    // Concurrent refresh: tab khac da rotate token roi — doc token moi tu cookie va retry 1 lan.
    if (response.status === 409) {
      const newRefreshToken = cookieStore.get('refreshToken')?.value;
      if (newRefreshToken && newRefreshToken !== refreshToken) {
        return refreshAccessToken();
      }
      await clearAuthCookies();
      return undefined;
    }

    if (!response.ok || !result.success) {
      if (response.status === 401 || response.status === 403) {
        await clearAuthCookies();
      }
      return undefined;
    }

    const nextAccessToken = result?.data?.accessToken as string | undefined;
    const nextRefreshToken = result?.data?.refreshToken as string | undefined;
    if (!nextAccessToken || !nextRefreshToken) {
      await clearAuthCookies();
      return undefined;
    }

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
      if (!decoded?.userId) {
        return { success: false, code: 401, message: 'Invalid access token payload.', data: null, trace_id: '' };
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
