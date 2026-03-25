import { z } from 'zod';

export const openRegisterSchema = z.object({
  opening_amount: z.number().min(0),
});

export const closeRegisterSchema = z.object({
  actual_amount: z.number().min(0),
  notes: z.string().optional(),
});

export const movementSchema = z.object({
  type: z.enum(['in', 'out']),
  amount: z.number().positive(),
  reason: z.string().min(1).max(200),
  reference: z.string().max(200).optional(),
  authorized_by: z.number().int().positive().optional(),
});
