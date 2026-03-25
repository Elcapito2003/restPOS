import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import dayjs from 'dayjs';
import { PAYMENT_METHODS } from '../config/constants';
import { Printer, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CorteZPage() {
  const qc = useQueryClient();
  const [result, setResult] = useState<any>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const corteZMutation = useMutation({
    mutationFn: () => api.post('/cash-register/corte-z').then(r => r.data),
    onSuccess: (data) => {
      setResult(data);
      setShowConfirm(false);
      qc.invalidateQueries({ queryKey: ['cash-register'] });
      toast.success('Corte Z realizado exitosamente');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Error al realizar Corte Z');
      setShowConfirm(false);
    },
  });

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="card p-8 w-full max-w-md text-center">
          <AlertTriangle size={48} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">Corte Z - Cierre del Día</h2>
          <p className="text-gray-500 text-sm mb-2">
            El Corte Z cierra definitivamente la caja del día.
          </p>
          <ul className="text-sm text-left text-gray-600 mb-6 space-y-1">
            <li>- Cierra la caja registradora actual</li>
            <li>- Genera el reporte final del turno/día</li>
            <li>- Requiere que todas las cuentas estén cerradas</li>
            <li>- Esta acción no se puede deshacer</li>
          </ul>
          <button
            onClick={() => setShowConfirm(true)}
            disabled={corteZMutation.isPending}
            className="btn-danger w-full"
          >
            {corteZMutation.isPending ? 'Procesando...' : 'Realizar Corte Z'}
          </button>
        </div>

        {/* Confirmation modal */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-sm p-4 text-center">
              <AlertTriangle size={40} className="mx-auto text-red-500 mb-3" />
              <h3 className="font-bold mb-2">Confirmar Corte Z</h3>
              <p className="text-sm text-gray-600 mb-4">
                Esta acción cerrará la caja y generará el reporte de cierre definitivo del día.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={() => corteZMutation.mutate()}
                  disabled={corteZMutation.isPending}
                  className="btn-danger flex-1"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show the Corte Z result
  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">Corte Z - Cierre del Día</h2>
          <p className="text-sm text-gray-500">
            Cerrado el {dayjs(result.timestamp).format('DD/MM/YYYY HH:mm:ss')}
          </p>
        </div>
        <button onClick={() => window.print()} className="btn-primary text-sm gap-1"><Printer size={16} /> Imprimir</button>
      </div>

      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
        Corte Z completado. La caja ha sido cerrada exitosamente.
      </div>

      {/* Summary */}
      <div className="card p-4">
        <h3 className="font-bold mb-3 border-b pb-2">Resumen de Caja</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">Apertura de caja:</span>
          <span className="text-right font-medium">{dayjs(result.register.opened_at).format('DD/MM/YYYY HH:mm')}</span>
          <span className="text-gray-500">Cierre de caja:</span>
          <span className="text-right font-medium">{dayjs(result.timestamp).format('DD/MM/YYYY HH:mm')}</span>
          <span className="text-gray-500">Fondo inicial:</span>
          <span className="text-right font-medium">${result.opening_amount.toFixed(2)}</span>
          <span className="text-gray-500">Ventas en efectivo:</span>
          <span className="text-right font-medium">${result.cash_sales.toFixed(2)}</span>
          <span className="text-gray-500">Entradas de efectivo:</span>
          <span className="text-right font-medium text-emerald-600">+${result.movements_in.toFixed(2)}</span>
          <span className="text-gray-500">Salidas de efectivo:</span>
          <span className="text-right font-medium text-red-600">-${result.movements_out.toFixed(2)}</span>
          <div className="col-span-2 border-t my-1" />
          <span className="font-bold">Efectivo en caja:</span>
          <span className="text-right font-bold text-lg">${result.expected_cash.toFixed(2)}</span>
        </div>
      </div>

      {/* By method */}
      <div className="card p-4">
        <h3 className="font-bold mb-3 border-b pb-2">Desglose por Método de Pago</h3>
        <div className="space-y-2">
          {result.by_method?.map((m: any) => (
            <div key={m.method} className="flex justify-between text-sm">
              <span>{PAYMENT_METHODS[m.method as keyof typeof PAYMENT_METHODS] || m.method} ({m.count})</span>
              <span className="font-medium">${parseFloat(m.total).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total todas las formas de pago</span>
            <span>${result.total_all_methods.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Orders */}
      <div className="card p-4">
        <h3 className="font-bold mb-3 border-b pb-2">Ordenes del Día</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-500">Total ordenes:</span>
          <span className="text-right">{result.orders?.total_orders || 0}</span>
          <span className="text-gray-500">Cerradas:</span>
          <span className="text-right">{result.orders?.closed_orders || 0}</span>
          <span className="text-gray-500">Canceladas:</span>
          <span className="text-right text-red-600">{result.orders?.cancelled_orders || 0}</span>
          <div className="col-span-2 border-t my-1" />
          <span className="text-gray-500">Subtotal:</span>
          <span className="text-right">${parseFloat(result.orders?.total_subtotal || '0').toFixed(2)}</span>
          <span className="text-gray-500">IVA:</span>
          <span className="text-right">${parseFloat(result.orders?.total_tax || '0').toFixed(2)}</span>
          <span className="text-gray-500">Descuentos:</span>
          <span className="text-right text-red-600">-${parseFloat(result.orders?.total_discounts || '0').toFixed(2)}</span>
          <span className="text-gray-500">Propinas:</span>
          <span className="text-right">${parseFloat(result.orders?.total_tips || '0').toFixed(2)}</span>
          <span className="font-bold">Ventas totales:</span>
          <span className="text-right font-bold text-lg">${parseFloat(result.orders?.total_sales || '0').toFixed(2)}</span>
        </div>
      </div>

      {/* By waiter */}
      {result.by_waiter?.length > 0 && (
        <div className="card p-4">
          <h3 className="font-bold mb-3 border-b pb-2">Por Mesero</h3>
          <div className="space-y-2">
            {result.by_waiter.map((w: any) => (
              <div key={w.display_name} className="flex justify-between text-sm">
                <span>{w.display_name} ({w.orders} ord.)</span>
                <span className="font-medium">${parseFloat(w.total).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
