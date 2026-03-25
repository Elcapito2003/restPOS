import { z } from 'zod';

export const openShiftSchema = z.object({
  user_id: z.number().int().positive().optional(),
  starting_cash: z.number().min(0).optional(),
  notes: z.string().optional(),
});
