import api from '../config/api';
import { db } from './db';

/**
 * Sync reference data from server to local IndexedDB.
 * Called on app startup when online, and after reconnection.
 */
export async function syncCacheFromServer(): Promise<void> {
  try {
    // Don't sync if not authenticated
    const token = localStorage.getItem('token');
    if (!token) { console.log('[offline] skipping cache sync - not authenticated'); return; }

    console.log('[offline] syncing cache from server...');

    // Fetch all reference data in parallel
    const [productsRes, categoriesRes, floorsRes, usersRes] = await Promise.all([
      api.get('/products').catch(() => ({ data: [] })),
      api.get('/categories').catch(() => ({ data: [] })),
      api.get('/floors').catch(() => ({ data: [] })),
      api.get('/auth/users').catch(() => ({ data: [] })),
    ]);

    // Products with category names
    const categories = categoriesRes.data || [];
    const catMap = new Map(categories.map((c: any) => [c.id, c.name]));
    const products = (productsRes.data || []).map((p: any) => ({
      id: p.id, name: p.name, price: Number(p.price), tax_rate: Number(p.tax_rate || 0.16),
      category_id: p.category_id, category_name: catMap.get(p.category_id) || '',
      is_available: p.is_available, printer_target: p.printer_target || '',
      sort_order: p.sort_order || 0,
    }));

    // Categories
    const cats = categories.map((c: any) => ({
      id: c.id, name: c.name, parent_id: c.parent_id,
      color: c.color || '#6366F1', printer_target: c.printer_target || 'kitchen',
      sort_order: c.sort_order || 0,
    }));

    // Floors and tables
    const floors = (floorsRes.data || []).map((f: any) => ({
      id: f.id, name: f.name, sort_order: f.sort_order || 0,
    }));

    // Fetch tables for each floor
    let allTables: any[] = [];
    for (const floor of floors) {
      try {
        const tablesRes = await api.get(`/floors/${floor.id}/tables`);
        const tables = (tablesRes.data || []).map((t: any) => ({
          id: t.id, floor_id: t.floor_id, label: t.label, capacity: t.capacity || 4,
          pos_x: t.pos_x || 0, pos_y: t.pos_y || 0, width: t.width || 80,
          height: t.height || 80, shape: t.shape || 'rect',
          status: t.status || 'free', current_order_id: t.current_order_id,
        }));
        allTables = [...allTables, ...tables];
      } catch {}
    }

    // Users
    const users = (usersRes.data || []).map((u: any) => ({
      id: u.id, username: u.username, display_name: u.display_name,
      role: u.role, avatar_color: u.avatar_color || '#3B82F6',
    }));

    // Write all to IndexedDB (clear and replace)
    await db.transaction('rw', [db.products, db.categories, db.floors, db.tables, db.users, db.meta], async () => {
      await db.products.clear();
      await db.categories.clear();
      await db.floors.clear();
      await db.tables.clear();
      await db.users.clear();

      if (products.length) await db.products.bulkPut(products);
      if (cats.length) await db.categories.bulkPut(cats);
      if (floors.length) await db.floors.bulkPut(floors);
      if (allTables.length) await db.tables.bulkPut(allTables);
      if (users.length) await db.users.bulkPut(users);

      await db.meta.put({ key: 'lastCacheSync', value: new Date().toISOString() });
    });

    console.log(`[offline] cache synced: ${products.length} products, ${cats.length} categories, ${allTables.length} tables, ${users.length} users`);
  } catch (err) {
    console.error('[offline] cache sync failed:', err);
  }
}

/**
 * Check if cache needs refreshing (older than 1 hour)
 */
export async function isCacheStale(): Promise<boolean> {
  const entry = await db.meta.get('lastCacheSync');
  if (!entry) return true;
  const lastSync = new Date(entry.value).getTime();
  return Date.now() - lastSync > 60 * 60 * 1000; // 1 hour
}

/**
 * Cache active orders from server
 */
export async function cacheActiveOrders(): Promise<void> {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await api.get('/orders?status=open,sent,partial');
    const orders = res.data || [];
    for (const o of orders) {
      await db.orders.put({
        id: o.id, daily_number: o.daily_number, table_id: o.table_id,
        waiter_id: o.waiter_id, status: o.status,
        subtotal: Number(o.subtotal), tax: Number(o.tax),
        discount_percent: Number(o.discount_percent || 0),
        discount_amount: Number(o.discount_amount || 0),
        tip: Number(o.tip || 0), total: Number(o.total),
        guest_count: o.guest_count || 0, notes: o.notes || '',
        order_type: o.order_type || 'dine_in',
        created_at: o.created_at, updated_at: o.updated_at,
        closed_at: o.closed_at, _offline: false, _tempId: '',
      });

      // Cache order items
      if (o.items) {
        for (const item of o.items) {
          await db.orderItems.put({
            id: item.id, order_id: o.id, product_id: item.product_id,
            product_name: item.product_name, quantity: item.quantity,
            unit_price: Number(item.unit_price), tax_rate: Number(item.tax_rate || 0.16),
            notes: item.notes || '', status: item.status,
            printer_target: item.printer_target || '',
            created_at: item.created_at, _offline: false, _tempId: '',
          });
        }
      }
    }
  } catch {}
}
