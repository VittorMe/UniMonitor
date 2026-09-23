import { Router } from 'express';

import { authenticate } from '../../shared/http/middlewares/authenticate.js';
import { validate } from '../../shared/http/middlewares/validate.js';
import { notificationsController, notificationIdParams } from './notifications.controller.js';

export const notificationsRoutes = Router();

notificationsRoutes.use(authenticate);
notificationsRoutes.get('/', notificationsController.list);
notificationsRoutes.patch('/read-all', notificationsController.markAllRead);
notificationsRoutes.patch(
  '/:id/read',
  validate({ params: notificationIdParams }),
  notificationsController.markRead,
);
