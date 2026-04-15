import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';

// ── Module config ─────────────────────────────────────────────────────────────
export interface ModuleConfig { module: string; enabled: boolean; }

export function useModuleConfig() {
  return useQuery<ModuleConfig[]>({
    queryKey: ['admin', 'modules'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/config/modules');
      return data;
    },
  });
}

export function useUpdateModules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: ModuleConfig[]) =>
      apiClient.put('/admin/config/modules', { updates }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'modules'] }),
  });
}

// ── Sequences ─────────────────────────────────────────────────────────────────
export interface SequenceConfig {
  id: string; docType: string; prefix: string; nextNumber: number; padLength: number;
}

export function useSequences() {
  return useQuery<SequenceConfig[]>({
    queryKey: ['admin', 'sequences'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/config/sequences');
      return data;
    },
  });
}

export function useUpdateSequence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<SequenceConfig> & { id: string }) =>
      apiClient.put(`/admin/config/sequences/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sequences'] }),
  });
}

// ── Users ─────────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string; firstName: string; lastName: string; email: string;
  role: { id: string; name: string }; isActive: boolean; createdAt: string;
}

export function useAdminUsers() {
  return useQuery<AdminUser[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/users');
      return data.data;
    },
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<AdminUser, 'id' | 'createdAt'> & { password: string }) =>
      apiClient.post('/admin/users', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AdminUser> & { id: string }) =>
      apiClient.put(`/admin/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

// ── Roles ─────────────────────────────────────────────────────────────────────
export interface Role {
  id: string; name: string; description?: string;
  permissions: Array<{ module: string; resource: string; action: string }>;
}

export function useRoles() {
  return useQuery<Role[]>({
    queryKey: ['admin', 'roles'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/roles');
      return data;
    },
  });
}

export function useCreateRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      apiClient.post('/admin/roles', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, permissions }: { id: string; permissions: Role['permissions'] }) =>
      apiClient.put(`/admin/roles/${id}/permissions`, { permissions }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });
}
