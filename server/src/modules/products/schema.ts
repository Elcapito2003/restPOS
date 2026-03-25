import { z } from 'zod';

const modifierGroupLink = z.object({
  group_id: z.number().int().positive(),
  is_forced: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const productSchema = z.object({
  name: z.string().min(1).max(150),
  price: z.number().positive(),
  tax_rate: z.number().min(0).max(1).optional(),
  category_id: z.number().int().positive(),
  is_available: z.boolean().optional(),
  sort_order: z.number().int().optional(),
  is_composite: z.boolean().optional(),
  description: z.string().optional(),
  modifier_groups: z.array(modifierGroupLink).optional(),
});
