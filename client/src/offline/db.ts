import Dexie, { type Table } from 'dexie';

// ─── Types ───

export interface CachedProduct {
  id: number; name: string; price: number; tax_rate: number;
  category_id: number; category_name: string; is_available: boolean;
  printer_target: string; sort_order: number;
}

export interface CachedCategory {
  id: number; name: string; parent_id: number | null;
  color: string; printer_target: string; sort_order: number;
}

export interface CachedTable {
  id: number; floor_id: number; label: string; capacity: number;
  pos_x: number; pos_y: number; width: number; height: number;
  shape: string; status: string; current_order_id: number | null;
}

export interface CachedFloor {
  id: number; name: string; sort_order: number;
}

export interface CachedUser {
  id: number; username: string; display_name: string;
  role: string; avatar_color: string;
}

export interface LocalOrder {
  id: number; daily_number: number; table_id: number | null;
  waiter_id: number | null; status: string;
  subtotal: number; tax: number; discount_percent: number;
  discount_amount: number; tip: number; total: number;
  guest_count: number; notes: string; order_type: string;
  created_at: string; updated_at: string; closed_at: string | null;
  _offline: boolean; _tempId: string;
}

export interface LocalOrderItem {
  id: number; order_id: number; product_id: number;
  product_name: string; quantity: number; unit_price: number;
  tax_rate: number; notes: string; status: string;
  printer_target: string;
  created_at: string;
  _offline: boolean; _tempId: string;
}

export interface LocalPayment {
  id: number; order_id: number; method: string;
  amount: number; tip: number; reference: string;
  received_amount: number; change_amount: number;
  cashier_id: number; created_at: string;
  _offline: boolean;
}

export interface SyncOperation {
  id?: number;
  operation: string;
  endpoint: string;
  method: string;
  payload: any;
  tempId?: string;
  dependsOnTempId?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  createdAt: number;
  error?: string;
  idempotencyKey: string;
}

export interface MetaEntry {
  key: string;
  value: string;
}

// ─── Database ───

class RestPOSOfflineDB extends Dexie {
  products!: Table<CachedProduct>;
  categories!: Table<CachedCategory>;
  tables!: Table<CachedTable>;
  floors!: Table<CachedFloor>;
  users!: Table<CachedUser>;
  orders!: Table<LocalOrder>;
  orderItems!: Table<LocalOrderItem>;
  payments!: Table<LocalPayment>;
  syncQueue!: Table<SyncOperation>;
  meta!: Table<MetaEntry>;

  constructor() {
    super('restpos-offline');
    this.version(1).stores({
      products: 'id, category_id, name',
      categories: 'id, parent_id',
      tables: 'id, floor_id',
      floors: 'id',
      users: 'id',
      orders: 'id, table_id, status, _offline',
      orderItems: 'id, order_id, _offline',
      payments: 'id, order_id, _offline',
      syncQueue: '++id, status, createdAt',
      meta: 'key',
    });
  }
}

export const db = new RestPOSOfflineDB();
