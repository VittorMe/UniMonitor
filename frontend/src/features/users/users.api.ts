import { httpClient } from '@/shared/api/http-client';
import type { Role, User } from '@/features/auth/auth.types';

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export interface ListUsersParams {
  page?: number;
  perPage?: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export type UpdateUserPayload = Partial<{
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}>;

export const usersApi = {
  list: async (params: ListUsersParams): Promise<{ data: User[]; meta: PaginationMeta }> => {
    const { data } = await httpClient.get<{ data: User[]; meta: PaginationMeta }>('/users', {
      params,
    });
    return data;
  },

  create: async (payload: CreateUserPayload): Promise<User> => {
    const { data } = await httpClient.post<{ user: User }>('/users', payload);
    return data.user;
  },

  update: async (id: string, payload: UpdateUserPayload): Promise<User> => {
    const { data } = await httpClient.patch<{ user: User }>(`/users/${id}`, payload);
    return data.user;
  },

  remove: async (id: string): Promise<void> => {
    await httpClient.delete(`/users/${id}`);
  },
};

/** Chaves centralizadas para invalidar o cache sem strings soltas pelo codigo. */
export const usersQueryKeys = {
  all: ['users'] as const,
  list: (params: ListUsersParams) => ['users', 'list', params] as const,
};
