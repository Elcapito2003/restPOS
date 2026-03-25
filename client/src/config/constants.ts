export const ROLES = {
  admin: 'Administrador',
  manager: 'Gerente',
  cashier: 'Cajero',
  waiter: 'Mesero',
  kitchen: 'Cocina',
} as const;

export const PAYMENT_METHODS = {
  cash: 'Efectivo',
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'Amex',
  other_card: 'Otra Tarjeta',
  transfer: 'Transferencia',
  other: 'Otro',
} as const;

export const TABLE_STATUS = {
  free: { label: 'Libre', color: 'bg-emerald-500' },
  occupied: { label: 'Ocupada', color: 'bg-red-500' },
  reserved: { label: 'Reservada', color: 'bg-amber-500' },
  blocked: { label: 'Bloqueada', color: 'bg-gray-500' },
} as const;

export const ORDER_ITEM_STATUS = {
  pending: { label: 'Pendiente', color: 'text-gray-500' },
  sent: { label: 'Enviado', color: 'text-blue-500' },
  preparing: { label: 'Preparando', color: 'text-amber-500' },
  ready: { label: 'Listo', color: 'text-emerald-500' },
  delivered: { label: 'Entregado', color: 'text-gray-400' },
  cancelled: { label: 'Cancelado', color: 'text-red-500 line-through' },
} as const;
