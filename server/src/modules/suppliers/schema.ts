import { z } from 'zod';

export const supplierSchema = z.object({
  name: z.string().min(1).max(150),
  contact_name: z.string().max(150).optional(),
  phone: z.string().max(30).optional(),
  address: z.string().optional(),
  bank_name: z.string().max(100).optional(),
  account_number: z.string().max(30).optional(),
  clabe: z.string().max(20).optional(),
  email: z.string().email().optional().or(z.literal('')),
  whatsapp: z.string().max(20).optional(),
  notes: z.string().optional(),
  shipping_cost: z.number().min(0).optional(),
  free_shipping_min: z.number().min(0).optional(),
});

export const supplierUpdateSchema = supplierSchema.partial().passthrough();
