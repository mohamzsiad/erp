import apiClient from './client';
import type { LoginRequest, LoginResponse } from '@clouderp/shared';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return data;
  },

  refresh: async (): Promise<{ accessToken: string }> => {
    const { data } = await apiClient.post<{ accessToken: string }>('/auth/refresh');
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  me: async (): Promise<LoginResponse> => {
    const { data } = await apiClient.get<LoginResponse>('/auth/me');
    return data;
  },
};
