'use server';

import { cookies } from 'next/headers';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@/lib/schemas/auth.schema';

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';
const AUTH_PREFIX = process.env.NEXT_PUBLIC_AUTH_PREFIX || '/auth';

interface AuthResponse {
  success: boolean;
  message?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';
  };
  accessToken?: string;
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

    // Set HTTP-only cookies for tokens
    const cookieStore = await cookies();
    
    if (accessToken) {
      cookieStore.set('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });
    }

    if (refreshToken) {
      cookieStore.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
    }

    return {
      success: true,
      user,
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

    // Set HTTP-only cookies for tokens
    const cookieStore = await cookies();
    
    if (accessToken) {
      cookieStore.set('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60, // 15 minutes
        path: '/',
      });
    }

    if (refreshToken) {
      cookieStore.set('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });
    }

    return {
      success: true,
      user,
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

    // Clear cookies
    cookieStore.delete('accessToken');
    cookieStore.delete('refreshToken');

    return { success: true };
  } catch (error) {
    console.error('Logout action error:', error);
    return { success: false };
  }
}
