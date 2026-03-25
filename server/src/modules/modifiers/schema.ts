import { z } from 'zod';

export const modifierGroupSchema = z.object({
  name: z.string().min(1).max(100),
  min_select: z.number().int().min(0).optional(),
  max_select: z.number().int().min(1).optional(),
  is_required: z.boolean().optional(),
  modifiers: z.array(z.object({
    name: z.string().min(1),
    price_extra: z.number().min(0).optional(),
    sort_order: z.number().int().optional(),
  })).optional(),
  product_ids: z.array(z.number().int().positive()).optional(),
});
