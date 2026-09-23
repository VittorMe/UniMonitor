import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email('Informe um e-mail valido').trim().toLowerCase(),
  password: z.string().min(1, 'Informe a senha'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z
      .string()
      .min(8, 'A nova senha precisa de ao menos 8 caracteres')
      .max(72, 'A nova senha pode ter no maximo 72 caracteres'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha precisa ser diferente da atual',
    path: ['newPassword'],
  });

export const registerSchema = z.object({
  name: z.string().trim().min(3).max(160),
  email: z.email('Informe um e-mail valido').trim().toLowerCase(),
  password: z.string().min(8).max(72),
  registration: z.string().trim().min(3).max(40),
  courseId: z.uuid('Selecione um curso'),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(3).max(160).optional(),
    email: z.email('Informe um e-mail valido').trim().toLowerCase().optional(),
    registration: z.string().trim().min(3).max(40).optional(),
    courseId: z.uuid('Selecione um curso').optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Informe ao menos um campo para atualizar',
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
