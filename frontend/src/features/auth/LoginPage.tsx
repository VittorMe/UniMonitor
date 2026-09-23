import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';

import { BrandMark } from '@/shared/components/BrandMark';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { extractErrorMessage } from '@/shared/api/http-client';
import { useAuth } from './auth-context';

export const LoginPage = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  if (!isLoading && isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Nao foi possivel entrar'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-layout">
      <div className="auth-top">
        <BrandMark />
        <ThemeToggle />
      </div>
      <form className="card auth-card" onSubmit={handleSubmit}>
        <header className="auth-header">
          <h1>Entrar</h1>
          <p>Acesse a plataforma de monitoria academica</p>
        </header>

        <label className="field">
          <span>E-mail</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="seu.email@exemplo.com"
          />
        </label>

        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
          />
        </label>

        {errorMessage && (
          <p className="alert alert-error" role="alert">
            {errorMessage}
          </p>
        )}

        <button type="submit" className="button button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>

        <p className="muted" style={{ textAlign: 'center' }}>
          Aluno novo? <Link to="/cadastro">Criar conta</Link>
        </p>
      </form>
    </div>
  );
};
