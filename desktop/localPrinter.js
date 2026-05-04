const { ipcMain } = require('electron');
const net = require('net');
const os = require('os');
const { execSync } = require('child_process');

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
  if (addr.startsWith('tcp://') || addr.startsWith('printer:') || addr.startsWith('\\\\') || addr.startsWith('//') || addr.startsWith('/dev')) return addr;
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
    options: { timeout: 10000 },
  });
}

/**
 * Ejecuta un print con retry exponential backoff.
 * Las impresoras IP (EPSON térmicas) entran en modo sleep tras inactividad.
 * El primer paquete TCP falla con timeout porque tarda en despertar; el
 * segundo intento usualmente funciona.
 */
async function executeWithRetry(printer, target, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await printer.execute();
      if (attempt > 1) console.log(`[LOCAL-PRINTER:${target}] OK en intento ${attempt}/${maxAttempts}`);
      return;
    } catch (err) {
      lastError = err;
      const isTimeout = /timeout|ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH/i.test(err && err.message || '');
      console.warn(`[LOCAL-PRINTER:${target}] intento ${attempt}/${maxAttempts} falló: ${err && err.message}`);
      if (attempt < maxAttempts && isTimeout) {
        const wait = 400 * Math.pow(3, attempt - 1);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
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
                printer.println(`   > ${mod.name || mod.modifier_name || ''}`);
              }
            }
            if (item.notes) printer.println(`   * ${item.notes}`);
          }
          printer.drawLine();
          printer.cut();
          await executeWithRetry(printer, 'kitchen');
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
                printer.println(`   > ${mod.name || mod.modifier_name || ''}`);
              }
            }
            if (item.notes) printer.println(`   * ${item.notes}`);
          }
          printer.drawLine();
          printer.cut();
          await executeWithRetry(printer, 'bar');
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
            const modName = mod.name || mod.modifier_name || '';
            const modPrice = parseFloat(mod.price ?? mod.price_extra ?? 0);
            if (modPrice > 0) {
              printer.println(`   + ${modName} $${modPrice.toFixed(2)}`);
            } else {
              printer.println(`   > ${modName}`);
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
      await executeWithRetry(printer, 'cashier');
      return { status: 'printed' };
    } catch (err) {
      return { status: 'failed', error: err.message };
    }
  });

  ipcMain.handle('print:open-drawer', async (_event, data) => {
    const address = data?.address;
    const iface = resolvePrinterInterface(address);
    if (!iface) return { status: 'no_printer', message: 'No hay impresora de caja configurada' };
    try {
      const printer = createPrinter(iface);
      printer.openCashDrawer();
      await executeWithRetry(printer, 'cashier-drawer');
      return { status: 'ok' };
    } catch (err) {
      console.error('[LOCAL-PRINTER] open-drawer error:', err && err.message);
      return { status: 'error', message: err && err.message };
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
      await executeWithRetry(printer, target);
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  });

  // ─── Printer Scanner ───

  ipcMain.handle('printer:scan', async () => {
    // 1) Get local subnets
    const interfaces = os.networkInterfaces();
    const subnets = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          subnets.push({ base: `${parts[0]}.${parts[1]}.${parts[2]}`, localIp: iface.address });
        }
      }
    }

    // 2) Scan port 9100 on each subnet
    const networkPrinters = [];
    for (const subnet of subnets) {
      const BATCH = 50;
      for (let start = 1; start <= 254; start += BATCH) {
        const promises = [];
        for (let i = start; i < Math.min(start + BATCH, 255); i++) {
          const ip = `${subnet.base}.${i}`;
          if (ip === subnet.localIp) continue;
          promises.push(new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(600);
            socket.on('connect', () => { socket.destroy(); resolve(ip); });
            socket.on('timeout', () => { socket.destroy(); resolve(null); });
            socket.on('error',   () => { socket.destroy(); resolve(null); });
            socket.connect(9100, ip);
          }));
        }
        const results = await Promise.all(promises);
        networkPrinters.push(...results.filter(Boolean));
      }
    }

    // 3) Get Windows installed printers
    let localPrinters = [];
    try {
      const out = execSync(
        'powershell -Command "Get-Printer | Select-Object Name, PortName, DriverName | ConvertTo-Json -Compress"',
        { encoding: 'utf-8', timeout: 10000 }
      );
      const parsed = JSON.parse(out);
      localPrinters = (Array.isArray(parsed) ? parsed : [parsed]).filter(p => p && p.Name);
    } catch (e) {
      console.error('[SCANNER] Windows printers error:', e.message);
    }

    console.log(`[SCANNER] Found ${networkPrinters.length} network, ${localPrinters.length} local`);
    return { network: networkPrinters, local: localPrinters };
  });

  // ─── Printer Identification (print a big number) ───

  ipcMain.handle('printer:identify', async (_event, { address, number }) => {
    const iface = resolvePrinterInterface(address);
    if (!iface) throw new Error('Dirección inválida');

    const printer = createPrinter(iface);
    printer.alignCenter();
    printer.drawLine();
    printer.newLine();
    printer.setTextSize(3, 3);
    printer.bold(true);
    printer.println(`# ${number}`);
    printer.setTextNormal();
    printer.bold(false);
    printer.newLine();
    printer.bold(true);
    printer.println('IMPRESORA');
    printer.bold(false);
    printer.println(address);
    printer.newLine();
    printer.println('RestPOS - Configuracion');
    printer.println(new Date().toLocaleString('es-MX'));
    printer.drawLine();
    printer.cut();
    await printer.execute();
    return { status: 'ok' };
  });

  console.log('[LOCAL-PRINTER] Print handlers registered');
}

module.exports = { setupPrintHandlers };
