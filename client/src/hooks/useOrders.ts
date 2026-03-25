import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import toast from 'react-hot-toast';
import { useCallback } from 'react';
import { useSocketEvent } from './useSocket';

export function useActiveOrders() {
  return useQuery({
    queryKey: ['orders', 'active'],
    queryFn: () => api.get('/orders').then(r => r.data),
    refetchInterval: 30000,
  });
}

export function useOrder(id: number | null) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => api.get(`/orders/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useOrderByTable(tableId: number | null) {
  return useQuery({
    queryKey: ['orders', 'table', tableId],
    queryFn: () => api.get(`/orders/table/${tableId}`).then(r => r.data),
    enabled: !!tableId,
    retry: false,
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { table_id?: number | null; order_type?: 'dine_in' | 'quick'; guest_count?: number }) =>
      api.post('/orders', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
    },
  });
}

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, ...data }: { orderId: number; product_id: number; quantity?: number; notes?: string; modifiers?: { modifier_id: number }[] }) =>
      api.post(`/orders/${orderId}/items`, data).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
      qc.invalidateQueries({ queryKey: ['orders', 'table'] });
    },
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, ...data }: { orderId: number; itemId: number; quantity?: number; notes?: string; status?: string }) =>
      api.put(`/orders/${orderId}/items/${itemId}`, data).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
    },
  });
}

export function useRemoveItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId }: { orderId: number; itemId: number }) =>
      api.delete(`/orders/${orderId}/items/${itemId}`).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
    },
  });
}

export function useSendToKitchen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) =>
      api.post(`/orders/${orderId}/send`).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Orden enviada a cocina');
    },
  });
}

export function useSetDiscount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, discount_percent, preset_id, authorized_by }: { orderId: number; discount_percent: number; preset_id?: number | null; authorized_by?: number | null }) =>
      api.patch(`/orders/${orderId}/discount`, { discount_percent, preset_id, authorized_by }).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
    },
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) =>
      api.post(`/orders/${orderId}/cancel`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Orden cancelada');
    },
  });
}

export function useKitchenOrders() {
  const qc = useQueryClient();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['kitchen'] });
  }, [qc]);

  useSocketEvent('order:sent', invalidate);
  useSocketEvent('kitchen:item_ready', invalidate);
  useSocketEvent('kitchen:item_preparing', invalidate);

  return useQuery({
    queryKey: ['kitchen'],
    queryFn: () => api.get('/orders/kitchen').then(r => r.data),
    refetchInterval: 10000,
  });
}

export function useMarkItemReady() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) =>
      api.patch(`/orders/items/${itemId}/ready`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen'] });
    },
  });
}

export function useMarkItemPreparing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) =>
      api.patch(`/orders/items/${itemId}/preparing`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kitchen'] });
    },
  });
}

export function useCancelItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, itemId, reason }: { orderId: number; itemId: number; reason: string }) =>
      api.post(`/orders/${orderId}/items/${itemId}/cancel`, { reason }).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Producto cancelado');
    },
  });
}

export function useChangeWaiter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, waiter_id }: { orderId: number; waiter_id: number }) =>
      api.patch(`/orders/${orderId}/waiter`, { waiter_id }).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
      toast.success('Mesero cambiado');
    },
  });
}

export function useChangeTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, table_id }: { orderId: number; table_id: number }) =>
      api.patch(`/orders/${orderId}/table`, { table_id }).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
      qc.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Mesa cambiada');
    },
  });
}

export function useMergeOrders() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceOrderId, target_order_id }: { sourceOrderId: number; target_order_id: number }) =>
      api.post(`/orders/${sourceOrderId}/merge`, { target_order_id }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Cuentas juntadas');
    },
  });
}

export function useSetTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, amount }: { orderId: number; amount: number }) =>
      api.patch(`/orders/${orderId}/tip`, { amount }).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
    },
  });
}

export function useSetObservations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, notes }: { orderId: number; notes: string }) =>
      api.patch(`/orders/${orderId}/observations`, { notes }).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
    },
  });
}

export function useSetGuestCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, guest_count }: { orderId: number; guest_count: number }) =>
      api.patch(`/orders/${orderId}/guests`, { guest_count }).then(r => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['orders', data.id], data);
    },
  });
}

export function useCancellationReasons() {
  return useQuery({
    queryKey: ['cancellation-reasons'],
    queryFn: () => api.get('/orders/meta/cancellation-reasons').then(r => r.data),
  });
}
