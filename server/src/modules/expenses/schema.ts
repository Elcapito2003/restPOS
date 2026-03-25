import { z } from 'zod';

export const expenseTypeSchema = z.object({
  name: z.string().min(1).max(100),
  parent_id: z.number().int().positive().nullable().optional(),
});

export const expenseSchema = z.object({
  expense_type_id: z.number().int().positive(),
  amount: z.number().positive(),
  description: z.string().optional(),
});
