import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1),
  pin: z.string().min(4).max(6),
});

export const pinLoginSchema = z.object({
  userId: z.number().int().positive(),
  pin: z.string().min(4).max(6),
});
