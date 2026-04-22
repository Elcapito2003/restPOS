import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from './config';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  const tenantId = await AsyncStorage.getItem('tenantId');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (tenantId) config.headers['X-Tenant-Id'] = tenantId;
  return config;
});

// ─── Types ───

export interface Floor { id: number; name: string; sort_order: number; }

export interface Table {
  id: number; floor_id: number; label: string;
  status: 'free' | 'occupied' | 'reserved' | 'blocked';
  capacity: number;
  current_order_id: number | null;
  daily_number?: number | null;
  waiter_id?: number | null;
  waiter_name?: string | null;
}

export interface Category {
  id: number; name: string; parent_id: number | null;
  printer_target?: string; color?: string; is_active: boolean;
  children?: Category[];
}

export interface Modifier {
  id: number; name: string; price_extra: number | string;
}

export interface ModifierGroup {
  id: number; name: string;
  min_selections: number; max_selections: number;
  is_required: boolean;
  modifiers: Modifier[];
  product_ids?: number[];
}

export interface Product {
  id: number; name: string; price: number | string;
  category_id: number; is_available: boolean;
  tax_rate: number | string;
  printer_target?: string;
  modifier_groups?: ModifierGroup[];
}

export interface OrderItemModifier {
  id?: number; modifier_id: number; modifier_name: string; price_extra: number | string;
}

export interface OrderItem {
  id: number; order_id: number; product_id: number;
  product_name: string; quantity: number;
  unit_price: number | string;
  status: 'pending' | 'sent' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  notes?: string | null;
  printer_target?: string;
  modifiers?: OrderItemModifier[];
}

export interface Order {
  id: number; daily_number: number;
  table_id: number | null; table_label?: string;
  waiter_id: number; waiter_name?: string;
  status: 'open' | 'sent' | 'partial' | 'closed' | 'cancelled';
  subtotal: number | string; tax: number | string;
  discount_amount: number | string; total: number | string;
  guest_count: number; notes?: string;
  items: OrderItem[];
}

// ─── Auth ───

export async function redeemLicense(code: string) {
  const res = await axios.post(`${API_URL}/super-admin/license/redeem`, { license_code: code });
  return res.data as {
    tenant: { id: string; name: string; slug: string; logo_url: string | null; timezone: string; currency: string };
    license: { plan: string; expires_at: string };
  };
}

export async function fetchActiveUsers() {
  const res = await api.get('/auth/users');
  return res.data as Array<{ id: number; username: string; display_name: string; role: string; avatar_color: string }>;
}

export async function pinLogin(userId: number, pin: string) {
  const res = await api.post('/auth/pin-login', { userId, pin });
  return res.data as {
    token: string;
    user: { id: number; username: string; display_name: string; role: string; avatar_color: string };
  };
}

// ─── Floors & Tables ───

export async function fetchFloors(): Promise<Floor[]> {
  const res = await api.get('/floors');
  return res.data;
}

export async function fetchTables(floorId: number): Promise<Table[]> {
  const res = await api.get(`/floors/${floorId}/tables`);
  return res.data;
}

// ─── Menu ───

export async function fetchCategoriesTree(): Promise<Category[]> {
  const res = await api.get('/categories/tree');
  return res.data;
}

export async function fetchProducts(categoryId?: number): Promise<Product[]> {
  const res = await api.get('/products', { params: categoryId ? { category_id: categoryId } : {} });
  return res.data;
}

export async function fetchProduct(id: number): Promise<Product> {
  const res = await api.get(`/products/${id}`);
  return res.data;
}

export async function fetchModifierGroups(): Promise<ModifierGroup[]> {
  const res = await api.get('/modifier-groups');
  return res.data;
}

// ─── Orders ───

export async function getOrderByTable(tableId: number): Promise<Order | null> {
  try {
    const res = await api.get(`/orders/table/${tableId}`);
    return res.data;
  } catch (e: any) {
    if (e?.response?.status === 404) return null;
    throw e;
  }
}

export async function createOrder(data: { table_id?: number; order_type?: string; guest_count?: number; notes?: string }): Promise<Order> {
  const res = await api.post('/orders', data);
  return res.data;
}

export async function addOrderItem(orderId: number, item: { product_id: number; quantity?: number; notes?: string; modifiers?: { modifier_id: number }[] }): Promise<Order> {
  const res = await api.post(`/orders/${orderId}/items`, item);
  return res.data;
}

export async function removeOrderItem(orderId: number, itemId: number): Promise<Order> {
  const res = await api.delete(`/orders/${orderId}/items/${itemId}`);
  return res.data;
}

export async function updateOrderItem(orderId: number, itemId: number, data: { quantity?: number; notes?: string }): Promise<Order> {
  const res = await api.put(`/orders/${orderId}/items/${itemId}`, data);
  return res.data;
}

export async function sendOrderToKitchen(orderId: number): Promise<Order> {
  const res = await api.post(`/orders/${orderId}/send`);
  return res.data;
}

export async function setOrderDiscount(orderId: number, discountPercent: number, presetId?: number | null): Promise<Order> {
  const res = await api.patch(`/orders/${orderId}/discount`, { discount_percent: discountPercent, preset_id: presetId ?? null });
  return res.data;
}

export async function setOrderTip(orderId: number, amount: number): Promise<Order> {
  const res = await api.patch(`/orders/${orderId}/tip`, { amount });
  return res.data;
}

export async function setOrderGuests(orderId: number, guestCount: number): Promise<Order> {
  const res = await api.patch(`/orders/${orderId}/guests`, { guest_count: guestCount });
  return res.data;
}

export async function setOrderObservations(orderId: number, notes: string): Promise<Order> {
  const res = await api.patch(`/orders/${orderId}/observations`, { notes });
  return res.data;
}

export async function changeOrderWaiter(orderId: number, waiterId: number): Promise<Order> {
  const res = await api.patch(`/orders/${orderId}/waiter`, { waiter_id: waiterId });
  return res.data;
}

export async function changeOrderTable(orderId: number, tableId: number): Promise<Order> {
  const res = await api.patch(`/orders/${orderId}/table`, { table_id: tableId });
  return res.data;
}

export async function cancelOrder(orderId: number): Promise<Order> {
  const res = await api.post(`/orders/${orderId}/cancel`);
  return res.data;
}

export async function cancelOrderItem(orderId: number, itemId: number, reason: string): Promise<Order> {
  const res = await api.post(`/orders/${orderId}/items/${itemId}/cancel`, { reason });
  return res.data;
}

export async function fetchCancellationReasons(): Promise<Array<{ id: number; name: string }>> {
  const res = await api.get('/orders/meta/cancellation-reasons');
  return res.data;
}

export async function mergeWithOrder(sourceId: number, targetOrderId: number): Promise<Order> {
  const res = await api.post(`/orders/${sourceId}/merge`, { target_order_id: targetOrderId });
  return res.data;
}

export async function transferOrderItems(fromOrderId: number, targetOrderId: number, itemIds: number[]): Promise<{ from: Order; to: Order }> {
  const res = await api.post(`/orders/${fromOrderId}/transfer-items`, { target_order_id: targetOrderId, item_ids: itemIds });
  return res.data;
}

export async function fetchActiveOrders(): Promise<Order[]> {
  const res = await api.get('/orders');
  return res.data;
}

export async function printReceipt(orderId: number): Promise<void> {
  await api.post(`/printer/receipt/${orderId}`);
}

export async function printComanda(orderId: number): Promise<void> {
  await api.post(`/printer/comanda/${orderId}`);
}
