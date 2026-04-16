import { z } from 'zod';

export const inventoryItemSchema = z.object({
  name: z.string().min(1).max(150),
  unit: z.string().min(1).max(50),
  units_per_package: z.number().int().positive().optional(),
  unit_content: z.string().max(50).optional(),
  stock_min: z.number().min(0).optional(),
});

export const inventoryItemUpdateSchema = inventoryItemSchema.partial();

export const itemSupplierSchema = z.object({
  item_id: z.number().int().positive(),
  supplier_id: z.number().int().positive(),
  price: z.number().min(0),
  delivery_days: z.number().int().positive().optional(),
});

export const movementSchema = z.object({
  item_id: z.number().int().positive(),
  type: z.enum(['entrada', 'salida', 'merma', 'ajuste']),
  quantity: z.number().positive(),
  reason: z.string().optional(),
});

export const purchaseSchema = z.object({
  item_id: z.number().int().positive(),
  supplier_id: z.number().int().positive().optional(),
  quantity: z.number().positive(),
  unit_cost: z.number().positive(),
  tax_percent: z.number().min(0).optional(),
});
