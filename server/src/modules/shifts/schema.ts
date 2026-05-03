import { z } from 'zod';

export const openShiftSchema = z.object({
  user_id: z.number().int().positive().optional(),
  starting_cash: z.number().positive({ message: 'El monto inicial de caja debe ser mayor a 0' }),
  notes: z.string().optional(),
});
