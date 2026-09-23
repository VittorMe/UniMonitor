import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../../shared/http/middlewares/authenticate.js';
import { authorize } from '../../shared/http/middlewares/authorize.js';
import { validate } from '../../shared/http/middlewares/validate.js';
import { idParamSchema, paginationQuerySchema } from '../../shared/http/common-schemas.js';
import { courseBodySchema, roomBodySchema, subjectBodySchema } from './catalog.schemas.js';
import { coursesController, roomsController, subjectsController } from './catalog.service.js';

const subjectListQuery = paginationQuerySchema.extend({
  courseId: z.uuid().optional(),
});

export const catalogRoutes = Router();

catalogRoutes.use(authenticate);

catalogRoutes.get('/courses/options', coursesController.options);
catalogRoutes.get('/subjects/options', subjectsController.options);
catalogRoutes.get('/rooms/options', roomsController.options);

catalogRoutes.get('/courses', validate({ query: paginationQuerySchema }), coursesController.list);
catalogRoutes.get('/subjects', validate({ query: subjectListQuery }), subjectsController.list);
catalogRoutes.get('/rooms', validate({ query: paginationQuerySchema }), roomsController.list);

catalogRoutes.post('/courses', authorize('ADMIN'), validate({ body: courseBodySchema }), coursesController.create);
catalogRoutes.patch(
  '/courses/:id',
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: courseBodySchema.partial() }),
  coursesController.update,
);

catalogRoutes.post('/subjects', authorize('ADMIN'), validate({ body: subjectBodySchema }), subjectsController.create);
catalogRoutes.patch(
  '/subjects/:id',
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: subjectBodySchema.partial() }),
  subjectsController.update,
);

catalogRoutes.post('/rooms', authorize('ADMIN'), validate({ body: roomBodySchema }), roomsController.create);
catalogRoutes.patch(
  '/rooms/:id',
  authorize('ADMIN'),
  validate({ params: idParamSchema, body: roomBodySchema.partial() }),
  roomsController.update,
);
