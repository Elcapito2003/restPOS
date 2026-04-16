import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import {
  Send, LogIn, DollarSign, Building2, Clock, CheckCircle, XCircle, AlertTriangle, RefreshCw,
} from 'lucide-react';

interface Transfer {
  id: number; supplier_id: number; supplier_name: string; beneficiary: string;
  amount: string; concept: string; status: string; created_by_name: string; created_at: string;
}

interface SupplierAccount {
  id: number; name: string; bank_name: string; account_number: string; clabe: string;
}

export default function TransferenciasPage() {
  const qc = useQueryClient();
  const [token, setToken] = useState('');
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierAccount | null>(null);
  const [amount, setAmount] = useState('');
  const [concept, setConcept] = useState('');
  const [transferToken, setTransferToken] = useState('');

  const [approveId, setApproveId] = useState<number | null>(null);
  const [approveToken, setApproveToken] = useState('');

  // Transfers history
  const { data: transfers = [] } = useQuery<Transfer[]>({
    queryKey: ['transfers'],
    queryFn: () => api.get('/banking/transfers').then(r => r.data),
  });

  // Pending requests from managers
  const { data: pendingRequests = [] } = useQuery<any[]>({
    queryKey: ['pending-requests'],
    queryFn: () => api.get('/banking/requests/pending').then(r => r.data),
    refetchInterval: 30000,
  });

  const approveMut = useMutation({
    mutationFn: (data: { id: number; token: string }) => api.post(`/banking/requests/${data.id}/approve`, { token: data.token }),
    onSuccess: (res) => {
      setApproveId(null); setApproveToken('');
      qc.invalidateQueries({ queryKey: ['pending-requests'] });
      qc.invalidateQueries({ queryKey: ['transfers'] });
      const d = res.data;
      if (d.status === 'completed') toast.success('Transferencia realizada');
      else toast(d.message);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const rejectMut = useMutation({
    mutationFn: (id: number) => api.post(`/banking/requests/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-requests'] });
      toast.success('Solicitud rechazada');
    },
  });

  // Supplier accounts
  const { data: supplierAccounts = [] } = useQuery<SupplierAccount[]>({
    queryKey: ['supplier-accounts'],
    queryFn: () => api.get('/banking/supplier-accounts').then(r => r.data),
  });

  // Login
  const loginMut = useMutation({
    mutationFn: (t: string) => api.post('/banking/login', { token: t }),
    onSuccess: (res) => {
      if (res.data.status === 'ok') {
        toast.success('Sesion iniciada en Banregio');
        setToken('');
      } else {
        toast.error(res.data.message);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al conectar'),
  });

  // Balance
  const { data: balance, refetch: refetchBalance } = useQuery({
    queryKey: ['bank-balance'],
    queryFn: () => api.get('/banking/balance').then(r => r.data),
    enabled: false,
  });

  const [showTokenConfirm, setShowTokenConfirm] = useState(false);
  const [confirmToken, setConfirmToken] = useState('');

  // Transfer
  const transferMut = useMutation({
    mutationFn: (data: any) => api.post('/banking/transfer', data),
    onSuccess: (res) => {
      const d = res.data;
      setShowTransfer(false);
      setAmount(''); setConcept(''); setSelectedSupplier(null);
      qc.invalidateQueries({ queryKey: ['transfers'] });
      if (d.status === 'completed') {
        toast.success(d.message);
      } else if (d.status === 'needs_token') {
        setShowTokenConfirm(true);
        toast('Ingresa tu token de Banregio para confirmar');
      } else if (d.status === 'error') {
        toast.error(d.message);
      } else {
        toast(d.message);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  // Confirm with token
  const confirmMut = useMutation({
    mutationFn: (t: string) => api.post('/banking/confirm-transfer', { token: t }),
    onSuccess: (res) => {
      setShowTokenConfirm(false);
      setConfirmToken('');
      qc.invalidateQueries({ queryKey: ['transfers'] });
      if (res.data.status === 'completed') {
        toast.success(res.data.message);
      } else if (res.data.status === 'error') {
        toast.error(res.data.message);
      } else {
        toast(res.data.message);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
    completed: { label: 'Completada', color: 'bg-green-100 text-green-700', icon: CheckCircle },
    pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    error: { label: 'Error', color: 'bg-red-100 text-red-700', icon: XCircle },
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Transferencias Bancarias</h2>
          <p className="text-sm text-gray-400">Banregio Empresarial — Solo administrador</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetchBalance()} className="btn-secondary text-sm gap-1">
            <DollarSign size={14} /> {balance?.balance || 'Ver saldo'}
          </button>
          <button onClick={() => setShowTransfer(true)} className="btn-primary text-sm gap-1">
            <Send size={14} /> Nueva Transferencia
          </button>
        </div>
      </div>

      {/* Login card */}
      <div className="card p-4">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">Token de Banregio (de tu app del celular)</label>
            <input value={token} onChange={e => setToken(e.target.value)} className="input"
              placeholder="Ingresa el token de 6 digitos..." maxLength={8}
              onKeyDown={e => { if (e.key === 'Enter' && token) loginMut.mutate(token); }} />
          </div>
          <button onClick={() => loginMut.mutate(token)} disabled={!token || loginMut.isPending}
            className="btn-primary px-4 py-2 gap-1">
            <LogIn size={16} /> {loginMut.isPending ? 'Conectando...' : 'Conectar'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Abre tu app de Banregio, ve al token dinamico y copia el codigo antes de que expire.
        </p>
      </div>

      {/* Pending requests from managers */}
      {pendingRequests.length > 0 && (
        <div className="card overflow-hidden border-2 border-yellow-300">
          <div className="p-3 border-b bg-yellow-50">
            <h3 className="font-bold text-sm flex items-center gap-2 text-yellow-700">
              <AlertTriangle size={16} /> Solicitudes Pendientes ({pendingRequests.length})
            </h3>
          </div>
          <div className="divide-y">
            {pendingRequests.map((r: any) => (
              <div key={r.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">${Number(r.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium">{r.supplier_name || r.beneficiary}</span>
                    {r.bank_name && <span className="text-xs text-gray-400">({r.bank_name})</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {r.concept} {r.request_note && <span className="text-yellow-600">· {r.request_note}</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    Solicitado por {r.requested_by_name} · {new Date(r.requested_at).toLocaleString('es-MX')}
                  </p>
                  {r.clabe && <p className="text-xs text-gray-400">CLABE: {r.clabe}</p>}
                </div>
                <div className="flex gap-2 ml-4">
                  {approveId === r.id ? (
                    <div className="flex gap-1 items-center">
                      <input value={approveToken} onChange={e => setApproveToken(e.target.value)}
                        className="input w-24 text-sm" placeholder="Token" maxLength={8} />
                      <button onClick={() => approveMut.mutate({ id: r.id, token: approveToken })}
                        disabled={!approveToken || approveMut.isPending}
                        className="btn-primary text-xs px-3 py-1.5">
                        {approveMut.isPending ? '...' : 'OK'}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => setApproveId(r.id)}
                        className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 hover:bg-green-700">
                        <CheckCircle size={14} /> Aprobar
                      </button>
                      <button onClick={() => { if (confirm('Rechazar solicitud?')) rejectMut.mutate(r.id); }}
                        className="text-red-500 hover:text-red-700 text-xs px-2">
                        <XCircle size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfers history */}
      <div className="card overflow-hidden">
        <div className="p-3 border-b bg-gray-50">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Building2 size={16} /> Historial de Transferencias
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3">#</th>
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Proveedor</th>
              <th className="text-left p-3">Beneficiario</th>
              <th className="text-right p-3">Monto</th>
              <th className="text-left p-3">Concepto</th>
              <th className="text-left p-3">Estado</th>
              <th className="text-left p-3">Autorizo</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transfers.map(t => {
              const sc = statusConfig[t.status] || statusConfig.pending;
              const Icon = sc.icon;
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-3 text-xs text-gray-400">{t.id}</td>
                  <td className="p-3 text-xs whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString('es-MX')}
                    <br /><span className="text-gray-400">{new Date(t.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                  </td>
                  <td className="p-3 font-medium">{t.supplier_name || '-'}</td>
                  <td className="p-3 text-gray-500">{t.beneficiary}</td>
                  <td className="p-3 text-right font-bold">${Number(t.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-gray-500 text-xs">{t.concept}</td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${sc.color}`}>
                      <Icon size={12} /> {sc.label}
                    </span>
                  </td>
                  <td className="p-3 text-xs">{t.created_by_name}</td>
                </tr>
              );
            })}
            {transfers.length === 0 && (
              <tr><td colSpan={8} className="p-8 text-center text-gray-400">Sin transferencias registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Transfer Modal */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Nueva Transferencia</h3>
              <button onClick={() => setShowTransfer(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle size={20} />
              </button>
            </div>

            <div>
              <label className="text-sm font-medium">Proveedor</label>
              <select
                value={selectedSupplier?.id || ''}
                onChange={e => {
                  const s = supplierAccounts.find(a => a.id === Number(e.target.value));
                  setSelectedSupplier(s || null);
                }}
                className="input"
              >
                <option value="">Seleccionar proveedor...</option>
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
                <p><span className="font-medium">Cuenta:</span> {selectedSupplier.account_number || '-'}</p>
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
                className="input" placeholder="Pago proveedor" />
            </div>

            <div>
              <label className="text-sm font-medium">Token de Banregio (del cel)</label>
              <input value={transferToken} onChange={e => setTransferToken(e.target.value)}
                className="input" placeholder="Token dinamico de tu app" maxLength={8} />
            </div>

            {amount && (
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-sm text-gray-500">Total a transferir:</p>
                <p className="text-2xl font-bold text-blue-700">${Number(amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowTransfer(false)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={() => transferMut.mutate({
                  beneficiary: selectedSupplier?.name || '',
                  amount: parseFloat(amount),
                  concept: concept || 'Pago proveedor',
                  token: transferToken,
                  supplier_id: selectedSupplier?.id,
                })}
                disabled={!selectedSupplier || !amount || !transferToken || transferMut.isPending}
                className="btn-primary flex-1 gap-1"
              >
                <Send size={16} /> {transferMut.isPending ? 'Transfiriendo...' : 'Transferir'}
              </button>
            </div>

            {transferMut.isPending && (
              <p className="text-xs text-center text-gray-400 flex items-center justify-center gap-1">
                <RefreshCw size={12} className="animate-spin" /> El bot esta haciendo la transferencia en Banregio...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Token Confirmation Modal */}
      {showTokenConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-4">
            <h3 className="font-bold text-lg text-center">Confirmar Transferencia</h3>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">En la ventana de Banregio:</p>
              <p className="text-sm text-gray-600">1. Pon tu token del cel en el campo</p>
              <p className="text-sm text-gray-600">2. Dale clic en <strong>Continuar</strong></p>
              <p className="text-sm text-gray-600">3. Regresa aqui y dale <strong>Listo</strong></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowTokenConfirm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => confirmMut.mutate('done')}
                disabled={confirmMut.isPending}
                className="btn-primary flex-1 gap-1">
                <CheckCircle size={16} /> {confirmMut.isPending ? 'Verificando...' : 'Listo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
