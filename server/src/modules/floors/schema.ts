import { z } from 'zod';

export const floorSchema = z.object({
  name: z.string().min(1).max(100),
  sort_order: z.number().int().optional(),
});

export const tableSchema = z.object({
  floor_id: z.number().int().positive(),
  label: z.string().min(1).max(20),
  capacity: z.number().int().min(1).optional(),
  pos_x: z.number().int().optional(),
  pos_y: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  shape: z.enum(['square', 'round', 'rect']).optional(),
});

export const tableStatusSchema = z.object({
  status: z.enum(['free', 'occupied', 'reserved', 'blocked']),
});

export const transferSchema = z.object({
  target_table_id: z.number().int().positive(),
});
