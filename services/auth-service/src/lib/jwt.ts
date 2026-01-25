import jwt, { SignOptions } from 'jsonwebtoken';
import { logger } from '@lms/logger';

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate JWT access token
 * @param payload - User data to embed in token
 * @param secret - JWT secret key
 * @param expiresIn - Token expiry (default: 15m)
 */
export function generateAccessToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: string = '15m'
): string {
  const options: SignOptions = {
    // @ts-ignore - jsonwebtoken accepts string for expiresIn despite type definition
    expiresIn,
    algorithm: 'HS256',
  };
  const token = jwt.sign(payload, secret, options);

  logger.debug({ userId: payload.userId }, 'Access token generated');
  return token;
}

/**
 * Generate JWT refresh token
 * @param payload - User data to embed in token
 * @param secret - JWT secret key
 * @param expiresIn - Token expiry (default: 7d)
 */
export function generateRefreshToken(
  payload: JwtPayload,
  secret: string,
  expiresIn: string = '7d'
): string {
  const options: SignOptions = {
    // @ts-ignore - jsonwebtoken accepts string for expiresIn despite type definition
    expiresIn,
    algorithm: 'HS256',
  };
  const token = jwt.sign(payload, secret, options);

  logger.debug({ userId: payload.userId }, 'Refresh token generated');
  return token;
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: JwtPayload, secret: string): TokenPair {
  return {
    accessToken: generateAccessToken(payload, secret),
    refreshToken: generateRefreshToken(payload, secret),
  };
}

/**
 * Verify JWT token
 * @param token - JWT token string
 * @param secret - JWT secret key
 * @returns Decoded payload or null if invalid
 */
export function verifyToken(token: string, secret: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ['HS256'],
    });

    return decoded as JwtPayload;
  } catch (err) {
    logger.warn({ err }, 'Token verification failed');
    return null;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token);
    return decoded as JwtPayload;
  } catch (err) {
    logger.warn({ err }, 'Token decode failed');
    return null;
  }
}
