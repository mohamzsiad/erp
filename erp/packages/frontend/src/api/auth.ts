import apiClient from './client';
import { useAuthStore } from '../store/authStore';
import type { LoginRequest, LoginResponse } from '@clouderp/shared';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return data;
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    const refreshToken = useAuthStore.getState().refreshToken;
    const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh', { refreshToken });
    return data;
  },

  logout: async (): Promise<void> => {
    const refreshToken = useAuthStore.getState().refreshToken;
    await apiClient.post('/auth/logout', { refreshToken });
  },

  me: async (): Promise<LoginResponse> => {
    const { data } = await apiClient.get<LoginResponse>('/auth/me');
    return data;
  },
};
