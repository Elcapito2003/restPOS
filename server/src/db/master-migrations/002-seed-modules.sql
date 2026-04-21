-- Module catalog seed
INSERT INTO modules (id, name, description, is_core, sort_order) VALUES
  ('pos',          'Punto de Venta',          'Ventas, órdenes, cobros, mesas, cocina', true,  1),
  ('inventory',    'Inventario',              'Control de insumos, stock, movimientos', false, 2),
  ('productions',  'Producciones',            'Recetas internas, ejecución, auto-deducción', false, 3),
  ('suppliers',    'Proveedores / Compras',   'Proveedores, pedidos WhatsApp, recepciones, pagos', false, 4),
  ('mercadolibre', 'MercadoLibre',            'Búsqueda y compra de productos en ML', false, 5),
  ('banking',      'Banca / Transferencias',  'Integración bancaria (Banregio)', false, 6),
  ('chatbot',      'Asistente AI',            'Chatbot interno + WhatsApp via OpenClaw', false, 7),
  ('offline',      'Modo Offline',            'Ventas sin internet con sincronización', false, 8),
  ('reports',      'Reportes Avanzados',      'Reportes por período, mesero, categoría, etc.', false, 9),
  ('clients',      'Clientes / CRM',          'Gestión de clientes', false, 10)
ON CONFLICT (id) DO NOTHING;
