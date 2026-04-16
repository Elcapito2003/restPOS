import { z } from 'zod';

export const recipeSchema = z.object({
  ingredients: z.array(z.object({
    inventory_item_id: z.number().int().positive(),
    quantity: z.number().positive(),
    unit: z.string().min(1).max(50),
  })),
});
