import type { Request } from 'express';

import { UnauthorizedError } from '../errors/app-error.js';
import type { AuthenticatedUser } from './authenticated-user.js';

/**
 * Recupera o usuario autenticado sem espalhar `req.user!` pelos controllers.
 * Lanca 401 se a rota esquecer de aplicar o middleware `authenticate`.
 */
export const requireUser = (req: Request): AuthenticatedUser => {
  if (!req.user) {
    throw new UnauthorizedError('Autenticacao necessaria');
  }

  return req.user;
};
