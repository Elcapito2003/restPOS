import api from '../config/api';
import { db } from './db';
import {
  localCreateOrder, localAddItem, localUpdateItem, localRemoveItem,
  localProcessPayment, getLocalOrders, getLocalOrder, getLocalOrderByTable,
} from './orderOps';

let isOffline = false;

export function setOfflineStatus(offline: boolean) {
  isOffline = offline;
}

/**
 * Install Axios interceptors for offline handling.
 * When offline, specific API calls are handled locally via IndexedDB.
 */
export function installOfflineInterceptor() {
  // Response interceptor — catch network errors and handle offline
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      // If it's a network error (no response) and we can handle it offline
      if (!error.response && isOffline) {
        const config = error.config;
        const result = await handleOffline(config);
        if (result !== null) {
          return { data: result, status: 200, statusText: 'OK (offline)', config, headers: {} };
        }
      }
      return Promise.reject(error);
    }
  );

  // Request interceptor — when offline, intercept before sending
  api.interceptors.request.use(async (config) => {
    if (isOffline && config.url) {
      const result = await handleOffline(config);
      if (result !== null) {
        // Return a fake adapter that resolves immediately
        config.adapter = () => Promise.resolve({
          data: result,
          status: 200,
          statusText: 'OK (offline)',
          headers: {},
          config,
        });
      }
    }
    return config;
  });
}

// ─── Route offline requests to local handlers ───

async function handleOffline(config: any): Promise<any> {
  const url = config.url?.replace(/^\/api/, '') || '';
  const method = (config.method || 'get').toUpperCase();
  const data = config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : {};
  const params = config.params || {};

  try {
    // GET requests — read from cache
    if (method === 'GET') {
      // Products
      if (url === '/products') {
        const products = await db.products.where('is_available').equals(1).sortBy('name');
        return products;
      }
      if (url.match(/^\/products\/\d+/)) {
        const id = parseInt(url.split('/')[2]);
        return await db.products.get(id);
      }

      // Categories
      if (url === '/categories' || url === '/categories/tree') {
        return await db.categories.toArray();
      }

      // Floors
      if (url === '/floors') {
        return await db.floors.toArray();
      }
      if (url.match(/^\/floors\/\d+\/tables/)) {
        const floorId = parseInt(url.split('/')[2]);
        return await db.tables.where('floor_id').equals(floorId).toArray();
      }

      // Users
      if (url === '/auth/users') {
        return await db.users.toArray();
      }

      // Orders
      if (url === '/orders') {
        return await getLocalOrders(params.status);
      }
      if (url.match(/^\/orders\/table\/\d+/)) {
        const tableId = parseInt(url.split('/')[3]);
        return await getLocalOrderByTable(tableId);
      }
      if (url.match(/^\/orders\/\d+$/)) {
        const orderId = parseInt(url.split('/')[2]);
        return await getLocalOrder(orderId);
      }

      // Payments
      if (url.match(/^\/payments\/order\/\d+/)) {
        const orderId = parseInt(url.split('/')[3]);
        return await db.payments.where('order_id').equals(orderId).toArray();
      }

      // Health check — always return ok offline
      if (url === '/health') {
        return { status: 'ok', offline: true };
      }
    }

    // POST requests — create locally
    if (method === 'POST') {
      // Create order
      if (url === '/orders') {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return await localCreateOrder(user.id || 1, data);
      }

      // Add item to order
      if (url.match(/^\/orders\/(-?\d+)\/items$/)) {
        const orderId = parseInt(url.split('/')[2]);
        return await localAddItem(orderId, data);
      }

      // Send order (just mark items as sent locally)
      if (url.match(/^\/orders\/(-?\d+)\/send$/)) {
        const orderId = parseInt(url.split('/')[2]);
        const items = await db.orderItems.where('order_id').equals(orderId).toArray();
        for (const item of items) {
          if (item.status === 'pending') {
            await db.orderItems.update(item.id, { status: 'sent' });
          }
        }
        await db.orders.update(orderId, { status: 'sent' });
        return { message: 'Orden enviada (offline)' };
      }

      // Process payment
      if (url === '/payments') {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return await localProcessPayment(user.id || 1, data);
      }
    }

    // PUT requests
    if (method === 'PUT') {
      if (url.match(/^\/orders\/(-?\d+)\/items\/(-?\d+)$/)) {
        const parts = url.split('/');
        const orderId = parseInt(parts[2]);
        const itemId = parseInt(parts[4]);
        await localUpdateItem(orderId, itemId, data);
        return { message: 'Item actualizado (offline)' };
      }
    }

    // DELETE requests
    if (method === 'DELETE') {
      if (url.match(/^\/orders\/(-?\d+)\/items\/(-?\d+)$/)) {
        const parts = url.split('/');
        const orderId = parseInt(parts[2]);
        const itemId = parseInt(parts[4]);
        await localRemoveItem(orderId, itemId);
        return { message: 'Item eliminado (offline)' };
      }
    }
  } catch (err) {
    console.error('[offline] handler error:', err);
  }

  return null; // Can't handle offline
}
