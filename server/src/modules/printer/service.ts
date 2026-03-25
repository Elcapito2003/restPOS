import { query } from '../../config/database';

async function getPrinterSettings(): Promise<{ kitchen: string; bar: string; cashier: string }> {
  const result = await query(`SELECT key, value FROM settings WHERE key IN ('printer_kitchen_ip','printer_bar_ip','printer_cashier_ip')`);
  const settings: any = {};
  for (const row of result.rows) {
    if (row.key === 'printer_kitchen_ip') settings.kitchen = row.value;
    if (row.key === 'printer_bar_ip') settings.bar = row.value;
    if (row.key === 'printer_cashier_ip') settings.cashier = row.value;
  }
  return settings;
}

/**
 * Resolves a printer address to the interface string for node-thermal-printer.
 * Supports:
 *   - TCP:        "tcp://192.168.1.100:9100"
 *   - COM port:   "COM3" or "\\.\COM3"
 *   - Printer name (Windows): "printer:POS-80"
 *   - UNC share:  "\\\\localhost\\PrinterName"
 *   - Raw IP (legacy): "192.168.1.100" → treated as tcp://192.168.1.100:9100
 */
function resolvePrinterInterface(address: string): string | null {
  if (!address || !address.trim()) return null;
  const addr = address.trim();

  // Already has a protocol/prefix → use as-is
  if (addr.startsWith('tcp://') || addr.startsWith('printer:') || addr.startsWith('\\\\') || addr.startsWith('/dev')) {
    return addr;
  }

  // COM port shorthand: "COM3" → "\\.\COM3"
  if (/^COM\d+$/i.test(addr)) {
    return `\\\\.\\${addr.toUpperCase()}`;
  }

  // Raw IP (legacy compat): "192.168.1.100" or "192.168.1.100:9100"
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(addr)) {
    const hasPort = addr.includes(':');
    return `tcp://${hasPort ? addr : addr + ':9100'}`;
  }

  // Anything else → assume it's a Windows printer name
  return `printer:${addr}`;
}

async function logPrintJob(type: string, printerTarget: string, orderId: number | null, status: string, errorMessage?: string) {
  await query(
    'INSERT INTO print_jobs (type, printer_target, order_id, status, error_message) VALUES ($1,$2,$3,$4,$5)',
    [type, printerTarget, orderId, status, errorMessage || null]
  );
}

