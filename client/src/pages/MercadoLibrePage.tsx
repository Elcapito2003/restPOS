import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import {
  Search, ShoppingCart, Package, Truck, ExternalLink, X, Shield, LogIn,
  Bell, AlertTriangle, Check, Trash2,
} from 'lucide-react';

interface SearchResult {
  title: string; price: string; link: string; image: string;
  shipping: string; seller: string; itemId: string;
}

interface MLOrder {
  id: number; status: string; date: string; total: number; currency: string;
  items: { title: string; quantity: number; unit_price: number; item_id: string }[];
  shipping: { id: number } | null;
  seller: { nickname: string };
}

export default function MercadoLibrePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'requests' | 'search' | 'cart' | 'orders'>('requests');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [buyItem, setBuyItem] = useState<SearchResult | null>(null);
  const [buyQty, setBuyQty] = useState(1);
  const [authCode, setAuthCode] = useState('');

  // API auth status
  const { data: mlStatus } = useQuery({
    queryKey: ['ml-status'],
    queryFn: () => api.get('/mercadolibre/status').then(r => r.data),
    refetchInterval: 60000,
  });

  const authUrlQuery = useQuery({
    queryKey: ['ml-auth-url'],
    queryFn: () => api.get('/mercadolibre/auth-url').then(r => r.data),
    enabled: !mlStatus?.connected,
  });

  const authMut = useMutation({
    mutationFn: (code: string) => api.post('/mercadolibre/auth', { code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-status'] });
      setAuthCode('');
      toast.success('MercadoLibre conectado!');
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al autenticar'),
  });

  // Browser search
  const { data: searchResults, isFetching: searching } = useQuery({
    queryKey: ['ml-browser-search', searchTerm],
    queryFn: () => api.get('/mercadolibre/browser/search', { params: { q: searchTerm } }).then(r => r.data),
    enabled: !!searchTerm,
    staleTime: 300000,
  });

  // Browser login
  const loginMut = useMutation({
    mutationFn: () => api.post('/mercadolibre/browser/login'),
    onSuccess: () => toast.success('Se abrio la ventana de login. Inicia sesion en el navegador.'),
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  // Buy
  const buyMut = useMutation({
    mutationFn: (data: { url: string; quantity: number; title?: string; price?: number }) => api.post('/mercadolibre/browser/buy', data),
    onSuccess: (res) => {
      const d = res.data;
      setBuyItem(null);
      if (d.status === 'purchased') {
        toast.success(d.message);
        qc.invalidateQueries({ queryKey: ['ml-orders'] });
        qc.invalidateQueries({ queryKey: ['ml-purchases'] });
      } else if (d.status === 'needs_login') {
        toast.error(d.message);
      } else {
        toast(d.message);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error al comprar'),
  });

  // Add to cart
  const addCartMut = useMutation({
    mutationFn: (data: { url: string; quantity: number }) => api.post('/mercadolibre/browser/add-to-cart', data),
    onSuccess: (res) => {
      const d = res.data;
      setBuyItem(null);
      if (d.status === 'added') {
        toast.success(d.message);
        qc.invalidateQueries({ queryKey: ['ml-cart'] });
      } else {
        toast(d.message);
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  // Cart
  const { data: cartData } = useQuery({
    queryKey: ['ml-cart'],
    queryFn: () => api.get('/mercadolibre/browser/cart').then(r => r.data),
    enabled: tab === 'cart' && !!mlStatus?.connected,
  });

  const checkoutMut = useMutation({
    mutationFn: () => api.post('/mercadolibre/browser/checkout'),
    onSuccess: (res) => {
      toast.success(res.data.message);
      qc.invalidateQueries({ queryKey: ['ml-cart'] });
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  // Purchase requests from employees/chatbot
  const { data: requests = [] } = useQuery<any[]>({
    queryKey: ['ml-requests'],
    queryFn: () => api.get('/mercadolibre/requests').then(r => r.data),
    refetchInterval: 15000,
  });

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const cancelReqMut = useMutation({
    mutationFn: (id: number) => api.delete(`/mercadolibre/requests/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-requests'] });
      toast.success('Solicitud cancelada');
    },
  });

  const markPurchasedMut = useMutation({
    mutationFn: (data: { id: number; title: string; url: string; price: number }) =>
      api.patch(`/mercadolibre/requests/${data.id}`, {
        status: 'purchased', purchased_title: data.title,
        purchased_url: data.url, purchased_price: data.price,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ml-requests'] });
      qc.invalidateQueries({ queryKey: ['ml-purchases'] });
      toast.success('Marcado como comprado');
    },
  });

  // Local purchases
  const { data: purchases = [] } = useQuery({
    queryKey: ['ml-purchases'],
    queryFn: () => api.get('/mercadolibre/purchases').then(r => r.data),
    enabled: tab === 'orders',
  });

  function doSearch() {
    if (!searchQuery.trim()) return;
    setSearchTerm(searchQuery.trim());
  }

  // ─── Not connected ───
  if (!mlStatus?.connected) {
    return (
      <div className="p-4 max-w-lg mx-auto mt-20">
        <div className="card p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <ShoppingCart size={32} className="text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold">Conectar MercadoLibre</h2>
          <p className="text-gray-500 text-sm">Conecta tu cuenta para buscar y comprar desde restPOS.</p>
          {authUrlQuery.data?.url && (
            <>
              <a href={authUrlQuery.data.url} target="_blank" rel="noopener noreferrer"
                className="btn-primary inline-flex gap-2 px-6 py-3">
                <ExternalLink size={16} /> Autorizar en MercadoLibre
              </a>
              <div className="border-t pt-4 space-y-2">
                <p className="text-xs text-gray-400">Despues de autorizar, pega el codigo aqui:</p>
                <div className="flex gap-2">
                  <input value={authCode} onChange={e => setAuthCode(e.target.value)}
                    className="input flex-1" placeholder="Pega el codigo aqui..." />
                  <button onClick={() => authMut.mutate(authCode)}
                    disabled={!authCode || authMut.isPending} className="btn-primary px-4">
                    {authMut.isPending ? 'Conectando...' : 'Conectar'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const statusLabels: Record<string, { label: string; color: string }> = {
    paid: { label: 'Pagado', color: 'bg-green-100 text-green-700' },
    confirmed: { label: 'Confirmado', color: 'bg-blue-100 text-blue-700' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    payment_required: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
    payment_in_process: { label: 'Procesando', color: 'bg-yellow-100 text-yellow-700' },
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">MercadoLibre</h2>
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <Shield size={12} className="text-green-500" /> Conectado como {mlStatus.nickname}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loginMut.mutate()} disabled={loginMut.isPending}
            className="btn-secondary text-xs gap-1">
            <LogIn size={14} /> Iniciar sesion en navegador
          </button>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setTab('requests')}
              className={`px-3 py-1.5 rounded text-sm font-medium relative ${tab === 'requests' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              <Bell size={14} className="inline mr-1" /> Solicitudes
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button onClick={() => setTab('search')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${tab === 'search' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              <Search size={14} className="inline mr-1" /> Buscar
            </button>
            <button onClick={() => setTab('cart')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${tab === 'cart' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              <ShoppingCart size={14} className="inline mr-1" /> Carrito
            </button>
            <button onClick={() => setTab('orders')}
              className={`px-3 py-1.5 rounded text-sm font-medium ${tab === 'orders' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
              <Package size={14} className="inline mr-1" /> Mis Compras
            </button>
          </div>
        </div>
      </div>

      {/* Requests tab */}
      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 && (
            <div className="card p-8 text-center text-gray-400">
              <Bell size={40} className="mx-auto mb-2 opacity-50" />
              <p>Sin solicitudes de compra</p>
              <p className="text-xs mt-1">Los empleados pueden pedir cosas por el asistente AI</p>
            </div>
          )}
          {requests.map((req: any) => {
            const isPending = req.status === 'pending';
            const isUrgent = req.priority === 'urgent';
            return (
              <div key={req.id} className={`card p-4 ${isUrgent && isPending ? 'border-l-4 border-l-red-500' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {isUrgent && <AlertTriangle size={16} className="text-red-500" />}
                      <span className="font-medium">{req.product_description}</span>
                      <span className="text-xs text-gray-400">x{req.quantity}</span>
                      {req.max_price && (
                        <span className="text-xs text-gray-400">max ${Number(req.max_price).toFixed(2)}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        req.status === 'purchased' ? 'bg-green-100 text-green-700' :
                        req.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {req.status === 'pending' ? 'Pendiente' :
                         req.status === 'purchased' ? 'Comprado' :
                         req.status === 'cancelled' ? 'Cancelado' : req.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {req.requested_by && <span>Solicitado por: {req.requested_by} &middot; </span>}
                      {new Date(req.created_at).toLocaleDateString('es-MX')}{' '}
                      {new Date(req.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      {req.notes && <span> &middot; {req.notes}</span>}
                    </p>
                    {req.purchased_title && (
                      <p className="text-xs text-green-600 mt-1">
                        Comprado: {req.purchased_title} - ${Number(req.purchased_price || 0).toFixed(2)}
                        {req.purchased_url && (
                          <a href={req.purchased_url} target="_blank" rel="noopener noreferrer" className="ml-1 text-blue-600">
                            <ExternalLink size={12} className="inline" />
                          </a>
                        )}
                      </p>
                    )}
                  </div>
                  {isPending && (
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSearchQuery(req.search_query || req.product_description);
                          setSearchTerm(req.search_query || req.product_description);
                          setTab('search');
                        }}
                        className="btn-primary text-xs gap-1 py-1.5 px-3">
                        <Search size={14} /> Buscar
                      </button>
                      <button onClick={() => cancelReqMut.mutate(req.id)}
                        className="text-red-400 hover:text-red-600 p-1" title="Cancelar">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search tab */}
      {tab === 'search' && (
        <>
          <div className="flex gap-2">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
              className="input flex-1" placeholder="Buscar en MercadoLibre..." />
            <button onClick={doSearch} disabled={searching} className="btn-primary px-6 gap-1">
              <Search size={16} /> {searching ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {searching && (
            <div className="text-center py-10 text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p>Buscando en MercadoLibre... (se abrio un navegador)</p>
            </div>
          )}

          {searchResults && !searching && (
            <>
              <p className="text-sm text-gray-400">{searchResults.total} productos encontrados</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {searchResults.results?.map((p: SearchResult, i: number) => (
                  <div key={i} className="card overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-40 bg-gray-50 flex items-center justify-center p-2">
                      {p.image ? (
                        <img src={p.image} alt={p.title} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <Package size={40} className="text-gray-300" />
                      )}
                    </div>
                    <div className="p-3 space-y-2">
                      <p className="text-sm font-medium line-clamp-2 h-10">{p.title}</p>
                      <p className="text-lg font-bold">{p.price}</p>
                      {p.shipping && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <Truck size={12} /> {p.shipping}
                        </p>
                      )}
                      {p.seller && <p className="text-xs text-gray-400">{p.seller}</p>}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setBuyItem(p); setBuyQty(1); }}
                          className="btn-primary text-xs flex-1 gap-1 py-1.5">
                          <ShoppingCart size={14} /> Comprar
                        </button>
                        <a href={p.link} target="_blank" rel="noopener noreferrer"
                          className="btn-secondary text-xs px-2 py-1.5" title="Ver en ML">
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!searchResults && !searching && (
            <div className="text-center text-gray-300 py-20">
              <Search size={48} className="mx-auto mb-3" />
              <p>Busca productos para comprar</p>
            </div>
          )}
        </>
      )}

      {/* Cart tab */}
      {tab === 'cart' && (
        <div className="card overflow-hidden">
          <div className="p-3 border-b bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <ShoppingCart size={16} /> Carrito de MercadoLibre
            </h3>
            <button onClick={() => checkoutMut.mutate()} disabled={checkoutMut.isPending}
              className="btn-primary text-sm gap-1">
              <ShoppingCart size={14} /> {checkoutMut.isPending ? 'Abriendo...' : 'Comprar Todo'}
            </button>
          </div>
          {cartData?.items?.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3">Producto</th>
                  <th className="text-right p-3">Precio</th>
                  <th className="text-right p-3">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {cartData.items.map((item: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.title}</td>
                    <td className="p-3 text-right">{item.price}</td>
                    <td className="p-3 text-right">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-400">
              <ShoppingCart size={32} className="mx-auto mb-2 opacity-50" />
              <p>Carrito vacio. Busca productos y agregalos al carrito.</p>
            </div>
          )}
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="card overflow-hidden">
          <div className="p-3 border-b bg-gray-50">
            <h3 className="font-bold text-sm flex items-center gap-2"><Package size={16} /> Ordenes de Compra</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3">Orden</th>
                <th className="text-left p-3">Fecha</th>
                <th className="text-left p-3">Producto</th>
                <th className="text-right p-3">Cant.</th>
                <th className="text-right p-3">Total</th>
                <th className="text-left p-3">Estado</th>
                <th className="text-left p-3">Entrega</th>
                <th className="text-left p-3">Comprado por</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {purchases.map((p: any) => {
                const st = statusLabels[p.status] || { label: p.status, color: 'bg-gray-100 text-gray-700' };
                const shipLabels: Record<string, { label: string; color: string }> = {
                  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
                  shipped: { label: 'Enviado', color: 'bg-blue-100 text-blue-700' },
                  delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
                };
                const ship = shipLabels[p.shipping_status] || null;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3 text-xs text-gray-400">#{p.id}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      {new Date(p.created_at).toLocaleDateString('es-MX')}
                      <br />
                      <span className="text-gray-400">{new Date(p.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="p-3 font-medium">{p.product_title}</td>
                    <td className="p-3 text-right">{p.quantity}</td>
                    <td className="p-3 text-right font-medium whitespace-nowrap">
                      {Number(p.total) > 0 ? `$${Number(p.total).toLocaleString('es-MX')}` : '-'}
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="p-3">
                      {ship ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ship.color}`}>{ship.label}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                      {p.tracking_number && (
                        <p className="text-xs text-gray-400 mt-1">Guia: {p.tracking_number}</p>
                      )}
                    </td>
                    <td className="p-3 text-xs text-gray-500">{p.created_by_name || '-'}</td>
                    <td className="p-3 text-right">
                      {p.product_url && (
                        <a href={p.product_url} target="_blank" rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800" title="Ver en ML">
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {purchases.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-gray-400">Sin compras registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Buy Modal */}
      {buyItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold">Confirmar Compra</h3>
              <button onClick={() => setBuyItem(null)}><X size={20} /></button>
            </div>
            <div className="flex gap-3">
              {buyItem.image && (
                <img src={buyItem.image} alt="" className="w-20 h-20 object-contain bg-gray-50 rounded" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{buyItem.title}</p>
                <p className="text-lg font-bold mt-1">{buyItem.price}</p>
                {buyItem.shipping && (
                  <p className="text-xs text-green-600 flex items-center gap-1"><Truck size={12} /> {buyItem.shipping}</p>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Cantidad</label>
              <input type="number" min={1} value={buyQty} onChange={e => setBuyQty(Number(e.target.value))} className="input" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBuyItem(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={() => addCartMut.mutate({ url: buyItem.link, quantity: buyQty })}
                disabled={addCartMut.isPending || buyMut.isPending}
                className="bg-yellow-500 text-white px-3 py-2 rounded-lg text-sm flex-1 gap-1 flex items-center justify-center hover:bg-yellow-600">
                <ShoppingCart size={16} /> {addCartMut.isPending ? 'Agregando...' : 'Al Carrito'}
              </button>
              <button onClick={() => buyMut.mutate({
                  url: buyItem.link, quantity: buyQty,
                  title: buyItem.title,
                  price: parseFloat(buyItem.price.replace(/[^0-9.]/g, '')) || 0,
                })}
                disabled={buyMut.isPending || addCartMut.isPending}
                className="btn-primary flex-1 gap-1">
                <Truck size={16} /> {buyMut.isPending ? 'Comprando...' : 'Comprar Ya'}
              </button>
            </div>
            {(buyMut.isPending || addCartMut.isPending) && (
              <p className="text-xs text-center text-gray-400">Procesando en el navegador...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
