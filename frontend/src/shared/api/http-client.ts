import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }> | unknown;
  };
}

export const httpClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
  // Obrigatorio para que o navegador envie os cookies de sessao httpOnly.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/** Rotas de sessao nao devem disparar refresh: evita recursao no proprio fluxo. */
const AUTH_EXEMPT_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/password'];

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

// Refreshes concorrentes sao unificados nesta promise: com varias requisicoes
// falhando em 401 ao mesmo tempo, apenas uma chamada de refresh acontece.
// Isso importa porque o refresh token rotaciona e chamadas paralelas
// disparariam a deteccao de reuso, derrubando a sessao do usuario.
let refreshInFlight: Promise<void> | null = null;
let authEpoch = 0;

/** Incrementa quando o login/logout troca a sessao, para ignorar 401 atrasados. */
export const bumpAuthEpoch = (): void => {
  authEpoch += 1;
};

const refreshSession = (): Promise<void> => {
  refreshInFlight ??= httpClient
    .post('/auth/refresh')
    .then(() => undefined)
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
};

/** Notifica a aplicacao quando a sessao termina, para redirecionar ao login. */
type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export const onSessionExpired = (listener: SessionExpiredListener): (() => void) => {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
};

httpClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const config = error.config as RetriableConfig | undefined;
    const isUnauthorized = error.response?.status === 401;
    const isExempt = AUTH_EXEMPT_PATHS.some((path) => config?.url?.includes(path));

    if (!isUnauthorized || isExempt || !config || config._retried) {
      return Promise.reject(error);
    }

    config._retried = true;
    const epoch = authEpoch;

    try {
      await refreshSession();
      return await httpClient(config);
    } catch {
      if (epoch !== authEpoch) {
        return Promise.reject(error);
      }
      sessionExpiredListeners.forEach((listener) => listener());
      return Promise.reject(error);
    }
  },
);

/** Extrai a mensagem da API, com fallback para falhas de rede. */
export const extractErrorMessage = (error: unknown, fallback = 'Erro inesperado'): string => {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data?.error?.message ?? error.message ?? fallback;
  }

  return error instanceof Error ? error.message : fallback;
};
