import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../config/api';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data),
  });
}

export function useCategoryTree() {
  return useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: () => api.get('/categories/tree').then(r => r.data),
  });
}

export function useProducts(categoryId?: number) {
  return useQuery({
    queryKey: ['products', categoryId],
    queryFn: () => api.get('/products', { params: categoryId ? { category_id: categoryId } : {} }).then(r => r.data),
  });
}

export function useAllProducts() {
  return useQuery({
    queryKey: ['products', 'all'],
    queryFn: () => api.get('/products', { params: { all: 'true' } }).then(r => r.data),
  });
}

export function useProduct(id: number | null) {
  return useQuery({
    queryKey: ['products', 'detail', id],
    queryFn: () => api.get(`/products/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/categories', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/categories/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/products', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['modifier-groups'] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/products/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['modifier-groups'] });
    },
  });
}

export function useModifierGroups() {
  return useQuery({
    queryKey: ['modifier-groups'],
    queryFn: () => api.get('/modifier-groups').then(r => r.data),
  });
}

export function useCreateModifierGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/modifier-groups', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modifier-groups'] }),
  });
}

export function useUpdateModifierGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: any) => api.put(`/modifier-groups/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modifier-groups'] }),
  });
}
