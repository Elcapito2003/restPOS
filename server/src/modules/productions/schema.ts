import { z } from 'zod';

export const productionSchema = z.object({
  name: z.string().min(1).max(150),
  yield_quantity: z.number().positive(),
  yield_unit: z.string().min(1).max(50),
  notes: z.string().optional(),
  ingredients: z.array(z.object({
    inventory_item_id: z.number().int().positive(),
    quantity: z.number().positive(),
    unit: z.string().min(1).max(50),
  })).min(1),
});

export const executeSchema = z.object({
  batches: z.number().positive(),
  notes: z.string().optional(),
});
