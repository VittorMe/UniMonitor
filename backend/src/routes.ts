import { Router } from 'express';

import { prisma } from './infra/database/prisma.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import {
  adminPeopleRoutes,
  monitorSubjectRoutes,
  professorRoutes,
} from './modules/people/people.routes.js';
import {
  monitorReviewRoutes,
  professorReviewRoutes,
  studentReviewRoutes,
} from './modules/reviews/reviews.routes.js';
import {
  monitorSessionRoutes,
  professorSessionRoutes,
  studentSessionRoutes,
} from './modules/sessions/session.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';

export const apiRoutes = Router();

apiRoutes.get('/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

apiRoutes.get('/public/courses', async (_req, res) => {
  const data = await prisma.course.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
  res.json({ data });
});

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/users', usersRoutes);
apiRoutes.use('/notifications', notificationsRoutes);
apiRoutes.use('/catalog', catalogRoutes);
apiRoutes.use('/admin', adminPeopleRoutes);
apiRoutes.use('/professor', professorRoutes);
apiRoutes.use('/professor', professorSessionRoutes);
apiRoutes.use('/professor', professorReviewRoutes);
apiRoutes.use('/monitor', monitorSubjectRoutes);
apiRoutes.use('/monitor', monitorSessionRoutes);
apiRoutes.use('/monitor/reviews', monitorReviewRoutes);
apiRoutes.use('/student', studentSessionRoutes);
apiRoutes.use('/student/reviews', studentReviewRoutes);
apiRoutes.use(dashboardRoutes);
