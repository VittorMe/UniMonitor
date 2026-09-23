import { z } from 'zod';

export const roleSchema = z.enum(['ADMIN', 'PROFESSOR', 'MONITOR', 'STUDENT']);

export const userIdParamsSchema = z.object({
  id: z.uuid('Identificador invalido'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  role: roleSchema.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(3, 'O nome precisa de ao menos 3 caracteres').max(160),
  email: z.email('Informe um e-mail valido').trim().toLowerCase(),
  // bcrypt ignora bytes acima de 72, por isso o limite superior.
  password: z.string().min(8, 'A senha precisa de ao menos 8 caracteres').max(72),
  role: roleSchema.default('STUDENT'),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(3).max(160).optional(),
    email: z.email('Informe um e-mail valido').trim().toLowerCase().optional(),
    role: roleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo para atualizar',
  });

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
