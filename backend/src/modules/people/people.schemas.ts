import { z } from 'zod';

import { periodQuerySchema } from '../../shared/http/common-schemas.js';

export const createProfessorSchema = z.object({
  name: z.string().trim().min(3).max(160),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(72),
  registration: z.string().trim().min(3).max(40),
});

export const updateProfessorSchema = z
  .object({
    name: z.string().trim().min(3).max(160).optional(),
    email: z.email().trim().toLowerCase().optional(),
    registration: z.string().trim().min(3).max(40).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo' });

export const linkSubjectSchema = z.object({
  subjectId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  semester: z.coerce.number().int().min(1).max(2).optional(),
});

export const professorListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const studentListQuery = professorListQuery.extend({
  courseId: z.uuid().optional(),
  subjectId: z.uuid().optional(),
});

export const createStudentSchema = z.object({
  name: z.string().trim().min(3).max(160),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(72),
  registration: z.string().trim().min(3).max(40),
  courseId: z.uuid(),
});

export const assignMonitorSchema = z.object({
  studentId: z.uuid(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  semester: z.coerce.number().int().min(1).max(2).optional(),
});

export const professorSubjectParams = z.object({
  id: z.uuid('Identificador invalido'),
  subjectId: z.uuid('Identificador invalido'),
});

export const unassignMonitorParams = z.object({
  subjectId: z.uuid('Identificador invalido'),
  monitorId: z.uuid('Identificador invalido'),
});

export type CreateProfessorInput = z.infer<typeof createProfessorSchema>;
export type UpdateProfessorInput = z.infer<typeof updateProfessorSchema>;
export type LinkSubjectInput = z.infer<typeof linkSubjectSchema>;
export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type AssignMonitorInput = z.infer<typeof assignMonitorSchema>;
