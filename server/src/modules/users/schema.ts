import { z } from 'zod';

export const createUserSchema = z.object({
  username: z.string().min(2).max(50),
  display_name: z.string().min(1).max(100),
  pin: z.string().min(4).max(6),
  role: z.enum(['admin', 'manager', 'cashier', 'waiter', 'kitchen']),
  avatar_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  is_active: z.boolean().optional(),
});
