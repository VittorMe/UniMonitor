import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { FullPageLoader } from '@/shared/components/FullPageLoader';
import { useAuth } from './auth-context';
import type { Role } from './auth.types';

interface ProtectedRouteProps {
  /** Se omitido, basta estar autenticado. */
  allowedRoles?: Role[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // Sem esta espera, um usuario logado seria jogado para o login no reload,
  // porque a verificacao da sessao ainda estaria em andamento.
  if (isLoading) {
    return <FullPageLoader message="Verificando sessao..." />;
  }

  if (!isAuthenticated) {
    // Guarda a rota pretendida para retomar apos o login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/sem-permissao" replace />;
  }

  return <Outlet />;
};
