import { z } from 'zod';

export const createPresetSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(50).optional().nullable(),
  discount_percent: z.number().min(0.01).max(100),
  is_active: z.boolean().optional(),
});

export const updatePresetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(50).optional().nullable(),
  discount_percent: z.number().min(0.01).max(100).optional(),
  is_active: z.boolean().optional(),
});
