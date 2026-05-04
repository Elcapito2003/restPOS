import api from '../config/api';
import toast from 'react-hot-toast';

/**
 * Abre el cajón monedero conectado a la impresora térmica de caja vía
 * pulso ESC/POS. Funciona sólo en Electron (necesita acceso a la red LAN
 * de las impresoras). En navegador web es no-op.
 */
export async function openCashDrawer(opts: { silent?: boolean } = {}): Promise<boolean> {
  const ep = (window as any).electronPrint;
  if (!ep?.openCashDrawer) {
    if (!opts.silent) toast.error('Esta acción solo funciona en la app de escritorio');
    return false;
  }
  try {
    const settingsRes = await api.get('/settings');
    const s = settingsRes.data;
    const address = s.printer_cashier_ip || '';
    if (!address) {
      if (!opts.silent) toast.error('Configura la impresora de caja en Configuración → Impresoras');
      return false;
    }
    const result = await ep.openCashDrawer({ address });
    if (result?.status === 'ok') {
      if (!opts.silent) toast.success('Cajón abierto');
      return true;
    }
    if (!opts.silent) toast.error(result?.message || 'No se pudo abrir el cajón');
    return false;
  } catch (err: any) {
    if (!opts.silent) toast.error('Error: ' + (err?.message || ''));
    return false;
  }
}
