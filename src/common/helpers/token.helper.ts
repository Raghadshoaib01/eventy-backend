import { sign, verify } from 'jsonwebtoken';
import {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES,
  JWT_REFRESH_EXPIRES,
} from '../constants/jwt.constants';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
}

/**
 * توليد Access Token
 */
export function signAccessToken(payload: JwtPayload): string {
  return sign(payload, JWT_ACCESS_SECRET, { expiresIn: JWT_ACCESS_EXPIRES });
}

/**
 * توليد Refresh Token
 */
export function signRefreshToken(payload: JwtPayload): string {
  return sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES });
}

/**
 * التحقق من Access Token
 */
export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, JWT_ACCESS_SECRET) as JwtPayload;
}

/**
 * التحقق من Refresh Token
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, JWT_REFRESH_SECRET) as JwtPayload;
}
