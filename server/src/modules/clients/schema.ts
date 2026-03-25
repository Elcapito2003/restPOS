import { z } from 'zod';

export const clientSchema = z.object({
  name: z.string().min(1).max(150),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  tax_id: z.string().max(20).optional(),
  client_type: z.string().max(30).optional(),
  credit_limit: z.number().min(0).optional(),
  notes: z.string().optional(),
});
