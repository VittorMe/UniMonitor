import { createContext, useContext } from 'react';

import type { AcademicPeriod, AuthProfile, LoginCredentials, Role, User } from './auth.types';

export interface AuthContextValue {
  user: User | null;
  profile: AuthProfile | null;
  period: AcademicPeriod | null;
  /** `true` enquanto a sessao existente ainda esta sendo verificada no boot. */
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  }

  return context;
};
