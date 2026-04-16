import { z } from 'zod';

export const createOrderSchema = z.object({
  supplier_id: z.number().int().positive(),
  notes: z.string().optional(),
  items: z.array(z.object({
    item_id: z.number().int().positive(),
    item_name: z.string().min(1),
    quantity: z.number().positive(),
    unit: z.string().optional(),
    estimated_price: z.number().min(0).optional(),
  })).min(1),
});

export const sendMessageSchema = z.object({
  message: z.string().min(1),
});

export const incomingWebhookSchema = z.object({
  phone: z.string().min(1),
  message: z.string().min(1),
  wa_message_id: z.string().optional(),
});
