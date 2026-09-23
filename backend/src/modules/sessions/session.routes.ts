import { Router } from 'express';

import { authenticate } from '../../shared/http/middlewares/authenticate.js';
import { authorize } from '../../shared/http/middlewares/authorize.js';
import { validate } from '../../shared/http/middlewares/validate.js';
import { idParamSchema, periodQuerySchema } from '../../shared/http/common-schemas.js';
import { sessionsController } from './session.controller.js';
import {
  attendSchema,
  availabilitySchema,
  createSessionSchema,
  generateFromAvailabilitySchema,
  searchSessionsQuery,
  updateSessionSchema,
} from './session.schemas.js';

export const monitorSessionRoutes = Router();
monitorSessionRoutes.use(authenticate, authorize('MONITOR'));

monitorSessionRoutes.get('/sessions', sessionsController.listMine);
monitorSessionRoutes.post('/sessions', validate({ body: createSessionSchema }), sessionsController.create);
monitorSessionRoutes.put(
  '/sessions/:id',
  validate({ params: idParamSchema, body: updateSessionSchema }),
  sessionsController.update,
);
monitorSessionRoutes.patch(
  '/sessions/:id/cancel',
  validate({ params: idParamSchema }),
  sessionsController.cancel,
);
monitorSessionRoutes.post('/sessions/:id/start', validate({ params: idParamSchema }), sessionsController.start);
monitorSessionRoutes.post('/sessions/:id/complete', validate({ params: idParamSchema }), sessionsController.complete);
monitorSessionRoutes.get(
  '/sessions/:id/participants',
  validate({ params: idParamSchema }),
  sessionsController.participants,
);

monitorSessionRoutes.patch(
  '/participants/:id/accept',
  validate({ params: idParamSchema }),
  sessionsController.accept,
);
monitorSessionRoutes.patch(
  '/participants/:id/reject',
  validate({ params: idParamSchema }),
  sessionsController.reject,
);

monitorSessionRoutes.get('/availability', sessionsController.listAvailability);
monitorSessionRoutes.post('/availability', validate({ body: availabilitySchema }), sessionsController.createAvailability);
monitorSessionRoutes.put(
  '/availability/:id',
  validate({ params: idParamSchema, body: availabilitySchema.partial() }),
  sessionsController.updateAvailability,
);
monitorSessionRoutes.post(
  '/availability/:id/generate',
  validate({ params: idParamSchema, body: generateFromAvailabilitySchema }),
  sessionsController.generate,
);

export const studentSessionRoutes = Router();
studentSessionRoutes.use(authenticate, authorize('STUDENT', 'MONITOR'));

studentSessionRoutes.get('/subjects', async (req, res, next) => {
  try {
    const { subjectsService } = await import('../catalog/catalog.service.js');
    res.json({ data: await subjectsService.getAllActive() });
  } catch (error) {
    next(error);
  }
});
studentSessionRoutes.get('/sessions', validate({ query: searchSessionsQuery }), sessionsController.search);
studentSessionRoutes.get('/sessions/:id', validate({ params: idParamSchema }), sessionsController.getOne);
studentSessionRoutes.post('/sessions/:id/join', validate({ params: idParamSchema }), sessionsController.join);
studentSessionRoutes.delete('/sessions/:id/leave', validate({ params: idParamSchema }), sessionsController.leave);
studentSessionRoutes.post(
  '/sessions/:id/attend',
  validate({ params: idParamSchema, body: attendSchema }),
  sessionsController.attend,
);
studentSessionRoutes.get('/appointments', sessionsController.appointments);

export const professorSessionRoutes = Router();
professorSessionRoutes.get(
  '/subjects/:id/sessions',
  authenticate,
  authorize('PROFESSOR'),
  validate({ params: idParamSchema, query: periodQuerySchema }),
  sessionsController.listForProfessor,
);
