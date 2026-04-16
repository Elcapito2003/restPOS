import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { Send, Clock, CheckCircle, XCircle, DollarSign } from 'lucide-react';

interface SupplierAccount {
  id: number; name: string; bank_name: string; account_number: string; clabe: string;
}

export default function SolicitarTransferenciaPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [note, setNote] = useState('');

  const { data: supplierAccounts = [] } = useQuery<SupplierAccount[]>({
    queryKey: ['supplier-accounts'],
    queryFn: () => api.get('/banking/supplier-accounts').then(r => r.data),
  });

  // My requests (reuse transfers endpoint filtered by status)
  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-transfer-requests'],
    queryFn: () => api.get('/banking/supplier-accounts').then(() =>
      // We don't have a "my requests" endpoint, show all supplier accounts for now
      []
    ),
  });

  const requestMut = useMutation({
    mutationFn: (data: any) => api.post('/banking/request', data),
    onSuccess: () => {
      toast.success('Solicitud enviada al administrador');
      setShowForm(false);
      setAmount(''); setConcept(''); setNote(''); setSelectedSupplier(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Solicitar Transferencia</h2>
          <p className="text-sm text-gray-400">El administrador debe aprobar cada solicitud</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary text-sm gap-1">
          <Send size={14} /> Nueva Solicitud
        </button>
      </div>

      <div className="card p-6 text-center text-gray-400">
        <DollarSign size={32} className="mx-auto mb-2 opacity-50" />
        <p>Tus solicitudes de transferencia apareceran aqui.</p>
        <p className="text-xs mt-1">El administrador las vera y aprobara desde su panel.</p>
      </div>

      {/* Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Solicitar Transferencia</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={20} />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium">Proveedor / Beneficiario</label>
              <select
                value={selectedSupplier?.id || ''}
                onChange={e => setSelectedSupplier(supplierAccounts.find(a => a.id === Number(e.target.value)) || null)}
                className="input"
              >
                <option value="">Seleccionar...</option>
                {supplierAccounts.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.bank_name ? `(${s.bank_name})` : ''} — {s.clabe || s.account_number}
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplier && (
              <div className="bg-gray-50 rounded-lg p-3 text-xs space-y-1">
                <p><span className="font-medium">Banco:</span> {selectedSupplier.bank_name || '-'}</p>
                <p><span className="font-medium">CLABE:</span> {selectedSupplier.clabe || '-'}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Monto</label>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                className="input" placeholder="0.00" />
            </div>

            <div>
              <label className="text-sm font-medium">Concepto</label>
              <input value={concept} onChange={e => setConcept(e.target.value)}
                className="input" placeholder="Pago proveedor, nomina, etc." />
            </div>

            <div>
              <label className="text-sm font-medium">Nota para el administrador</label>
              <textarea value={note} onChange={e => setNote(e.target.value)}
                className="input" placeholder="Ej: Urgente, falta pagar factura #123..." rows={2} />
            </div>

            {amount && (
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-500">Monto solicitado:</p>
                <p className="text-2xl font-bold text-blue-700">${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => requestMut.mutate({
                  supplier_id: selectedSupplier?.id,
                  beneficiary: selectedSupplier?.name || '',
                  amount: parseFloat(amount),
                  concept: concept || 'Pago proveedor',
                  note,
                })}
                disabled={!selectedSupplier || !amount || requestMut.isPending}
                className="btn-primary flex-1 gap-1"
              >
                <Send size={16} /> {requestMut.isPending ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
