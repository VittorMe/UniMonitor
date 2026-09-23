import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.uuid('Identificador invalido'),
});

export const periodQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  semester: z.coerce.number().int().min(1).max(2).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
});
