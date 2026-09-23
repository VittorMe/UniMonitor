import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';

import { ROLES, ROLE_LABELS, type Role } from '@/features/auth/auth.types';
import { useAuth } from '@/features/auth/auth-context';
import { extractErrorMessage } from '@/shared/api/http-client';
import { usersApi, usersQueryKeys } from './users.api';

const PER_PAGE = 10;

const emptyForm = { name: '', email: '', password: '', role: 'STUDENT' as Role };

export const UsersPage = () => {
  const queryClient = useQueryClient();
  const { user: currentUser, hasRole } = useAuth();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const listParams = {
    page,
    perPage: PER_PAGE,
    ...(search.trim() ? { search: search.trim() } : {}),
  };

  const { data, isPending, isError, error } = useQuery({
    queryKey: usersQueryKeys.list(listParams),
    queryFn: () => usersApi.list(listParams),
    // Mantem a pagina anterior visivel durante a troca, evitando o salto de layout.
    placeholderData: (previous) => previous,
  });

  const invalidateList = () =>
    queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });

  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: async (created) => {
      setForm(emptyForm);
      setFeedback({ type: 'success', text: `Usuario ${created.name} criado` });
      await invalidateList();
    },
    onError: (mutationError) => {
      setFeedback({ type: 'error', text: extractErrorMessage(mutationError) });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive }),
    onSuccess: invalidateList,
    onError: (mutationError) => {
      setFeedback({ type: 'error', text: extractErrorMessage(mutationError) });
    },
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    createMutation.mutate(form);
  };

  const canManage = hasRole('ADMIN');
  const meta = data?.meta;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Usuarios</h1>
          <p className="muted">Controle de acesso ao UniMonitor</p>
        </div>
      </header>

      {feedback && (
        <p className={`alert alert-${feedback.type}`} role="alert">
          {feedback.text}
        </p>
      )}

      {canManage && (
        <form className="card form-inline" onSubmit={handleCreate}>
          <h2>Novo usuario</h2>
          <div className="form-grid">
            <label className="field">
              <span>Nome</span>
              <input
                required
                minLength={3}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Senha provisoria</span>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Perfil</span>
              <select
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            className="button button-primary"
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? 'Salvando...' : 'Criar usuario'}
          </button>
        </form>
      )}

      <div className="card">
        <div className="toolbar">
          <input
            type="search"
            placeholder="Buscar por nome ou e-mail"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>

        {isPending && <p className="muted">Carregando usuarios...</p>}
        {isError && <p className="alert alert-error">{extractErrorMessage(error)}</p>}

        {data && (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Situacao</th>
                  {canManage && <th aria-label="Acoes" />}
                </tr>
              </thead>
              <tbody>
                {data.data.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td>{ROLE_LABELS[user.role]}</td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge-ok' : 'badge-off'}`}>
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="cell-actions">
                        <button
                          type="button"
                          className="button button-ghost"
                          // O backend recusa desativar a propria conta; desabilitar
                          // aqui evita oferecer uma acao que sempre falharia.
                          disabled={user.id === currentUser?.id || toggleActiveMutation.isPending}
                          onClick={() =>
                            toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive })
                          }
                        >
                          {user.isActive ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={canManage ? 5 : 4} className="muted">
                      Nenhum usuario encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {meta && (
              <footer className="pagination">
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  Anterior
                </button>
                <span className="muted">
                  Pagina {meta.page} de {meta.totalPages} ({meta.total} no total)
                </span>
                <button
                  type="button"
                  className="button button-ghost"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Proxima
                </button>
              </footer>
            )}
          </>
        )}
      </div>
    </section>
  );
};
