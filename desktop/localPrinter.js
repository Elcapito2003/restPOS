const { ipcMain } = require('electron');

let ThermalPrinter, PrinterTypes;
try {
  ThermalPrinter = require('node-thermal-printer').printer;
  PrinterTypes = require('node-thermal-printer').types;
} catch (e) {
  console.error('[LOCAL-PRINTER] node-thermal-printer not available:', e.message);
}

function resolvePrinterInterface(address) {
  if (!address || !address.trim()) return null;
  const addr = address.trim();
  if (addr.startsWith('tcp://') || addr.startsWith('printer:') || addr.startsWith('\\\\') || addr.startsWith('/dev')) return addr;
  if (/^COM\d+$/i.test(addr)) return `\\\\.\\${addr.toUpperCase()}`;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(addr)) {
    return `tcp://${addr.includes(':') ? addr : addr + ':9100'}`;
  }
  return `printer:${addr}`;
}

function createPrinter(iface) {
  return new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: iface,
    options: { timeout: 5000 },
  });
}

function setupPrintHandlers() {
  if (!ThermalPrinter) {
    console.error('[LOCAL-PRINTER] Cannot setup handlers - printer module not loaded');
    return;
  }

  ipcMain.handle('print:comanda', async (_event, data) => {
    const { order, items, printerSettings } = data;
    const results = [];

    // Determine which items go where
    const hasKitchen = !!resolvePrinterInterface(printerSettings.kitchen);
    const isKitchenTarget = (i) => i.printer_target === 'kitchen' || !i.printer_target;

    const kitchenItems = hasKitchen
      ? items.filter((i) => isKitchenTarget(i) || i.printer_target === 'both')
      : [];
    const barItems = items.filter((i) => {
      if (i.printer_target === 'bar' || i.printer_target === 'both') return true;
      if (!hasKitchen && isKitchenTarget(i)) return true;
      return false;
    });

    // Print to kitchen
    if (kitchenItems.length > 0) {
      const iface = resolvePrinterInterface(printerSettings.kitchen);
      if (iface) {
        try {
          const printer = createPrinter(iface);
          printer.alignCenter();
          printer.bold(true);
          printer.println('*** COMANDA COCINA ***');
          printer.bold(false);
          printer.drawLine();
          printer.alignLeft();
          printer.println(`Mesa: ${order.table_label || 'N/A'}  Orden: #${order.daily_number}`);
          printer.println(`Mesero: ${order.waiter_name || ''}`);
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
          results.push({ target: 'kitchen', status: 'printed' });
        } catch (err) {
          results.push({ target: 'kitchen', status: 'failed', error: err.message });
        }
      }
    }

    // Print to bar
    if (barItems.length > 0) {
      const iface = resolvePrinterInterface(printerSettings.bar);
      if (iface) {
        try {
          const printer = createPrinter(iface);
          printer.alignCenter();
          printer.bold(true);
          printer.println('*** COMANDA BAR ***');
          printer.bold(false);
          printer.drawLine();
          printer.alignLeft();
          printer.println(`Mesa: ${order.table_label || 'N/A'}  Orden: #${order.daily_number}`);
          printer.println(`Mesero: ${order.waiter_name || ''}`);
          printer.println(`Hora: ${new Date().toLocaleTimeString('es-MX')}`);
          printer.drawLine();
          for (const item of barItems) {
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
          results.push({ target: 'bar', status: 'printed' });
        } catch (err) {
          results.push({ target: 'bar', status: 'failed', error: err.message });
        }
      }
    }

    return results;
  });

  ipcMain.handle('print:receipt', async (_event, data) => {
    const { order, items, payments, restaurantName, printerSettings } = data;
    const iface = resolvePrinterInterface(printerSettings.cashier);
    if (!iface) return { status: 'no_printer', message: 'No hay impresora de caja configurada' };

    try {
      const printer = createPrinter(iface);
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(restaurantName || 'Restaurante');
      printer.setTextNormal();
      printer.bold(false);
      printer.println(`Orden #${order.daily_number}`);
      printer.println(new Date().toLocaleString('es-MX'));
      printer.drawLine();
      printer.alignLeft();
      printer.println(`Mesa: ${order.table_label || 'N/A'}`);
      printer.println(`Mesero: ${order.waiter_name || ''}`);
      printer.drawLine();

      for (const item of items) {
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

      if (payments && payments.length > 0) {
        printer.drawLine();
        for (const p of payments) {
          printer.println(`${p.method.toUpperCase()}: $${parseFloat(p.amount).toFixed(2)}`);
          if (parseFloat(p.change_amount) > 0) {
            printer.println(`Cambio: $${parseFloat(p.change_amount).toFixed(2)}`);
          }
        }
      }

      printer.drawLine();
      printer.alignCenter();
      printer.println('Gracias por su visita!');
      printer.cut();
      await printer.execute();
      return { status: 'printed' };
    } catch (err) {
      return { status: 'failed', error: err.message };
    }
  });

  ipcMain.handle('print:test', async (_event, data) => {
    const { target, address } = data;
    const iface = resolvePrinterInterface(address);
    if (!iface) return { status: 'no_printer', message: 'No hay impresora configurada para ' + target };

    try {
      const printer = createPrinter(iface);
      printer.alignCenter();
      printer.println('*** PRUEBA DE IMPRESORA ***');
      printer.println(`Destino: ${target}`);
      printer.println(new Date().toLocaleString('es-MX'));
      printer.cut();
      await printer.execute();
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  });

  console.log('[LOCAL-PRINTER] Print handlers registered');
}

module.exports = { setupPrintHandlers };
