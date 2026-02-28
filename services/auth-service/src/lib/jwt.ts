import jwt, { SignOptions } from 'jsonwebtoken';
import { logger } from '@lms/logger';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  type?: 'access' | 'refresh';
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// Thoi gian het han mac dinh
const DEFAULT_ACCESS_EXPIRY = '15m';
const DEFAULT_REFRESH_EXPIRY = '7d';

/** Tao access token - het han ngan, dung cho API request */
export function generateAccessToken(
  payload: JwtPayload,
  secret: string,
  expiresIn?: string,
): string {
  const options: SignOptions = {
    expiresIn: (expiresIn || process.env.JWT_ACCESS_EXPIRY || DEFAULT_ACCESS_EXPIRY) as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  const token = jwt.sign({ ...payload, type: 'access' }, secret, options);
  logger.debug({ userId: payload.userId }, 'Access token da tao');
  return token;
}

/** Tao refresh token - het han dai, dung de lam moi access token */
export function generateRefreshToken(
  payload: JwtPayload,
  secret: string,
  expiresIn?: string,
): string {
  const options: SignOptions = {
    expiresIn: (expiresIn || process.env.JWT_REFRESH_EXPIRY || DEFAULT_REFRESH_EXPIRY) as SignOptions['expiresIn'],
    algorithm: 'HS256',
  };
  const token = jwt.sign({ ...payload, type: 'refresh' }, secret, options);
  logger.debug({ userId: payload.userId }, 'Refresh token da tao');
  return token;
}

/** Tao cap access + refresh token */
export function generateTokenPair(payload: JwtPayload, secret: string): TokenPair {
  return {
    accessToken: generateAccessToken(payload, secret),
    refreshToken: generateRefreshToken(payload, secret),
  };
}

/** Xac thuc token - tra ve payload hoac null neu khong hop le */
export function verifyToken(token: string, secret: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    });
    return decoded as JwtPayload;
  } catch (err) {
    logger.warn({ err }, 'Xac thuc token that bai');
    return null;
  }
}
