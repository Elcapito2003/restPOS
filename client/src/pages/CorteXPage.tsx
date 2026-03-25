import { useQuery } from '@tanstack/react-query';
import api from '../config/api';
import dayjs from 'dayjs';
import { Printer, RefreshCw } from 'lucide-react';

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (part: number, total: number) => total > 0 ? `${Math.round(part / total * 100)}%` : '0%';
const SEP = '========================================';
const LINE = '----------------------------------------';
const USCORE = '____________';

function ReceiptLine({ left, right, bold, indent }: { left: string; right?: string; bold?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${indent ? 'pl-2' : ''}`}>
      <span>{left}</span>
      {right !== undefined && <span>{right}</span>}
    </div>
  );
}

function ReceiptCenter({ text, bold }: { text: string; bold?: boolean }) {
  return <div className={`text-center ${bold ? 'font-bold' : ''}`}>{text}</div>;
}

function ReceiptSep({ char }: { char?: string }) {
  return <div className="text-center opacity-50">{char || SEP}</div>;
}

export default function CorteXPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['corte-x'],
    queryFn: () => api.get('/cash-register/corte-x').then(r => r.data),
  });

  if (isLoading) return <div className="flex items-center justify-center h-full">Generando Corte X...</div>;
  if (error) return (
    <div className="flex items-center justify-center h-full">
      <div className="card p-8 text-center max-w-sm">
        <p className="text-red-600 font-medium mb-2">No se pudo generar el Corte X</p>
        <p className="text-sm text-gray-500">{(error as any)?.response?.data?.error || 'No hay caja abierta'}</p>
      </div>
    </div>
  );

  const d = data;
  const s = d.settings || {};
  const o = d.orders || {};
  const closedOrders = parseInt(o.closed_orders || '0');
  const cancelledOrders = parseInt(o.cancelled_orders || '0');
  const discountOrders = parseInt(o.discount_orders || '0');
  const totalSubtotal = parseFloat(o.total_subtotal || '0');
  const totalTax = parseFloat(o.total_tax || '0');
  const totalDiscounts = parseFloat(o.total_discounts || '0');
  const totalSales = parseFloat(o.total_sales || '0');
  const ventaNeta = totalSubtotal - totalDiscounts;

  // Category data
  const cats = d.by_category || {};
  const catEntries = Object.entries(cats) as [string, { subtotal: number; qty: number }][];
  const catTotal = catEntries.reduce((s, [, v]) => s + v.subtotal, 0);

  // Payment methods for sales (not tips)
  const paymentSales = d.by_method?.map((m: any) => ({
    method: m.method,
    total: parseFloat(m.total) - parseFloat(m.tips || '0'),
  })) || [];
  const totalPaymentSales = paymentSales.reduce((s: number, p: any) => s + p.total, 0);

  // Tips by method
  const tipsMethods = d.tips_by_method || [];
  const totalTipsCalc = tipsMethods.reduce((s: number, t: any) => s + parseFloat(t.tips), 0);

  // Service types
  const serviceTypes = d.by_service_type || [];

  const methodLabels: Record<string, string> = {
    cash: 'EFECTIVO', visa: 'VISA', mastercard: 'MASTERCARD', amex: 'AMEX',
    other_card: 'OTRA TARJETA', transfer: 'TRANSFERENCIA', other: 'OTROS',
  };

  return (
    <div className="p-4 flex flex-col items-center">
      {/* Action bar (not printed) */}
      <div className="w-full max-w-lg flex justify-between items-center mb-4 print:hidden">
        <div>
          <h2 className="text-xl font-bold">Corte X - Parcial</h2>
          <p className="text-xs text-amber-600">Solo informativo. No cierra la caja.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="btn-secondary text-sm gap-1"><RefreshCw size={14} /> Actualizar</button>
          <button onClick={() => window.print()} className="btn-primary text-sm gap-1"><Printer size={14} /> Imprimir</button>
        </div>
      </div>

      {/* Receipt */}
      <div className="bg-white border shadow-lg rounded-lg w-full max-w-lg p-6 font-mono text-[11px] leading-[1.6] space-y-0.5 print:shadow-none print:border-0 print:rounded-none print:p-0 print:max-w-none">

        {/* Header */}
        <ReceiptCenter text={s.restaurant_name || 'restPOS'} bold />
        {s.restaurant_rfc && <ReceiptCenter text={`RFC: ${s.restaurant_rfc}`} />}
        {s.restaurant_address && <ReceiptCenter text={s.restaurant_address} />}
        <div className="h-2" />

        <ReceiptCenter text="CORTE DE CAJA X" bold />
        <ReceiptCenter text={`DEL ${dayjs(d.register.opened_at).format('DD/MM/YYYY hh:mm:ss A')}`} />
        <ReceiptCenter text={`AL ${dayjs(d.timestamp).format('DD/MM/YYYY hh:mm:ss A')}`} />
        <ReceiptCenter text="PRECORTE CAJA" />
        <ReceiptSep />

        {/* CAJA */}
        <ReceiptCenter text="CAJA" bold />
        <ReceiptLine left="+EFECTIVO INICIAL:" right={fmt(d.opening_amount)} />
        <ReceiptLine left="+EFECTIVO:" right={fmt(d.cash_sales)} />
        <ReceiptLine left="+TARJETA:" right={fmt(d.card_sales)} />
        <ReceiptLine left="+VALES:" right={fmt(0)} />
        <ReceiptLine left="+OTROS:" right={fmt(0)} />
        <ReceiptLine left="+DEPÓSITOS EFECTIVO:" right={fmt(d.movements_in)} />
        <ReceiptLine left="-RETIROS EFECTIVO:" right={fmt(d.movements_out)} />
        <ReceiptLine left="-PROPINAS PAGADAS:" right={fmt(d.total_tips)} />
        <div className="opacity-50">{USCORE}</div>
        <ReceiptLine left="=SALDO FINAL:" right={fmt(d.saldo_final)} bold />
        <ReceiptLine left="EFECTIVO FINAL:" right={fmt(d.expected_cash)} bold />

        {/* FORMA DE PAGO VENTAS */}
        <div className="h-1" />
        <ReceiptCenter text="FORMA DE PAGO VENTAS" bold />
        {paymentSales.map((p: any) => (
          <ReceiptLine key={p.method} left={`${methodLabels[p.method] || p.method.toUpperCase()}:`} right={fmt(p.total)} />
        ))}
        <ReceiptSep char={LINE} />
        <ReceiptLine left="TOTAL FORMAS DE PAGO" right={fmt(totalPaymentSales)} bold />

        {/* FORMA DE PAGO PROPINA */}
        <div className="h-1" />
        <ReceiptCenter text="FORMA DE PAGO PROPINA" bold />
        {tipsMethods.map((t: any) => (
          <ReceiptLine key={t.method} left={`${methodLabels[t.method] || t.method.toUpperCase()}:`} right={fmt(parseFloat(t.tips))} />
        ))}
        {tipsMethods.length === 0 && <ReceiptLine left="(sin propinas)" />}
        <ReceiptSep char={LINE} />
        <ReceiptLine left="TOTAL FORMAS PAGO PROPINA" right={fmt(totalTipsCalc)} bold />

        <ReceiptSep />

        {/* VENTA */}
        <ReceiptCenter text="VENTA (NO INCLUYE IMPUESTOS)" bold />
        <div className="h-1" />
        <ReceiptCenter text="POR TIPO DE PRODUCTO" bold />
        {['Alimentos', 'Bebidas', 'Otros'].map(name => {
          const cat = cats[name] || { subtotal: 0, qty: 0 };
          return (
            <ReceiptLine key={name} left={`${name.toUpperCase()}:`}
              right={`${fmt(cat.subtotal)} (${pct(cat.subtotal, catTotal)}) ${cat.qty}`} />
          );
        })}

        <div className="h-1" />
        <ReceiptCenter text="POR TIPO DE SERVICIO" bold />
        {['Comedor', 'Rápido'].map(name => {
          const svc = serviceTypes.find((s: any) => s.name === name);
          const total = svc ? svc.total : 0;
          return (
            <ReceiptLine key={name} left={`${name.toUpperCase()}:`}
              right={`${fmt(total)} (${pct(total, totalSubtotal)})`} />
          );
        })}

        <div className="opacity-50">{USCORE}</div>
        <ReceiptLine left="SUBTOTAL :" right={fmt(catTotal)} />
        <ReceiptLine left="-DESCUENTOS :" right={fmt(totalDiscounts)} />
        <ReceiptLine left="VENTA NETA :" right={fmt(ventaNeta)} bold />
        <div className="opacity-50">{USCORE}</div>
        <ReceiptLine left="VENTA 16%:" right={fmt(catTotal)} />
        <ReceiptLine left="IMPUESTO 16%:" right={fmt(totalTax)} />
        <ReceiptLine left="IMPUESTOS TOTAL:" right={fmt(totalTax)} bold />
        <div className="opacity-50">{USCORE}</div>
        <ReceiptLine left="VENTAS CON IMP.:" right={fmt(totalSales)} bold />

        <ReceiptSep />

        {/* CUENTAS */}
        <ReceiptLine left="CUENTAS NORMALES :" right={String(closedOrders)} />
        <ReceiptLine left="CUENTAS CANCELADAS :" right={String(cancelledOrders)} />
        <ReceiptLine left="CUENTAS CON DESCUENTO :" right={String(discountOrders)} />
        <ReceiptLine left="CUENTAS CON CORTESÍA :" right="0" />
        <ReceiptLine left="CUENTA PROMEDIO :" right={fmt(d.avg_check)} />
        <ReceiptLine left="COMENSALES :" right={String(d.total_guests)} />
        <ReceiptLine left="PROPINAS :" right={fmt(d.total_tips)} />
        <ReceiptLine left="CARGOS :" right={fmt(0)} />
        <ReceiptLine left="FOLIO INICIAL :" right={o.first_folio ? String(o.first_folio) : '-'} />
        <ReceiptLine left="FOLIO FINAL :" right={o.last_folio ? String(o.last_folio) : '-'} />

        <div className="h-1" />
        <ReceiptLine left="CORTESÍA ALIMENTOS :" right={fmt(0)} />
        <ReceiptLine left="CORTESÍA BEBIDAS :" right={fmt(0)} />
        <ReceiptLine left="CORTESÍA OTROS :" right={fmt(0)} />
        <div className="opacity-50">{USCORE}</div>
        <ReceiptLine left="TOTAL CORTESÍAS :" right={fmt(0)} bold />

        <ReceiptLine left="DESCUENTO ALIMENTOS :" right={fmt(0)} />
        <ReceiptLine left="DESCUENTO BEBIDAS :" right={fmt(0)} />
        <ReceiptLine left="DESCUENTO OTROS :" right={fmt(0)} />
        <div className="opacity-50">{USCORE}</div>
        <ReceiptLine left="TOTAL DESCUENTOS :" right={fmt(totalDiscounts)} bold />

        <ReceiptSep />

        {/* DECLARACION */}
        <ReceiptCenter text="DECLARACIÓN DE CAJERO" bold />
        <ReceiptCenter text="POR TIPO DE FORMA DE PAGO" />
        <div className="flex justify-between font-bold">
          <span></span>
          <span className="flex gap-6"><span>DECLARADO:</span><span>DIFERENCIA:</span></span>
        </div>
        {[
          { label: 'EFECTIVO', expected: d.expected_cash },
          { label: 'TARJETA', expected: d.card_sales },
          { label: 'VALES', expected: 0 },
          { label: 'OTROS', expected: 0 },
        ].map(row => (
          <div key={row.label} className="flex justify-between">
            <span>{row.label}:</span>
            <span className="flex gap-8">
              <span>{fmt(0)}</span>
              <span>{fmt(-row.expected)}</span>
            </span>
          </div>
        ))}
        <ReceiptSep char="---------------" />
        <ReceiptLine left="TOTAL:" right={fmt(0)} />
        <ReceiptLine left="SOBRANTE(+) O FALTANTE(-):" right={fmt(-(d.expected_cash + d.card_sales))} bold />

        <ReceiptSep />

        {/* Signatures */}
        <div className="h-8" />
        <div className="flex justify-around">
          <div className="text-center">
            <div className="border-t border-black w-32" />
            <span>GERENTE</span>
          </div>
          <div className="text-center">
            <div className="border-t border-black w-32" />
            <span>CAJERO</span>
          </div>
        </div>
      </div>
    </div>
  );
}
