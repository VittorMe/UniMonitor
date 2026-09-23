import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import { catalogApi } from '@/features/domain/api';
import { extractErrorMessage } from '@/shared/api/http-client';
import { ROLE_LABELS } from './auth.types';
import { AUTH_QUERY_KEY } from './AuthProvider';
import { authApi } from './auth.api';
import { useAuth } from './auth-context';

type ProfileTab = 'dados' | 'senha';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, profile, period } = useAuth();
  const [tab, setTab] = useState<ProfileTab>('dados');
  const courses = useQuery({ queryKey: ['course-options'], queryFn: catalogApi.courseOptions });

  const canEditAcademic = Boolean(profile?.studentId || profile?.professorId);
  const canEditCourse = Boolean(profile?.studentId);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [registration, setRegistration] = useState('');
  const [courseId, setCourseId] = useState('');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setRegistration(profile?.registration ?? '');
    setCourseId(profile?.courseId ?? '');
  }, [user, profile]);

  const saveProfile = useMutation({
    mutationFn: authApi.updateProfile,
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, data);
      setProfileMessage({ type: 'success', text: 'Perfil atualizado' });
    },
    onError: (error) => {
      setProfileMessage({ type: 'error', text: extractErrorMessage(error) });
    },
  });

  const savePassword = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: async () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.clear();
      navigate('/login', { replace: true });
    },
    onError: (error) => {
      setPasswordMessage({ type: 'error', text: extractErrorMessage(error) });
    },
  });

  const submitProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileMessage(null);
    saveProfile.mutate({
      name,
      email,
      ...(canEditAcademic ? { registration } : {}),
      ...(canEditCourse ? { courseId } : {}),
    });
  };

  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'A confirmacao nao confere com a nova senha' });
      return;
    }
    savePassword.mutate({ currentPassword, newPassword });
  };

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Perfil</h1>
          <p className="muted">Atualize seus dados de acesso e academicos</p>
        </div>
      </header>

      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'dados'}
          className={`tab${tab === 'dados' ? ' is-active' : ''}`}
          onClick={() => setTab('dados')}
        >
          Dados pessoais
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'senha'}
          className={`tab${tab === 'senha' ? ' is-active' : ''}`}
          onClick={() => setTab('senha')}
        >
          Senha
        </button>
      </div>

      {tab === 'dados' && (
        <form className="card form-inline" onSubmit={submitProfile}>
          <p className="muted">
            {user ? ROLE_LABELS[user.role] : ''}
            {period ? ` · periodo ${period.label}` : ''}
          </p>
          <div className="form-grid">
            <label className="field">
              <span>Nome</span>
              <input required minLength={3} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {canEditAcademic && (
              <label className="field">
                <span>Matricula</span>
                <input required minLength={3} value={registration} onChange={(e) => setRegistration(e.target.value)} />
              </label>
            )}
            {canEditCourse && (
              <label className="field">
                <span>Curso</span>
                <select required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                  <option value="">Selecione</option>
                  {courses.data?.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {profileMessage && (
            <p className={`alert alert-${profileMessage.type === 'success' ? 'success' : 'error'}`}>{profileMessage.text}</p>
          )}
          <button className="button button-primary" type="submit" disabled={saveProfile.isPending}>
            {saveProfile.isPending ? 'Salvando...' : 'Salvar alteracoes'}
          </button>
        </form>
      )}

      {tab === 'senha' && (
        <form className="card form-inline" onSubmit={submitPassword}>
          <p className="muted">Depois de trocar a senha voce precisara entrar novamente.</p>
          <div className="form-grid">
            <label className="field">
              <span>Senha atual</span>
              <input
                required
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Nova senha</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Confirmar nova senha</span>
              <input
                required
                type="password"
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          </div>
          {passwordMessage && <p className="alert alert-error">{passwordMessage.text}</p>}
          <button className="button button-primary" type="submit" disabled={savePassword.isPending}>
            {savePassword.isPending ? 'Atualizando...' : 'Atualizar senha'}
          </button>
        </form>
      )}
    </section>
  );
};
