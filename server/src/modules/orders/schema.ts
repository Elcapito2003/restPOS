import { z } from 'zod';

export const createOrderSchema = z.object({
  table_id: z.number().int().positive().optional().nullable(),
  order_type: z.enum(['dine_in', 'quick']).optional(),
  guest_count: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

export const addItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  modifiers: z.array(z.object({
    modifier_id: z.number().int().positive(),
  })).optional(),
});

export const updateItemSchema = z.object({
  quantity: z.number().int().min(1).optional(),
  notes: z.string().optional(),
  status: z.enum(['pending', 'sent', 'preparing', 'ready', 'delivered', 'cancelled']).optional(),
});

export const discountSchema = z.object({
  discount_percent: z.number().min(0).max(100),
  preset_id: z.number().int().positive().optional().nullable(),
  authorized_by: z.number().int().positive().optional().nullable(),
});