export async function printComanda(orderId: number) {
  const orderResult = await query(`
    SELECT o.*, t.label as table_label, u.display_name as waiter_name
    FROM orders o LEFT JOIN tables t ON o.table_id = t.id LEFT JOIN users u ON o.waiter_id = u.id
    WHERE o.id = $1
  `, [orderId]);

  if (orderResult.rows.length === 0) throw new Error('Orden no encontrada');
  const order = orderResult.rows[0];

  const items = await query(`
    SELECT oi.*, json_agg(json_build_object('name', oim.modifier_name, 'price', oim.price_extra))
      FILTER (WHERE oim.id IS NOT NULL) as modifiers
    FROM order_items oi LEFT JOIN order_item_modifiers oim ON oim.order_item_id = oi.id
    WHERE oi.order_id = $1 AND oi.status = 'sent'
    GROUP BY oi.id
  `, [orderId]);

  const settings = await getPrinterSettings();

  // Group items by printer target
  const kitchenItems = items.rows.filter((i: any) => i.printer_target === 'kitchen' || i.printer_target === 'both');
  const barItems = items.rows.filter((i: any) => i.printer_target === 'bar' || i.printer_target === 'both');

  const results: any[] = [];

  if (kitchenItems.length > 0) {
    const iface = resolvePrinterInterface(settings.kitchen);
    if (iface) {
      try {
        const ThermalPrinter = require('node-thermal-printer').printer;
        const PrinterTypes = require('node-thermal-printer').types;
        const printer = new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: iface,
          options: { timeout: 5000 },
        });

        printer.alignCenter();
        printer.bold(true);
        printer.println('*** COMANDA COCINA ***');
        printer.bold(false);
        printer.drawLine();
        printer.alignLeft();
        printer.println(`Mesa: ${order.table_label || 'N/A'}  Orden: #${order.daily_number}`);
        printer.println(`Mesero: ${order.waiter_name}`);
        printer.println(`Hora: ${new Date().toLocaleTimeString('es-MX')}`);
        printer.drawLine();

        for (const item of kitchenItems) {
          printer.bold(true);
          printer.println(`${item.quantity}x ${item.product_name}`);
          printer.bold(false);
          if (item.modifiers) {
            for (const mod of item.modifiers) {
              printer.println(`   > ${mod.name}`);
            }
          }
          if (item.notes) printer.println(`   * ${item.notes}`);
        }

        printer.drawLine();
        printer.cut();
        await printer.execute();
        await logPrintJob('comanda', 'kitchen', orderId, 'printed');
        results.push({ target: 'kitchen', status: 'printed' });
      } catch (err: any) {
        await logPrintJob('comanda', 'kitchen', orderId, 'failed', err.message);
        results.push({ target: 'kitchen', status: 'failed', error: err.message });
      }
    } else {
      console.log('[PRINTER] Kitchen comanda (no printer configured):');
      console.log(`  Mesa: ${order.table_label} | Orden: #${order.daily_number}`);
      kitchenItems.forEach((i: any) => console.log(`  ${i.quantity}x ${i.product_name}`));
      await logPrintJob('comanda', 'kitchen', orderId, 'printed');
      results.push({ target: 'kitchen', status: 'logged' });
    }
  }

  if (barItems.length > 0) {
    const iface = resolvePrinterInterface(settings.bar);
    if (iface) {
      try {
        const ThermalPrinter = require('node-thermal-printer').printer;
        const PrinterTypes = require('node-thermal-printer').types;
        const printer = new ThermalPrinter({
          type: PrinterTypes.EPSON,
          interface: iface,
          options: { timeout: 5000 },
        });

        printer.alignCenter();
        printer.bold(true);
        printer.println('*** COMANDA BAR ***');
        printer.bold(false);
        printer.drawLine();
        printer.alignLeft();
        printer.println(`Mesa: ${order.table_label || 'N/A'}  Orden: #${order.daily_number}`);
        printer.drawLine();

        for (const item of barItems) {
          printer.bold(true);
          printer.println(`${item.quantity}x ${item.product_name}`);
          printer.bold(false);
          if (item.notes) printer.println(`   * ${item.notes}`);
        }

        printer.drawLine();
        printer.cut();
        await printer.execute();
        await logPrintJob('comanda', 'bar', orderId, 'printed');
        results.push({ target: 'bar', status: 'printed' });
      } catch (err: any) {
        await logPrintJob('comanda', 'bar', orderId, 'failed', err.message);
        results.push({ target: 'bar', status: 'failed', error: err.message });
      }
    } else {
      console.log('[PRINTER] Bar comanda (no printer configured):');
      barItems.forEach((i: any) => console.log(`  ${i.quantity}x ${i.product_name}`));
      await logPrintJob('comanda', 'bar', orderId, 'printed');
      results.push({ target: 'bar', status: 'logged' });
    }
  }

  return results;
}

