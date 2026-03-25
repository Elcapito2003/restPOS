import { useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useKitchenOrders, useMarkItemReady, useMarkItemPreparing } from '../hooks/useOrders';
import { Clock, ChefHat, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function KitchenDisplayPage() {
  const socket = useSocket();
  const { data: orders, isLoading } = useKitchenOrders();
  const markReady = useMarkItemReady();
  const markPreparing = useMarkItemPreparing();

  useEffect(() => {
    if (socket) socket.emit('join:kitchen');
  }, [socket]);

  const getTimeColor = (sentAt: string) => {
    const mins = dayjs().diff(dayjs(sentAt), 'minute');
    if (mins > 20) return 'bg-red-500';
    if (mins > 10) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getTimeElapsed = (sentAt: string) => {
    const mins = dayjs().diff(dayjs(sentAt), 'minute');
    return `${mins}m`;
  };

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-500">Cargando...</div>;

  return (
    <div className="h-full bg-gray-900 p-4 overflow-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders?.map((order: any) => {
          const oldestSent = order.items?.find((i: any) => i.sent_at)?.sent_at;
          return (
            <div key={order.id} className="bg-gray-800 rounded-xl overflow-hidden">
              {/* Header */}
              <div className={`p-3 flex justify-between items-center ${oldestSent ? getTimeColor(oldestSent) : 'bg-gray-700'}`}>
                <div className="flex items-center gap-2 text-white">
                  <span className="font-bold text-lg">{order.table_label ? `Mesa ${order.table_label}` : 'Rápido'}</span>
                  <span className="text-sm opacity-80">#{order.daily_number}</span>
                </div>
                {oldestSent && (
                  <div className="flex items-center gap-1 text-white text-sm">
                    <Clock size={14} />
                    <span>{getTimeElapsed(oldestSent)}</span>
                  </div>
                )}
              </div>

              {/* Items */}
              <div className="p-2 space-y-1">
                {order.items?.map((item: any) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.status === 'sent') markPreparing.mutate(item.id);
                      else if (item.status === 'preparing') markReady.mutate(item.id);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition-colors ${
                      item.status === 'sent' ? 'bg-gray-700 hover:bg-blue-900' :
                      item.status === 'preparing' ? 'bg-amber-900/50 hover:bg-amber-900' :
                      'bg-emerald-900/50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        {item.status === 'preparing' && <ChefHat size={14} className="text-amber-400" />}
                        {item.status === 'ready' && <Check size={14} className="text-emerald-400" />}
                        <span className="font-medium">{item.quantity}x {item.product_name}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {item.status === 'sent' ? 'Toca para preparar' :
                         item.status === 'preparing' ? 'Toca cuando listo' : 'Listo'}
                      </span>
                    </div>
                    {item.notes && <p className="text-xs text-amber-400 mt-1">* {item.notes}</p>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {(!orders || orders.length === 0) && (
          <div className="col-span-full flex flex-col items-center justify-center text-gray-500 py-20">
            <ChefHat size={48} />
            <p className="mt-2 text-lg">No hay ordenes pendientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
