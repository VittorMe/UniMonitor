import { Router } from 'express';
import type { RequestHandler } from 'express';

import { authenticate } from '../../shared/http/middlewares/authenticate.js';
import { authorize } from '../../shared/http/middlewares/authorize.js';
import { requireUser } from '../../shared/http/require-user.js';
import { idParamSchema } from '../../shared/http/common-schemas.js';
import { validate } from '../../shared/http/middlewares/validate.js';
import { dashboardService } from './dashboard.service.js';

const admin: RequestHandler = async (_req, res) => {
  res.json(await dashboardService.admin());
};

const professor: RequestHandler = async (req, res) => {
  res.json(await dashboardService.professor(requireUser(req).id, req.params['id'] as string));
};

const monitor: RequestHandler = async (req, res) => {
  res.json(await dashboardService.monitor(requireUser(req).id));
};

export const dashboardRoutes = Router();

dashboardRoutes.get('/admin/dashboard', authenticate, authorize('ADMIN'), admin);
dashboardRoutes.get(
  '/professor/subjects/:id/statistics',
  authenticate,
  authorize('PROFESSOR'),
  validate({ params: idParamSchema }),
  professor,
);
dashboardRoutes.get('/monitor/statistics', authenticate, authorize('MONITOR'), monitor);
