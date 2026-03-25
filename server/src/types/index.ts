export type UserRole = 'admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen';

export interface JwtPayload {
  userId: number;
  username: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export type TableStatus = 'free' | 'occupied' | 'reserved' | 'blocked';
export type OrderStatus = 'open' | 'sent' | 'partial' | 'closed' | 'cancelled';
export type OrderItemStatus = 'pending' | 'sent' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cash' | 'visa' | 'mastercard' | 'amex' | 'other_card' | 'transfer' | 'other';
export type PrinterTarget = 'kitchen' | 'bar' | 'both' | 'none';
