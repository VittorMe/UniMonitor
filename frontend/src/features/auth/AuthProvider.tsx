import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, type ReactNode } from 'react';

import { bumpAuthEpoch, onSessionExpired } from '@/shared/api/http-client';
import { authApi } from './auth.api';
import { AuthContext, type AuthContextValue } from './auth-context';
import {
  effectiveUser,
  toSessionResponse,
  type LoginCredentials,
  type Role,
  type User,
} from './auth.types';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

const persistSession = (queryClient: ReturnType<typeof useQueryClient>, session: unknown) => {
  bumpAuthEpoch();
  queryClient.setQueryData(AUTH_QUERY_KEY, session);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();

  // A sessao vive nos cookies httpOnly, que o JavaScript nao consegue ler.
  // Por isso o estado de autenticacao vem sempre do servidor via /auth/me.
  const { data, isPending } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: authApi.session,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });

  const session = toSessionResponse(data);
  const user = session ? effectiveUser(session) : null;

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (loggedSession) => {
      queryClient.clear();
      persistSession(queryClient, loggedSession);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    // Limpa o cache mesmo se a chamada falhar: localmente a sessao terminou.
    onSettled: () => {
      bumpAuthEpoch();
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.clear();
    },
  });

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.setQueryData(AUTH_QUERY_KEY, null);
      }),
    [queryClient],
  );

  const login = useCallback(async (credentials: LoginCredentials): Promise<User> => {
    const loggedSession = await loginMutation.mutateAsync(credentials);
    return effectiveUser(loggedSession);
  }, [loginMutation]);

  const logout = useCallback(() => logoutMutation.mutateAsync(), [logoutMutation]);

  const hasRole = useCallback((...roles: Role[]) => (user ? roles.includes(user.role) : false), [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile: session?.profile ?? null,
      period: session?.period ?? null,
      isLoading: isPending,
      isAuthenticated: Boolean(user),
      login,
      logout,
      hasRole,
    }),
    [user, session, isPending, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
