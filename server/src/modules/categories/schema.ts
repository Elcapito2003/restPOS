import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  parent_id: z.number().int().positive().nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  printer_target: z.enum(['kitchen', 'bar', 'both', 'none']).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});
