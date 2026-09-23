import { z } from 'zod';

export const courseBodySchema = z.object({
  name: z.string().trim().min(3).max(160),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  isActive: z.boolean().optional(),
});

export const subjectBodySchema = z.object({
  name: z.string().trim().min(3).max(160),
  code: z.string().trim().min(2).max(20).toUpperCase(),
  courseIds: z.array(z.uuid()).min(1, 'Vincule ao menos um curso'),
  isActive: z.boolean().optional(),
});

export const roomBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  building: z.string().trim().min(1).max(80),
  floor: z.string().trim().min(1).max(40),
  capacity: z.coerce.number().int().min(1).max(500),
  isActive: z.boolean().optional(),
});

export type CourseBody = z.infer<typeof courseBodySchema>;
export type SubjectBody = z.infer<typeof subjectBodySchema>;
export type RoomBody = z.infer<typeof roomBodySchema>;
