import type { CookieOptions, Response } from 'express';

import { env } from '../../config/env.js';
import { durationToMs } from '../../shared/utils/duration.js';

/**
 * httpOnly impede leitura por JavaScript (mitiga XSS) e sameSite=lax evita que
 * o cookie viaje em requisicoes cross-site (mitiga CSRF). Em producao o cookie
 * so trafega por HTTPS.
 */
const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  path: '/',
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});

export const setAuthCookies = (
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void => {
  setAccessCookie(res, tokens.accessToken);

  // O refresh token so e enviado para as rotas de sessao, reduzindo a
  // superficie de exposicao em relacao a manda-lo em toda requisicao.
  res.cookie(env.COOKIE_REFRESH_NAME, tokens.refreshToken, {
    ...baseOptions(),
    path: '/api/v1/auth',
    maxAge: durationToMs(env.JWT_REFRESH_TTL),
  });
};

export const setAccessCookie = (res: Response, accessToken: string): void => {
  res.cookie(env.COOKIE_ACCESS_NAME, accessToken, {
    ...baseOptions(),
    maxAge: durationToMs(env.JWT_ACCESS_TTL),
  });
};

export const clearAuthCookies = (res: Response): void => {
  res.clearCookie(env.COOKIE_ACCESS_NAME, baseOptions());
  res.clearCookie(env.COOKIE_REFRESH_NAME, { ...baseOptions(), path: '/api/v1/auth' });
};
