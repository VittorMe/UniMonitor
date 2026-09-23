import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { ROLE_LABELS, type Role } from '@/features/auth/auth.types';
import { useAuth } from '@/features/auth/auth-context';
import { notificationsApi } from '@/features/domain/api';
import { BrandMark } from '@/shared/components/BrandMark';
import { ThemeToggle } from '@/shared/components/ThemeToggle';

interface NavLinkItem {
  to: string;
  label: string;
  end?: boolean;
}

interface NavGroupItem {
  id: string;
  label: string;
  roles: Role[];
  children: NavLinkItem[];
}

const PRIMARY_LINKS: Array<NavLinkItem & { roles?: Role[] }> = [{ to: '/', label: 'Painel', end: true }];

const NAV_GROUPS: NavGroupItem[] = [
  {
    id: 'cadastros',
    label: 'Cadastros',
    roles: ['ADMIN'],
    children: [
      { to: '/cursos', label: 'Cursos' },
      { to: '/disciplinas', label: 'Disciplinas' },
      { to: '/salas', label: 'Salas' },
    ],
  },
  {
    id: 'pessoas',
    label: 'Pessoas',
    roles: ['ADMIN'],
    children: [
      { to: '/professores', label: 'Professores' },
      { to: '/alunos', label: 'Alunos' },
      { to: '/usuarios', label: 'Usuarios' },
    ],
  },
  {
    id: 'monitorias',
    label: 'Monitorias',
    roles: ['STUDENT', 'MONITOR'],
    children: [
      { to: '/monitorias', label: 'Encontrar vaga' },
      { to: '/agenda', label: 'Minha agenda' },
      { to: '/presenca', label: 'Confirmar presenca' },
    ],
  },
  {
    id: 'sessoes',
    label: 'Sessoes',
    roles: ['MONITOR'],
    children: [
      { to: '/sessoes/nova', label: 'Nova sessao' },
      { to: '/disponibilidade', label: 'Disponibilidade' },
      { to: '/feedback', label: 'Meu feedback' },
    ],
  },
];

const initialsOf = (name?: string) =>
  (name ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

const pathMatches = (pathname: string, to: string, end?: boolean) => {
  if (end || to === '/') return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
};

const Chevron = () => (
  <svg className="nav-caret" viewBox="0 0 20 20" width="12" height="12" aria-hidden="true">
    <path fill="currentColor" d="M5.2 7.5 10 12.2l4.8-4.7 1.4 1.4L10 15 3.8 8.9z" />
  </svg>
);

const closeSiblingMenus = (event: { currentTarget: HTMLElement }) => {
  const root = event.currentTarget.closest('.topbar');
  root?.querySelectorAll('details[open]').forEach((node) => {
    if (node !== event.currentTarget) {
      node.removeAttribute('open');
    }
  });
};

const MenuPanel = ({ children, align = 'left' }: { children: ReactNode; align?: 'left' | 'right' }) => (
  <div className={`menu-panel menu-panel-${align}`}>{children}</div>
);

export const AppLayout = () => {
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  });
  const readAll = useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const closeMobile = () => setMenuOpen(false);
  const groups = NAV_GROUPS.filter((group) => hasRole(...group.roles)).map((group) =>
    group.id === 'monitorias' && hasRole('MONITOR') ? { ...group, label: 'Como aluno' } : group,
  );
  const unread = notifications.data?.unread ?? 0;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand-link" end>
            <BrandMark />
          </NavLink>

          <button
            type="button"
            className="icon-button nav-toggle"
            aria-expanded={menuOpen}
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M4 7h16v2H4V7Zm0 4h16v2H4v-2Zm0 4h16v2H4v-2Z" />
            </svg>
          </button>

          <nav className={`top-nav${menuOpen ? ' is-open' : ''}`}>
            {PRIMARY_LINKS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                onClick={closeMobile}
              >
                {item.label}
              </NavLink>
            ))}

            {groups.map((group) => {
              const active = group.children.some((child) => pathMatches(location.pathname, child.to, child.end));
              return (
                <details key={group.id} className="nav-group" onToggle={closeSiblingMenus}>
                  <summary className={`nav-link${active ? ' is-active' : ''}`}>
                    {group.label}
                    <Chevron />
                  </summary>
                  <MenuPanel>
                    {group.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        end={child.end}
                        className={({ isActive }) => `menu-item${isActive ? ' is-active' : ''}`}
                        onClick={closeMobile}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </MenuPanel>
                </details>
              );
            })}
          </nav>

          <div className="topbar-actions">
            <ThemeToggle />
            <details className="notif" onToggle={closeSiblingMenus}>
              <summary className="icon-button" aria-label="Notificacoes">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 3a6 6 0 0 1 6 6v2.3c0 .6.2 1.2.6 1.7l1 1.2A1 1 0 0 1 19 16H5a1 1 0 0 1-.6-1.8l1-1.2c.4-.5.6-1.1.6-1.7V9a6 6 0 0 1 6-6Zm0 18a2.5 2.5 0 0 1-2.5-2.5h5A2.5 2.5 0 0 1 12 21Z"
                  />
                </svg>
                {unread > 0 ? <span className="notif-dot">{unread}</span> : null}
              </summary>
              <div className="notif-panel">
                <button type="button" className="button button-ghost" onClick={() => readAll.mutate()}>
                  Marcar todas como lidas
                </button>
                {notifications.data?.data.slice(0, 8).map((item) => (
                  <p key={item.id} className={item.readAt ? 'muted' : ''}>
                    <strong>{item.title}</strong>
                    <br />
                    {item.message}
                  </p>
                ))}
                {notifications.data?.data.length === 0 && <p className="muted">Nenhuma notificacao.</p>}
              </div>
            </details>

            <details className="user-menu" onToggle={closeSiblingMenus}>
              <summary className="user-menu-trigger" aria-label="Conta">
                <span className="user-avatar">{initialsOf(user?.name)}</span>
              </summary>
              <MenuPanel align="right">
                <div className="user-menu-meta">
                  <strong>{user?.name}</strong>
                  <span className={`role-chip role-${user?.role.toLowerCase() ?? 'student'}`}>
                    {user ? ROLE_LABELS[user.role] : ''}
                  </span>
                </div>
                <NavLink
                  to="/perfil"
                  className="menu-item"
                  onClick={(event) => {
                    closeMobile();
                    event.currentTarget.closest('details')?.removeAttribute('open');
                  }}
                >
                  Editar perfil
                </NavLink>
                <button type="button" className="menu-item menu-item-button" onClick={handleLogout}>
                  Sair
                </button>
              </MenuPanel>
            </details>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="page-wrap">
          <Outlet />
        </div>
      </main>
      <footer className="app-footer">UniMonitor - By Vittor Melo</footer>
    </div>
  );
};
