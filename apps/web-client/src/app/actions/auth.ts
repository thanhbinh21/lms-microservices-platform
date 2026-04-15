'use server';

import { cookies } from 'next/headers';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/schemas/auth.schema';

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:8000';
const AUTH_PREFIX = process.env.NEXT_PUBLIC_AUTH_PREFIX || '/auth';

interface AuthResponse {
  success: boolean;
  code?: number;
  message?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  };
  accessToken?: string;
}

type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  exp?: number;
}

function normalizeRole(role?: string | null): UserRole {
  if (!role) return 'STUDENT';
  const normalized = role.toUpperCase();
  if (normalized === 'INSTRUCTOR') return 'INSTRUCTOR';
  if (normalized === 'ADMIN') return 'ADMIN';
  return 'STUDENT';
}

function normalizeUserFromApi(user: {
  id: string;
  email: string;
  name: string;
  role?: string;
}): NonNullable<AuthResponse['user']> {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizeRole(user.role ?? 'STUDENT'),
  };
}

function decodeTokenPayload(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}

async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete('accessToken');
  cookieStore.delete('refreshToken');
  cookieStore.delete('userName');
}

async function writeAuthCookies(params: { accessToken?: string; refreshToken?: string; userName?: string }) {
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

  if (params.userName) {
    // Luu ten de hydrate UI sau refresh token ma khong can goi them API profile.
    cookieStore.set('userName', params.userName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    });
  }
}

async function refreshWithToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
  const response = await fetch(`${GATEWAY_URL}${AUTH_PREFIX}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  const result = await response.json();
  if (!response.ok || !result.success) return null;

  const nextAccessToken = result?.data?.accessToken as string | undefined;
  const nextRefreshToken = result?.data?.refreshToken as string | undefined;
  if (!nextAccessToken || !nextRefreshToken) return null;

  return { accessToken: nextAccessToken, refreshToken: nextRefreshToken };
}

export async function loginAction(data: LoginInput): Promise<AuthResponse> {
  try {
    // Validate input
    const validated = loginSchema.parse(data);

    // Goi qua Gateway de dong nhat data flow toan he thong
    const response = await fetch(`${GATEWAY_URL}${AUTH_PREFIX}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validated),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        message: result.message || 'Login failed',
      };
    }

    // Extract data from backend response structure
    const { user, accessToken, refreshToken } = result.data;

    await writeAuthCookies({ accessToken, refreshToken, userName: user?.name });

    return {
      success: true,
      code: 200,
      user: normalizeUserFromApi(user),
      accessToken,
    };
  } catch (error) {
    console.error('Login action error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

export async function registerAction(data: RegisterInput): Promise<AuthResponse> {
  try {
    // Validate input
    const validated = registerSchema.parse(data);

    // Remove confirmPassword before sending to API
    const { confirmPassword, ...registerData } = validated;

    // Goi qua Gateway de dong nhat data flow toan he thong
    const response = await fetch(`${GATEWAY_URL}${AUTH_PREFIX}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(registerData),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        message: result.message || 'Registration failed',
      };
    }

    // Extract data from backend response structure
    const { user, accessToken, refreshToken } = result.data;

    await writeAuthCookies({ accessToken, refreshToken, userName: user?.name });

    return {
      success: true,
      code: 200,
      user: normalizeUserFromApi(user),
      accessToken,
    };
  } catch (error) {
    console.error('Register action error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An error occurred',
    };
  }
}

export async function restoreSessionAction(): Promise<AuthResponse> {
  try {
    const cookieStore = await cookies();
    const currentAccessToken = cookieStore.get('accessToken')?.value;
    const currentRefreshToken = cookieStore.get('refreshToken')?.value;
    const savedUserName = cookieStore.get('userName')?.value;

    if (!currentAccessToken && !currentRefreshToken) {
      return { success: false, code: 401, message: 'Khong tim thay phien dang nhap' };
    }

    let accessToken = currentAccessToken;

    // Kiem tra access token con hop le khong truoc khi quyet dinh refresh.
    // Chi goi refresh khi access token thuc su het han hoac khong co,
    // tranh race condition khi nhieu tab/request dong thoi lam mat refresh token.
    let needsRefresh = false;

    if (accessToken) {
      const payload = decodeTokenPayload(accessToken);
      if (!payload || (payload.exp && payload.exp * 1000 <= Date.now())) {
        needsRefresh = true;
      }
    } else {
      needsRefresh = true;
    }

    if (needsRefresh && currentRefreshToken) {
      const refreshed = await refreshWithToken(currentRefreshToken);
      if (refreshed) {
        accessToken = refreshed.accessToken;
        await writeAuthCookies({ accessToken: refreshed.accessToken, refreshToken: refreshed.refreshToken });
      } else {
        // Refresh that bai — token cu da bi thu hoi hoac het han
        await clearAuthCookies();
        return { success: false, code: 401, message: 'Phien dang nhap da het han. Vui long dang nhap lai.' };
      }
    }

    if (!accessToken) {
      await clearAuthCookies();
      return { success: false, code: 401, message: 'Phien dang nhap da het han' };
    }

    const payload = decodeTokenPayload(accessToken);
    if (!payload) {
      await clearAuthCookies();
      return { success: false, code: 401, message: 'Token khong hop le' };
    }

    const isExpired = payload.exp ? payload.exp * 1000 <= Date.now() : true;
    if (isExpired) {
      await clearAuthCookies();
      return { success: false, code: 401, message: 'Phien dang nhap da het han' };
    }

    const userName = savedUserName?.trim() || payload.email.split('@')[0] || 'User';

    return {
      success: true,
      code: 200,
      accessToken,
      user: {
        id: payload.userId,
        email: payload.email,
        name: userName,
        role: normalizeRole(payload.role),
      },
    };
  } catch (error) {
    console.error('Restore session error:', error);
    await clearAuthCookies();
    return {
      success: false,
      code: 500,
      message: 'Khong the khoi phuc phien dang nhap',
    };
  }
}

export async function logoutAction(): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;

    if (accessToken) {
      // Goi qua Gateway de dong nhat data flow toan he thong
      await fetch(`${GATEWAY_URL}${AUTH_PREFIX}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    }

    await clearAuthCookies();

    return { success: true };
  } catch (error) {
    console.error('Logout action error:', error);
    return { success: false };
  }
}
