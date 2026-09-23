import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import type { Role } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors/app-error.js';

const ISSUER = 'unimonitor';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
    issuer: ISSUER,
  });

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER });

    if (typeof decoded === 'string' || !decoded.sub) {
      throw new UnauthorizedError('Token de acesso malformado');
    }

    return {
      sub: decoded.sub,
      email: String(decoded['email'] ?? ''),
      role: decoded['role'] as Role,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token de acesso expirado');
    }
    throw new UnauthorizedError('Token de acesso invalido');
  }
};

/**
 * O refresh token e um valor opaco aleatorio, nao um JWT: assim ele pode ser
 * revogado no banco a qualquer momento, o que um JWT autocontido nao permite.
 */
export const generateRefreshToken = (): string => randomBytes(48).toString('base64url');

/**
 * Guardamos apenas o HMAC do refresh token. O segredo funciona como pepper,
 * de forma que um vazamento da tabela nao permita reconstruir tokens validos.
 */
export const hashRefreshToken = (token: string): string =>
  createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');

export const refreshTokenMatches = (token: string, storedHash: string): boolean => {
  const computed = Buffer.from(hashRefreshToken(token));
  const stored = Buffer.from(storedHash);

  return computed.length === stored.length && timingSafeEqual(computed, stored);
};
