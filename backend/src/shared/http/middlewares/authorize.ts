import type { Role } from '@prisma/client';
import type { RequestHandler } from 'express';

import { ForbiddenError, UnauthorizedError } from '../../errors/app-error.js';

/**
 * Restringe a rota aos perfis informados. Use sempre depois de `authenticate`.
 * Ex.: router.post('/', authenticate, authorize('ADMIN', 'MANAGER'), handler)
 */
export const authorize = (...allowedRoles: Role[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Autenticacao necessaria');
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('Seu perfil nao tem acesso a este recurso');
    }

    next();
  };
};
