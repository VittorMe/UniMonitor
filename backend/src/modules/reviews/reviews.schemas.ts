import { z } from 'zod';

const score = z.coerce.number().int().min(1).max(5);

export const createReviewSchema = z.object({
  sessionId: z.uuid(),
  clarity: score,
  punctuality: score,
  mastery: score,
  comment: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  isAnonymous: z.boolean().default(true),
  publishComment: z.boolean().default(true),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
