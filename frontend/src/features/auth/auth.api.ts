import { httpClient } from '@/shared/api/http-client';
import type { LoginCredentials, RegisterPayload, SessionResponse } from './auth.types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<SessionResponse> => {
    const { data } = await httpClient.post<SessionResponse>('/auth/login', credentials);
    return data;
  },

  register: async (payload: RegisterPayload): Promise<SessionResponse> => {
    const { data } = await httpClient.post<SessionResponse>('/auth/register', payload);
    return data;
  },

  session: async (): Promise<SessionResponse> => {
    const { data } = await httpClient.get<SessionResponse>('/auth/me');
    return data;
  },

  updateProfile: async (payload: {
    name?: string;
    email?: string;
    registration?: string;
    courseId?: string;
  }): Promise<SessionResponse> => {
    const { data } = await httpClient.patch<SessionResponse>('/auth/me', payload);
    return data;
  },

  changePassword: async (payload: { currentPassword: string; newPassword: string }): Promise<void> => {
    await httpClient.patch('/auth/password', payload);
  },

  logout: async (): Promise<void> => {
    await httpClient.post('/auth/logout');
  },
};