export async function printReceipt(orderId: number) {
  const orderResult = await query(`
    SELECT o.*, t.label as table_label, u.display_name as waiter_name
    FROM orders o LEFT JOIN tables t ON o.table_id = t.id LEFT JOIN users u ON o.waiter_id = u.id
    WHERE o.id = $1
  `, [orderId]);

  if (orderResult.rows.length === 0) throw new Error('Orden no encontrada');
  const order = orderResult.rows[0];

  const items = await query(`
    SELECT oi.*, json_agg(json_build_object('name', oim.modifier_name, 'price', oim.price_extra))
      FILTER (WHERE oim.id IS NOT NULL) as modifiers
    FROM order_items oi LEFT JOIN order_item_modifiers oim ON oim.order_item_id = oi.id
    WHERE oi.order_id = $1 AND oi.status != 'cancelled'
    GROUP BY oi.id
  `, [orderId]);

  const payments = await query('SELECT * FROM payments WHERE order_id = $1', [orderId]);

  const restaurantName = (await query(`SELECT value FROM settings WHERE key = 'restaurant_name'`)).rows[0]?.value || 'Restaurante';

  const settings = await getPrinterSettings();
  const iface = resolvePrinterInterface(settings.cashier);
  if (iface) {
    try {
      const ThermalPrinter = require('node-thermal-printer').printer;
      const PrinterTypes = require('node-thermal-printer').types;
      const printer = new ThermalPrinter({
        type: PrinterTypes.EPSON,
        interface: iface,
        options: { timeout: 5000 },
      });

      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(restaurantName);
      printer.setTextNormal();
      printer.bold(false);
      printer.println(`Orden #${order.daily_number}`);
      printer.println(new Date().toLocaleString('es-MX'));
      printer.drawLine();
      printer.alignLeft();
      printer.println(`Mesa: ${order.table_label || 'N/A'}`);
      printer.println(`Mesero: ${order.waiter_name}`);
      printer.drawLine();

      for (const item of items.rows) {
        const lineTotal = (parseFloat(item.unit_price) * item.quantity).toFixed(2);
        printer.tableCustom([
          { text: `${item.quantity}x ${item.product_name}`, align: 'LEFT', width: 0.7 },
          { text: `$${lineTotal}`, align: 'RIGHT', width: 0.3 },
        ]);
        if (item.modifiers) {
          for (const mod of item.modifiers) {
            if (parseFloat(mod.price) > 0) {
              printer.println(`   + ${mod.name} $${parseFloat(mod.price).toFixed(2)}`);
            } else {
              printer.println(`   > ${mod.name}`);
            }
          }
        }
      }

      printer.drawLine();
      printer.tableCustom([
        { text: 'Subtotal:', align: 'LEFT', width: 0.6 },
        { text: `$${parseFloat(order.subtotal).toFixed(2)}`, align: 'RIGHT', width: 0.4 },
      ]);
      if (parseFloat(order.discount_amount) > 0) {
        printer.tableCustom([
          { text: `Descuento (${order.discount_percent}%):`, align: 'LEFT', width: 0.6 },
          { text: `-$${parseFloat(order.discount_amount).toFixed(2)}`, align: 'RIGHT', width: 0.4 },
        ]);
      }
      printer.tableCustom([
        { text: 'IVA:', align: 'LEFT', width: 0.6 },
        { text: `$${parseFloat(order.tax).toFixed(2)}`, align: 'RIGHT', width: 0.4 },
      ]);
      if (parseFloat(order.tip) > 0) {
        printer.tableCustom([
          { text: 'Propina:', align: 'LEFT', width: 0.6 },
          { text: `$${parseFloat(order.tip).toFixed(2)}`, align: 'RIGHT', width: 0.4 },
        ]);
      }
      printer.bold(true);
      printer.tableCustom([
        { text: 'TOTAL:', align: 'LEFT', width: 0.6 },
        { text: `$${parseFloat(order.total).toFixed(2)}`, align: 'RIGHT', width: 0.4 },
      ]);
      printer.bold(false);

      if (payments.rows.length > 0) {
        printer.drawLine();
        for (const p of payments.rows) {
          printer.println(`${p.method.toUpperCase()}: $${parseFloat(p.amount).toFixed(2)}`);
          if (parseFloat(p.change_amount) > 0) {
            printer.println(`Cambio: $${parseFloat(p.change_amount).toFixed(2)}`);
          }
        }
      }

      printer.drawLine();
      printer.alignCenter();
      printer.println('¡Gracias por su visita!');
      printer.cut();
      await printer.execute();
      await logPrintJob('receipt', 'cashier', orderId, 'printed');
      return { status: 'printed' };
    } catch (err: any) {
      await logPrintJob('receipt', 'cashier', orderId, 'failed', err.message);
      return { status: 'failed', error: err.message };
    }
  } else {
    console.log(`[PRINTER] Receipt for order #${order.daily_number} (no printer configured)`);
    console.log(`  Subtotal: $${order.subtotal} | Tax: $${order.tax} | Total: $${order.total}`);
    await logPrintJob('receipt', 'cashier', orderId, 'printed');
    return { status: 'logged' };
  }
}

export async function testPrinter(target: string) {
  const settings = await getPrinterSettings();
  const address = (settings as any)[target];
  const iface = resolvePrinterInterface(address);
  if (!iface) return { status: 'no_printer', message: 'No hay impresora configurada para ' + target };

  try {
    const ThermalPrinter = require('node-thermal-printer').printer;
    const PrinterTypes = require('node-thermal-printer').types;
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: iface,
      options: { timeout: 5000 },
    });
    printer.alignCenter();
    printer.println('*** PRUEBA DE IMPRESORA ***');
    printer.println(`Destino: ${target}`);
    printer.println(new Date().toLocaleString('es-MX'));
    printer.cut();
    await printer.execute();
    await logPrintJob('test', target, null, 'printed');
    return { status: 'ok' };
  } catch (err: any) {
    await logPrintJob('test', target, null, 'failed', err.message);
    return { status: 'error', message: err.message };
  }
}

export async function getStatus() {
  const settings = await getPrinterSettings();
  return {
    kitchen: { configured: !!settings.kitchen, address: settings.kitchen || 'No configurada' },
    bar: { configured: !!settings.bar, address: settings.bar || 'No configurada' },
    cashier: { configured: !!settings.cashier, address: settings.cashier || 'No configurada' },
  };
}
