import { Router } from 'express';

import { authenticate } from '../../shared/http/middlewares/authenticate.js';
import { authorize } from '../../shared/http/middlewares/authorize.js';
import { validate } from '../../shared/http/middlewares/validate.js';
import { usersController } from './users.controller.js';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from './users.schemas.js';

export const usersRoutes = Router();

// Gestao de usuarios e restrita a administracao.
usersRoutes.use(authenticate, authorize('ADMIN'));

usersRoutes.get('/', validate({ query: listUsersQuerySchema }), usersController.list);
usersRoutes.get('/:id', validate({ params: userIdParamsSchema }), usersController.getById);

usersRoutes.post(
  '/',
  authorize('ADMIN'),
  validate({ body: createUserSchema }),
  usersController.create,
);
usersRoutes.patch(
  '/:id',
  authorize('ADMIN'),
  validate({ params: userIdParamsSchema, body: updateUserSchema }),
  usersController.update,
);
usersRoutes.delete(
  '/:id',
  authorize('ADMIN'),
  validate({ params: userIdParamsSchema }),
  usersController.remove,
);
