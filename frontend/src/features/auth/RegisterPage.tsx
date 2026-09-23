import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { BrandMark } from '@/shared/components/BrandMark';
import { ThemeToggle } from '@/shared/components/ThemeToggle';
import { extractErrorMessage, bumpAuthEpoch } from '@/shared/api/http-client';
import { catalogApi } from '@/features/domain/api';
import { AUTH_QUERY_KEY } from './AuthProvider';
import { authApi } from './auth.api';
import { useAuth } from './auth-context';

export const RegisterPage = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const coursesQuery = useQuery({ queryKey: ['public-courses'], queryFn: catalogApi.publicCourses });

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    registration: '',
    courseId: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      const session = await authApi.register(form);
      bumpAuthEpoch();
      queryClient.clear();
      queryClient.setQueryData(AUTH_QUERY_KEY, session);
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Nao foi possivel criar a conta'));
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
          <h1>Criar conta</h1>
          <p>Cadastro de aluno no UniMonitor</p>
        </header>
        <label className="field">
          <span>Nome</span>
          <input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="field">
          <span>E-mail</span>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label className="field">
          <span>Matricula</span>
          <input required value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} />
        </label>
        <label className="field">
          <span>Curso</span>
          <select required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">Selecione</option>
            {coursesQuery.data?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Senha</span>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        {errorMessage && <p className="alert alert-error">{errorMessage}</p>}
        <button type="submit" className="button button-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Criando...' : 'Criar conta'}
        </button>
        <p className="muted" style={{ textAlign: 'center' }}>
          Ja tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
};
