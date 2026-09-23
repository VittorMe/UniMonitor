import type { RequestHandler } from 'express';

import { env } from '../../../config/env.js';
import { verifyAccessToken } from '../../../modules/auth/token.service.js';
import { resolveEffectiveRole } from '../../../modules/auth/effective-role.js';
import { usersRepository } from '../../../modules/users/users.repository.js';
import { UnauthorizedError } from '../../errors/app-error.js';

/**
 * Le o access token do cookie httpOnly. O header Authorization tambem e
 * aceito para facilitar integracoes servidor-a-servidor e testes manuais.
 * O papel vem do banco, nao do JWT: promocao a monitor vale na hora,
 * sem esperar o access token expirar.
 */
const extractToken = (cookies: Record<string, string | undefined>, authHeader?: string) => {
  const fromCookie = cookies[env.COOKIE_ACCESS_NAME];
  if (fromCookie) {
    return fromCookie;
  }

  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return undefined;
};

export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req.cookies ?? {}, req.headers.authorization);

  if (!token) {
    throw new UnauthorizedError('Autenticacao necessaria');
  }

  const payload = verifyAccessToken(token);
  const user = await usersRepository.findById(payload.sub);

  if (!user?.isActive) {
    throw new UnauthorizedError('Sessao invalida. Faca login novamente');
  }

  const role = await resolveEffectiveRole(user);
  req.user = { id: user.id, email: user.email, role };
  next();
};
