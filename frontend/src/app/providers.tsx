import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { useState, type ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { ThemeProvider } from '@/shared/theme/ThemeProvider';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        refetchOnWindowFocus: false,
        // 401/403 nao se resolvem com nova tentativa; repetir apenas
        // as falhas que podem ser transitorias.
        retry: (failureCount, error) => {
          const status = axios.isAxiosError(error) ? error.response?.status : undefined;

          if (status && status >= 400 && status < 500) {
            return false;
          }

          return failureCount < 2;
        },
      },
    },
  });

export const AppProviders = ({ children }: { children: ReactNode }) => {
  // useState garante um unico client por montagem da aplicacao,
  // sem recria-lo a cada render.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};
