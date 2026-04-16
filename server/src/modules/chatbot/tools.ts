import { query } from '../../config/database';

// ─── Tool Definitions for OpenAI Function Calling ───

export const toolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'query_inventory',
      description: 'Consultar inventario de insumos. Puede buscar por nombre o listar todo. Devuelve nombre, stock actual, stock mínimo, unidad y costo.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar por nombre de insumo (parcial). Omitir para listar todo.' },
          low_stock_only: { type: 'boolean', description: 'Solo mostrar insumos con stock bajo (stock <= stock_min)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'adjust_inventory',
      description: 'Registrar entrada, salida, merma o ajuste de inventario para un insumo.',
      parameters: {
        type: 'object',
        properties: {
          item_name: { type: 'string', description: 'Nombre del insumo (búsqueda parcial)' },
          type: { type: 'string', enum: ['entrada', 'salida', 'merma', 'ajuste'], description: 'Tipo de movimiento' },
          quantity: { type: 'number', description: 'Cantidad del movimiento' },
          reason: { type: 'string', description: 'Razón del movimiento (opcional)' },
        },
        required: ['item_name', 'type', 'quantity'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_products',
      description: 'Buscar productos del menú por nombre. Devuelve nombre, precio, categoría y disponibilidad.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar por nombre de producto (parcial)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_product',
      description: 'Actualizar precio o disponibilidad de un producto del menú.',
      parameters: {
        type: 'object',
        properties: {
          product_name: { type: 'string', description: 'Nombre del producto (búsqueda parcial)' },
          price: { type: 'number', description: 'Nuevo precio (opcional)' },
          is_available: { type: 'boolean', description: 'Cambiar disponibilidad (opcional)' },
        },
        required: ['product_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_suppliers',
      description: 'Listar proveedores o buscar por nombre. Devuelve nombre, teléfono, WhatsApp y productos que surte.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar por nombre de proveedor (parcial)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_supplier_order',
      description: 'Crear un pedido a un proveedor y enviarlo por WhatsApp. Especifica proveedor y lista de items con cantidades.',
      parameters: {
        type: 'object',
        properties: {
          supplier_name: { type: 'string', description: 'Nombre del proveedor (búsqueda parcial)' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                item_name: { type: 'string', description: 'Nombre del insumo' },
                quantity: { type: 'number', description: 'Cantidad a pedir' },
              },
              required: ['item_name', 'quantity'],
            },
            description: 'Lista de items a pedir',
          },
          notes: { type: 'string', description: 'Notas adicionales para el pedido' },
        },
        required: ['supplier_name', 'items'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_orders',
      description: 'Consultar pedidos a proveedores. Puede filtrar por estado o proveedor.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'sent', 'confirmed', 'received', 'cancelled'], description: 'Filtrar por estado' },
          supplier_name: { type: 'string', description: 'Filtrar por nombre de proveedor (parcial)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_sales_today',
      description: 'Obtener resumen de ventas del día: total de ventas, número de órdenes, ticket promedio, productos más vendidos.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_expenses',
      description: 'Consultar gastos. Puede filtrar por fecha o listar los recientes.',
      parameters: {
        type: 'object',
        properties: {
          days: { type: 'number', description: 'Últimos N días (default 7)' },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_memory',
      description: 'Guardar un dato importante para recordar en futuras conversaciones. Usa esto cuando el usuario te diga algo que debas recordar.',
      parameters: {
        type: 'object',
        properties: {
          fact: { type: 'string', description: 'El dato a recordar' },
          category: { type: 'string', enum: ['preference', 'context', 'instruction', 'contact', 'other'], description: 'Categoría del dato' },
        },
        required: ['fact', 'category'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'recall_memory',
      description: 'Buscar en la memoria datos guardados previamente sobre este usuario/sesión.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Buscar por texto (parcial). Omitir para listar todo.' },
        },
      },
    },
  },
];

// ─── Tool Implementations ───

export async function executeTool(name: string, args: any, sessionId: string): Promise<string> {
  try {
    switch (name) {
      case 'query_inventory': return await queryInventory(args);
      case 'adjust_inventory': return await adjustInventory(args);
      case 'query_products': return await queryProducts(args);
      case 'update_product': return await updateProduct(args);
      case 'query_suppliers': return await querySuppliers(args);
      case 'create_supplier_order': return await createSupplierOrder(args);
      case 'query_orders': return await queryOrders(args);
      case 'query_sales_today': return await querySalesToday();
      case 'query_expenses': return await queryExpenses(args);
      case 'save_memory': return await saveMemory(sessionId, args);
      case 'recall_memory': return await recallMemory(sessionId, args);
      default: return JSON.stringify({ error: `Tool desconocido: ${name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}

async function queryInventory(args: any): Promise<string> {
  let sql = `SELECT i.id, i.name, i.unit, i.stock, i.stock_min, i.current_cost,
    COALESCE(
      (SELECT json_agg(json_build_object('supplier', s.name, 'price', iis.price))
       FROM inventory_item_suppliers iis JOIN suppliers s ON s.id = iis.supplier_id
       WHERE iis.item_id = i.id), '[]'::json
    ) as suppliers
    FROM inventory_items i WHERE i.is_active = true`;
  const params: any[] = [];

  if (args.search) {
    params.push(`%${args.search}%`);
    sql += ` AND i.name ILIKE $${params.length}`;
  }
  if (args.low_stock_only) {
    sql += ` AND i.stock <= i.stock_min AND i.stock_min > 0`;
  }
  sql += ' ORDER BY i.name LIMIT 50';

  const result = await query(sql, params);
  if (result.rows.length === 0) return JSON.stringify({ message: 'No se encontraron insumos' });
  return JSON.stringify(result.rows.map(r => ({
    nombre: r.name, stock: Number(r.stock), stock_min: Number(r.stock_min),
    unidad: r.unit, costo: Number(r.current_cost), proveedores: r.suppliers,
  })));
}

async function adjustInventory(args: any): Promise<string> {
  // Find item by name
  const itemResult = await query(
    `SELECT id, name, stock, unit FROM inventory_items WHERE is_active = true AND name ILIKE $1 LIMIT 1`,
    [`%${args.item_name}%`]
  );
  if (itemResult.rows.length === 0) return JSON.stringify({ error: `No se encontró insumo "${args.item_name}"` });
  const item = itemResult.rows[0];

  const qty = args.type === 'entrada' || args.type === 'ajuste' ? Math.abs(args.quantity) : -Math.abs(args.quantity);

  await query(
    `INSERT INTO inventory_movements (item_id, type, quantity, reason) VALUES ($1, $2, $3, $4)`,
    [item.id, args.type, Math.abs(args.quantity), args.reason || null]
  );

  const newStock = Number(item.stock) + qty;
  await query(`UPDATE inventory_items SET stock = $1 WHERE id = $2`, [Math.max(0, newStock), item.id]);

  return JSON.stringify({
    message: `${args.type} registrada: ${args.quantity} ${item.unit} de ${item.name}`,
    stock_anterior: Number(item.stock),
    stock_nuevo: Math.max(0, newStock),
  });
}

async function queryProducts(args: any): Promise<string> {
  let sql = `SELECT p.id, p.name, p.price, p.is_available, c.name as category
    FROM products p JOIN categories c ON c.id = p.category_id`;
  const params: any[] = [];

  if (args.search) {
    params.push(`%${args.search}%`);
    sql += ` WHERE p.name ILIKE $${params.length}`;
  }
  sql += ' ORDER BY p.name LIMIT 30';

  const result = await query(sql, params);
  if (result.rows.length === 0) return JSON.stringify({ message: 'No se encontraron productos' });
  return JSON.stringify(result.rows.map(r => ({
    nombre: r.name, precio: Number(r.price), categoria: r.category, disponible: r.is_available,
  })));
}

async function updateProduct(args: any): Promise<string> {
  const prodResult = await query(
    `SELECT id, name, price, is_available FROM products WHERE name ILIKE $1 LIMIT 1`,
    [`%${args.product_name}%`]
  );
  if (prodResult.rows.length === 0) return JSON.stringify({ error: `No se encontró producto "${args.product_name}"` });
  const prod = prodResult.rows[0];

  const updates: string[] = [];
  const params: any[] = [prod.id];

  if (args.price !== undefined) {
    params.push(args.price);
    updates.push(`price = $${params.length}`);
  }
  if (args.is_available !== undefined) {
    params.push(args.is_available);
    updates.push(`is_available = $${params.length}`);
  }

  if (updates.length === 0) return JSON.stringify({ error: 'No se especificaron cambios' });

  await query(`UPDATE products SET ${updates.join(', ')} WHERE id = $1`, params);

  return JSON.stringify({
    message: `Producto "${prod.name}" actualizado`,
    cambios: {
      ...(args.price !== undefined ? { precio: { antes: Number(prod.price), despues: args.price } } : {}),
      ...(args.is_available !== undefined ? { disponible: { antes: prod.is_available, despues: args.is_available } } : {}),
    },
  });
}

async function querySuppliers(args: any): Promise<string> {
  let sql = `SELECT s.id, s.name, s.contact_name, s.phone, s.whatsapp,
    COALESCE(
      (SELECT json_agg(json_build_object('item', i.name, 'price', iis.price))
       FROM inventory_item_suppliers iis JOIN inventory_items i ON i.id = iis.item_id
       WHERE iis.supplier_id = s.id), '[]'::json
    ) as items
    FROM suppliers s WHERE s.is_active = true`;
  const params: any[] = [];

  if (args.search) {
    params.push(`%${args.search}%`);
    sql += ` AND s.name ILIKE $${params.length}`;
  }
  sql += ' ORDER BY s.name LIMIT 20';

  const result = await query(sql, params);
  if (result.rows.length === 0) return JSON.stringify({ message: 'No se encontraron proveedores' });
  return JSON.stringify(result.rows.map(r => ({
    nombre: r.name, contacto: r.contact_name, telefono: r.phone, whatsapp: r.whatsapp, productos: r.items,
  })));
}

async function createSupplierOrder(args: any): Promise<string> {
  // Find supplier
  const supResult = await query(
    `SELECT id, name, whatsapp FROM suppliers WHERE is_active = true AND name ILIKE $1 LIMIT 1`,
    [`%${args.supplier_name}%`]
  );
  if (supResult.rows.length === 0) return JSON.stringify({ error: `No se encontró proveedor "${args.supplier_name}"` });
  const supplier = supResult.rows[0];
  if (!supplier.whatsapp) return JSON.stringify({ error: `El proveedor "${supplier.name}" no tiene WhatsApp registrado` });

  // Resolve items
  const resolvedItems: any[] = [];
  for (const item of args.items) {
    const itemResult = await query(
      `SELECT i.id, i.name, i.unit, COALESCE(iis.price, i.current_cost, 0) as price
       FROM inventory_items i
       LEFT JOIN inventory_item_suppliers iis ON iis.item_id = i.id AND iis.supplier_id = $1
       WHERE i.is_active = true AND i.name ILIKE $2 LIMIT 1`,
      [supplier.id, `%${item.item_name}%`]
    );
    if (itemResult.rows.length === 0) {
      resolvedItems.push({
        item_id: 0, item_name: item.item_name, quantity: item.quantity,
        unit: 'pz', estimated_price: 0,
      });
    } else {
      const inv = itemResult.rows[0];
      resolvedItems.push({
        item_id: inv.id, item_name: inv.name, quantity: item.quantity,
        unit: inv.unit, estimated_price: Number(inv.price),
      });
    }
  }

  const estimatedTotal = resolvedItems.reduce((s, i) => s + i.estimated_price * i.quantity, 0);

  // Create order
  const orderResult = await query(
    `INSERT INTO supplier_orders (supplier_id, notes, estimated_total, created_by)
     VALUES ($1, $2, $3, 1) RETURNING id`,
    [supplier.id, args.notes || null, estimatedTotal]
  );
  const orderId = orderResult.rows[0].id;

  for (const item of resolvedItems) {
    await query(
      `INSERT INTO supplier_order_items (order_id, item_id, item_name, quantity, unit, estimated_price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [orderId, item.item_id || null, item.item_name, item.quantity, item.unit, item.estimated_price]
    );
  }

  // Send via WhatsApp
  const { sendWhatsApp } = await import('../purchasing/openclaw');
  const lines = resolvedItems.map(i => `- ${i.item_name}: ${i.quantity} ${i.unit}`);
  const message = [
    `Hola ${supplier.name}, buen dia.`,
    `Quisiera hacer un pedido:`,
    '', ...lines, '',
    `Me podria confirmar disponibilidad y precio por favor? Gracias.`,
  ].join('\n');

  try {
    await sendWhatsApp(supplier.whatsapp, message);
    await query(`UPDATE supplier_orders SET status = 'sent', sent_at = NOW() WHERE id = $1`, [orderId]);

    // Save outgoing message
    await query(
      `INSERT INTO whatsapp_messages (order_id, supplier_id, direction, message, phone, status)
       VALUES ($1, $2, 'out', $3, $4, 'sent')`,
      [orderId, supplier.id, message, supplier.whatsapp]
    );
  } catch {
    // Order created but WhatsApp send failed
  }

  return JSON.stringify({
    message: `Pedido #${orderId} creado y enviado a ${supplier.name} por WhatsApp`,
    items: resolvedItems.map(i => `${i.item_name} x${i.quantity} ${i.unit}`),
    total_estimado: estimatedTotal,
  });
}

async function queryOrders(args: any): Promise<string> {
  let sql = `SELECT o.id, o.status, o.estimated_total, o.created_at, s.name as supplier_name,
    COALESCE(
      (SELECT json_agg(json_build_object('item', oi.item_name, 'qty', oi.quantity, 'unit', oi.unit))
       FROM supplier_order_items oi WHERE oi.order_id = o.id), '[]'::json
    ) as items
    FROM supplier_orders o JOIN suppliers s ON s.id = o.supplier_id WHERE 1=1`;
  const params: any[] = [];

  if (args.status) {
    params.push(args.status);
    sql += ` AND o.status = $${params.length}`;
  }
  if (args.supplier_name) {
    params.push(`%${args.supplier_name}%`);
    sql += ` AND s.name ILIKE $${params.length}`;
  }
  sql += ' ORDER BY o.created_at DESC LIMIT 20';

  const result = await query(sql, params);
  if (result.rows.length === 0) return JSON.stringify({ message: 'No se encontraron pedidos' });
  return JSON.stringify(result.rows.map(r => ({
    pedido: r.id, proveedor: r.supplier_name, estado: r.status,
    total_estimado: Number(r.estimated_total), fecha: r.created_at, items: r.items,
  })));
}

async function querySalesToday(): Promise<string> {
  const salesResult = await query(`
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(total), 0) as total_sales,
      COALESCE(AVG(total), 0) as avg_ticket
    FROM orders
    WHERE status = 'closed' AND DATE(created_at) = CURRENT_DATE
  `);
  const topProducts = await query(`
    SELECT oi.product_name, SUM(oi.quantity) as qty, SUM(oi.unit_price * oi.quantity) as total
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'closed' AND DATE(o.created_at) = CURRENT_DATE
    GROUP BY oi.product_name ORDER BY qty DESC LIMIT 10
  `);

  const sales = salesResult.rows[0];
  return JSON.stringify({
    ordenes_hoy: Number(sales.total_orders),
    venta_total: Number(sales.total_sales),
    ticket_promedio: Number(Number(sales.avg_ticket).toFixed(2)),
    top_productos: topProducts.rows.map(r => ({
      producto: r.name, cantidad: Number(r.qty), total: Number(r.total),
    })),
  });
}

async function queryExpenses(args: any): Promise<string> {
  const days = Math.max(1, Math.min(365, Number(args.days) || 7));
  const result = await query(`
    SELECT e.id, e.description, e.amount, e.created_at, u.display_name as user_name
    FROM expenses e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.created_at >= NOW() - make_interval(days => $1)
    ORDER BY e.created_at DESC LIMIT 30
  `, [days]);

  const totalResult = await query(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses WHERE created_at >= NOW() - make_interval(days => $1)
  `, [days]);

  return JSON.stringify({
    periodo: `últimos ${days} días`,
    total_gastos: Number(totalResult.rows[0].total),
    gastos: result.rows.map(r => ({
      descripcion: r.description, monto: Number(r.amount),
      fecha: r.created_at, usuario: r.user_name,
    })),
  });
}

async function saveMemory(sessionId: string, args: any): Promise<string> {
  await query(
    `INSERT INTO chatbot_memory (session_id, fact, category) VALUES ($1, $2, $3)`,
    [sessionId, args.fact, args.category]
  );
  return JSON.stringify({ message: `Memorizado: "${args.fact}"` });
}

async function recallMemory(sessionId: string, args: any): Promise<string> {
  let sql = `SELECT fact, category, created_at FROM chatbot_memory WHERE session_id = $1`;
  const params: any[] = [sessionId];

  if (args.search) {
    params.push(`%${args.search}%`);
    sql += ` AND fact ILIKE $${params.length}`;
  }
  sql += ' ORDER BY created_at DESC LIMIT 20';

  const result = await query(sql, params);
  if (result.rows.length === 0) return JSON.stringify({ message: 'No hay recuerdos guardados para esta sesión' });
  return JSON.stringify(result.rows.map(r => ({
    dato: r.fact, categoria: r.category, fecha: r.created_at,
  })));
}
