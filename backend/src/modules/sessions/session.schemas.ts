import { z } from 'zod';

import { periodQuerySchema } from '../../shared/http/common-schemas.js';

export const sessionTypeSchema = z.enum(['PRIVATE', 'GROUP', 'OFFICE_HOURS', 'STUDY_GROUP']);
export const modalitySchema = z.enum(['PRESENTIAL', 'ONLINE', 'HYBRID']);

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, 'Use o formato HH:mm');

export const createSessionSchema = z
  .object({
    subjectMonitorId: z.uuid(),
    type: sessionTypeSchema,
    modality: modalitySchema,
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().max(2000).optional(),
    topic: z.string().trim().max(160).optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    maxParticipants: z.coerce.number().int().min(1).max(200),
    roomId: z.uuid().optional(),
    meetingUrl: z.url().optional(),
    status: z.enum(['DRAFT', 'PUBLISHED']).default('PUBLISHED'),
  })
  .refine((data) => data.endAt > data.startAt, {
    message: 'O termino precisa ser posterior ao inicio',
    path: ['endAt'],
  })
  .refine((data) => data.modality === 'ONLINE' || data.roomId, {
    message: 'Informe a sala para sessoes presenciais ou hibridas',
    path: ['roomId'],
  })
  .refine((data) => data.modality === 'PRESENTIAL' || data.meetingUrl, {
    message: 'Informe o link da reuniao para sessoes online ou hibridas',
    path: ['meetingUrl'],
  });

export const updateSessionSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    topic: z.string().trim().max(160).optional(),
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    maxParticipants: z.coerce.number().int().min(1).max(200).optional(),
    roomId: z.uuid().nullable().optional(),
    meetingUrl: z.url().nullable().optional(),
    type: sessionTypeSchema.optional(),
    modality: modalitySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Informe ao menos um campo' });

export const availabilitySchema = z.object({
  subjectMonitorId: z.uuid(),
  weekday: z.coerce.number().int().min(1).max(7),
  startTime: timeSchema,
  endTime: timeSchema,
  title: z.string().trim().min(3).max(160),
  topic: z.string().trim().max(160).optional(),
  type: sessionTypeSchema.default('OFFICE_HOURS'),
  modality: modalitySchema.default('PRESENTIAL'),
  maxParticipants: z.coerce.number().int().min(1).max(200),
  roomId: z.uuid().optional(),
  meetingUrl: z.url().optional(),
});

export const generateFromAvailabilitySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(16).default(8),
});

export const searchSessionsQuery = periodQuerySchema.extend({
  subjectId: z.uuid().optional(),
  date: z.string().optional(),
  modality: modalitySchema.optional(),
  type: sessionTypeSchema.optional(),
  topic: z.string().trim().min(1).optional(),
  preferredStart: z.string().optional(),
  preferredEnd: z.string().optional(),
});

export const attendSchema = z.object({
  token: z.string().min(8),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type AvailabilityInput = z.infer<typeof availabilitySchema>;
export type SearchSessionsQuery = z.infer<typeof searchSessionsQuery>;
