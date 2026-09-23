import { Router } from 'express';

import { authenticate } from '../../shared/http/middlewares/authenticate.js';
import { authorize } from '../../shared/http/middlewares/authorize.js';
import { validate } from '../../shared/http/middlewares/validate.js';
import { idParamSchema, periodQuerySchema } from '../../shared/http/common-schemas.js';
import { peopleController } from './people.controller.js';
import {
  assignMonitorSchema,
  createProfessorSchema,
  createStudentSchema,
  linkSubjectSchema,
  professorListQuery,
  professorSubjectParams,
  studentListQuery,
  unassignMonitorParams,
  updateProfessorSchema,
} from './people.schemas.js';

export const adminPeopleRoutes = Router();
adminPeopleRoutes.use(authenticate, authorize('ADMIN'));

adminPeopleRoutes.get('/professors', validate({ query: professorListQuery }), peopleController.listProfessors);
adminPeopleRoutes.post('/professors', validate({ body: createProfessorSchema }), peopleController.createProfessor);
adminPeopleRoutes.patch(
  '/professors/:id',
  validate({ params: idParamSchema, body: updateProfessorSchema }),
  peopleController.updateProfessor,
);
adminPeopleRoutes.post(
  '/professors/:id/subjects',
  validate({ params: idParamSchema, body: linkSubjectSchema }),
  peopleController.linkSubject,
);
adminPeopleRoutes.delete(
  '/professors/:id/subjects/:subjectId',
  validate({ params: professorSubjectParams, query: periodQuerySchema }),
  peopleController.unlinkSubject,
);

adminPeopleRoutes.get('/students', validate({ query: studentListQuery }), peopleController.listStudents);
adminPeopleRoutes.post('/students', validate({ body: createStudentSchema }), peopleController.createStudent);

export const professorRoutes = Router();
professorRoutes.use(authenticate, authorize('PROFESSOR'));

professorRoutes.get('/subjects', validate({ query: periodQuerySchema }), peopleController.professorSubjects);
professorRoutes.get('/students', validate({ query: studentListQuery }), peopleController.listProfessorStudents);
professorRoutes.get(
  '/subjects/:id/monitors',
  validate({ params: idParamSchema, query: periodQuerySchema }),
  peopleController.listMonitors,
);
professorRoutes.post(
  '/subjects/:id/monitors',
  validate({ params: idParamSchema, body: assignMonitorSchema }),
  peopleController.assignMonitor,
);
professorRoutes.delete(
  '/subjects/:subjectId/monitors/:monitorId',
  validate({ params: unassignMonitorParams, query: periodQuerySchema }),
  peopleController.unassignMonitor,
);

export const monitorSubjectRoutes = Router();
monitorSubjectRoutes.use(authenticate, authorize('MONITOR'));
monitorSubjectRoutes.get('/subjects', validate({ query: periodQuerySchema }), peopleController.myMonitorSubjects);
