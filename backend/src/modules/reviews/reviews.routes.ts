import { Router } from 'express';

import { authenticate } from '../../shared/http/middlewares/authenticate.js';
import { authorize } from '../../shared/http/middlewares/authorize.js';
import { validate } from '../../shared/http/middlewares/validate.js';
import { idParamSchema } from '../../shared/http/common-schemas.js';
import { reviewsController } from './reviews.controller.js';
import { createReviewSchema } from './reviews.schemas.js';

export const studentReviewRoutes = Router();
studentReviewRoutes.use(authenticate, authorize('STUDENT', 'MONITOR'));
studentReviewRoutes.post('/', validate({ body: createReviewSchema }), reviewsController.create);

export const monitorReviewRoutes = Router();
monitorReviewRoutes.use(authenticate, authorize('MONITOR'));
monitorReviewRoutes.get('/', reviewsController.mineAsMonitor);

export const professorReviewRoutes = Router();
professorReviewRoutes.get(
  '/subjects/:id/reviews',
  authenticate,
  authorize('PROFESSOR'),
  validate({ params: idParamSchema }),
  reviewsController.bySubject,
);
