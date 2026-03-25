import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';
import { useCallback } from 'react';
import { useSocketEvent } from './useSocket';

export function useFloors() {
  return useQuery({
    queryKey: ['floors'],
    queryFn: () => api.get('/floors').then(r => r.data),
  });
}

export function useTables(floorId: number | null) {
  const qc = useQueryClient();

  const onTableChanged = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['tables', floorId] });
  }, [qc, floorId]);

  useSocketEvent('table:status_changed', onTableChanged);

  return useQuery({
    queryKey: ['tables', floorId],
    queryFn: () => api.get(`/floors/${floorId}/tables`).then(r => r.data),
    enabled: !!floorId,
    refetchInterval: 15000,
  });
}

export function useCreateFloor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => api.post('/floors', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['floors'] }),
  });
}

export function useCreateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/floors/tables', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  });
}

export function useUpdateTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/floors/tables/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  });
}

export function useDeleteTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/floors/tables/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  });
}

export function useTransferTable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, targetId }: { sourceId: number; targetId: number }) =>
      api.post(`/floors/tables/${sourceId}/transfer`, { target_table_id: targetId }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tables'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
