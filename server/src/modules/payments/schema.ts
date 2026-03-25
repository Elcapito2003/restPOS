import { z } from 'zod';

export const paymentSchema = z.object({
  order_id: z.number().int().positive(),
  method: z.enum(['cash', 'visa', 'mastercard', 'amex', 'other_card', 'transfer', 'other']),
  amount: z.number().positive(),
  tip: z.number().min(0).optional(),
  reference: z.string().optional(),
  received_amount: z.number().positive().optional(),
});

export const splitPaymentSchema = z.object({
  order_id: z.number().int().positive(),
  payments: z.array(z.object({
    method: z.enum(['cash', 'visa', 'mastercard', 'amex', 'other_card', 'transfer', 'other']),
    amount: z.number().positive(),
    tip: z.number().min(0).optional(),
    reference: z.string().optional(),
    received_amount: z.number().positive().optional(),
  })).min(1),
});
