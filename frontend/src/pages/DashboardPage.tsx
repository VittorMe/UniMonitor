import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '@/features/auth/auth-context';
import {
  adminApi,
  catalogApi,
  formatCourseCodes,
  formatWhen,
  MODALITY_LABELS,
  monitorApi,
  professorApi,
  STATUS_LABELS,
  studentApi,
} from '@/features/domain/api';
import { extractErrorMessage } from '@/shared/api/http-client';
import { ReviewCard } from '@/pages/ReviewsPages';

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="stat-card">
    <strong>{value}</strong>
    <span>{label}</span>
  </div>
);

export const DashboardPage = () => {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <AdminDashboard />;
  if (user?.role === 'PROFESSOR') return <ProfessorDashboard />;
  if (user?.role === 'MONITOR') return <MonitorDashboard />;
  return <StudentDashboard />;
};

const AdminDashboard = () => {
  const query = useQuery({ queryKey: ['admin-dashboard'], queryFn: adminApi.dashboard });
  const data = query.data;
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Administracao</h1>
          <p className="muted">Indicadores gerais da monitoria</p>
        </div>
      </header>
      <div className="stats-grid">
        <Stat label="Professores" value={data?.professors ?? '-'} />
        <Stat label="Alunos" value={data?.students ?? '-'} />
        <Stat label="Disciplinas" value={data?.subjects ?? '-'} />
        <Stat label="Monitores" value={data?.monitors ?? '-'} />
        <Stat label="Sessoes no mes" value={data?.sessionsThisMonth ?? '-'} />
        <Stat label="Comparecimento" value={data ? `${data.attendanceRate}%` : '-'} />
        <Stat label="Avaliacao media" value={data?.averageRating?.toFixed(1) ?? '-'} />
        <Stat label="Clareza" value={data?.averageClarity?.toFixed(1) ?? '-'} />
        <Stat label="Pontualidade" value={data?.averagePunctuality?.toFixed(1) ?? '-'} />
        <Stat label="Dominio" value={data?.averageMastery?.toFixed(1) ?? '-'} />
      </div>
      <div className="card">
        <h2>Atendimentos por disciplina</h2>
        {(data?.bySubject ?? []).length === 0 && <p className="muted">Ainda nao ha sessoes encerradas.</p>}
        <ul className="bar-list">
          {data?.bySubject.map((item) => (
            <li key={item.name}>
              <span>{item.name}</span>
              <span className="bar" style={{ width: `${Math.min(100, item.count * 8)}%` }} />
              <strong>{item.count}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const ProfessorDashboard = () => {
  const query = useQuery({ queryKey: ['professor-subjects'], queryFn: professorApi.subjects });
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Minhas disciplinas</h1>
          <p className="muted">Cada professor gerencia os monitores da propria turma nesta disciplina</p>
        </div>
      </header>
      <div className="cards-grid">
        {query.data?.map((item) => (
          <article className="card" key={item.id}>
            <h2>{item.subject.name}</h2>
            <p className="muted">
              {item.subject.code}
              {item.subject.courses?.length ? ` · ${formatCourseCodes(item.subject.courses)}` : ''}
            </p>
            <p>
              {item.monitors} monitores · {item.sessionsThisMonth} sessoes no mes
            </p>
            <Link className="button button-primary" to={`/professor/disciplinas/${item.subjectId}`}>
              Gerenciar
            </Link>
          </article>
        ))}
        {query.data?.length === 0 && <p className="muted">Nenhuma disciplina vinculada neste periodo.</p>}
      </div>
    </section>
  );
};

const MonitorDashboard = () => {
  const stats = useQuery({ queryKey: ['monitor-stats'], queryFn: monitorApi.statistics });
  const sessions = useQuery({ queryKey: ['monitor-sessions'], queryFn: monitorApi.sessions });
  const upcoming = sessions.data?.filter((item) => new Date(item.startAt) >= new Date() && item.status !== 'CANCELLED');
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Minha agenda</h1>
          <p className="muted">Sessoes, avaliacoes e comparecimento</p>
        </div>
        <Link className="button button-primary" to="/sessoes/nova">
          Nova sessao
        </Link>
      </header>
      <div className="stats-grid">
        <Stat label="Sessoes realizadas" value={stats.data?.sessionsCompleted ?? '-'} />
        <Stat label="Alunos atendidos" value={stats.data?.studentsAttended ?? '-'} />
        <Stat label="Avaliacao" value={stats.data?.averageRating?.toFixed(1) ?? '-'} />
        <Stat label="Clareza" value={stats.data?.averageClarity?.toFixed(1) ?? '-'} />
        <Stat label="Pontualidade" value={stats.data?.averagePunctuality?.toFixed(1) ?? '-'} />
        <Stat label="Dominio" value={stats.data?.averageMastery?.toFixed(1) ?? '-'} />
        <Stat label="Comparecimento" value={stats.data ? `${stats.data.attendanceRate}%` : '-'} />
      </div>
      <div className="card">
        <h2>Proximas sessoes</h2>
        {upcoming?.slice(0, 6).map((session) => (
          <Link key={session.id} to={`/sessoes/${session.id}`} className="list-row">
            <div>
              <strong>{session.title}</strong>
              <p className="muted">{formatWhen(session.startAt)}</p>
            </div>
            <span className="badge">{STATUS_LABELS[session.status]}</span>
          </Link>
        ))}
        {upcoming?.length === 0 && <p className="muted">Nenhuma sessao futura.</p>}
      </div>
    </section>
  );
};

const StudentDashboard = () => {
  const { user } = useAuth();
  const appointments = useQuery({ queryKey: ['appointments'], queryFn: studentApi.appointments });
  const next = appointments.data?.find(
    (item) =>
      ['PENDING', 'CONFIRMED'].includes(item.status) && new Date(item.session.startAt) >= new Date(),
  );
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h1>Ola, {user?.name}</h1>
          <p className="muted">Encontre monitorias e acompanhe sua agenda</p>
        </div>
        <Link className="button button-primary" to="/monitorias">
          Encontrar monitoria
        </Link>
      </header>
      <div className="card card-accent">
        <h2>Proximo atendimento</h2>
        {next ? (
          <div>
            <p>
              <strong>{next.session.subjectMonitor?.subject.name}</strong>
            </p>
            <p>{next.session.title}</p>
            <p className="muted">
              {formatWhen(next.session.startAt)} · {next.session.room?.name ?? MODALITY_LABELS[next.session.modality]}
            </p>
            <Link to="/agenda">Ver agenda</Link>
          </div>
        ) : (
          <p className="muted">Voce ainda nao tem monitorias confirmadas.</p>
        )}
      </div>
    </section>
  );
};

export const CoursesPage = () => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['courses'], queryFn: () => catalogApi.courses() });
  const [form, setForm] = useState({ name: '', code: '' });
  const create = useMutation({
    mutationFn: catalogApi.createCourse,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['courses'] }),
  });
  return (
    <CrudPage
      title="Cursos"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate(form);
        setForm({ name: '', code: '' });
      }}
    >
      <label className="field">
        <span>Nome</span>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Codigo</span>
        <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
      </label>
      <button className="button button-primary" type="submit">
        Cadastrar
      </button>
      <table className="table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Codigo</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.data.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.code}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CrudPage>
  );
};

export const SubjectsPage = () => {
  const queryClient = useQueryClient();
  const courses = useQuery({ queryKey: ['course-options'], queryFn: catalogApi.courseOptions });
  const professors = useQuery({ queryKey: ['professors'], queryFn: () => adminApi.professors({ perPage: 100 }) });
  const list = useQuery({ queryKey: ['subjects'], queryFn: () => catalogApi.subjects({ perPage: 100 }) });
  const [form, setForm] = useState({ name: '', code: '', courseIds: [] as string[] });
  const [pickedProfessor, setPickedProfessor] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const periodLabel = professors.data?.data[0]?.period?.label;

  const invalidateCatalog = () => {
    void queryClient.invalidateQueries({ queryKey: ['subjects'] });
    void queryClient.invalidateQueries({ queryKey: ['subject-options'] });
    void queryClient.invalidateQueries({ queryKey: ['professors'] });
  };

  const create = useMutation({
    mutationFn: catalogApi.createSubject,
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Disciplina cadastrada' });
      invalidateCatalog();
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });
  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => catalogApi.updateSubject(id, { isActive }),
    onSuccess: (subject) => {
      setFeedback({
        type: 'success',
        text: subject.isActive ? 'Disciplina ativada' : 'Disciplina desativada',
      });
      invalidateCatalog();
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });
  const linkProfessor = useMutation({
    mutationFn: ({ professorId, subjectId }: { professorId: string; subjectId: string }) =>
      adminApi.linkSubject(professorId, subjectId),
    onSuccess: (_data, variables) => {
      setFeedback({ type: 'success', text: 'Professor vinculado a disciplina neste periodo' });
      setPickedProfessor((current) => ({ ...current, [variables.subjectId]: '' }));
      invalidateCatalog();
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });
  const unlinkProfessor = useMutation({
    mutationFn: ({ professorId, subjectId }: { professorId: string; subjectId: string }) =>
      adminApi.unlinkSubject(professorId, subjectId),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Professor retirado da disciplina neste periodo' });
      invalidateCatalog();
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });
  const toggleCourse = (courseId: string) => {
    setForm((current) => ({
      ...current,
      courseIds: current.courseIds.includes(courseId)
        ? current.courseIds.filter((id) => id !== courseId)
        : [...current.courseIds, courseId],
    }));
  };
  const availableProfessors = (linkedIds: string[]) =>
    (professors.data?.data ?? []).filter((item) => !linkedIds.includes(item.id));

  return (
    <section className="page">
      <h1>Disciplinas</h1>
      <p className="muted">
        Desative em vez de apagar. No mesmo periodo, a disciplina pode ter varios professores — um por turma.
        {periodLabel ? ` Periodo atual: ${periodLabel}.` : ''}
      </p>
      {feedback && (
        <p className={`alert alert-${feedback.type === 'success' ? 'success' : 'error'}`} role="alert">
          {feedback.text}
        </p>
      )}
      <form
        className="card form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.courseIds.length === 0) return;
          setFeedback(null);
          create.mutate(form);
          setForm({ name: '', code: '', courseIds: [] });
        }}
      >
        <label className="field">
          <span>Nome</span>
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="field">
          <span>Codigo</span>
          <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
        </label>
        <fieldset className="field">
          <legend>Cursos</legend>
          <p className="muted">Marque todos os cursos que cursam esta disciplina</p>
          <div className="check-list">
            {courses.data?.map((course) => (
              <label className="check" key={course.id}>
                <input
                  type="checkbox"
                  checked={form.courseIds.includes(course.id)}
                  onChange={() => toggleCourse(course.id)}
                />
                <span>
                  {course.name} ({course.code})
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button
          className="button button-primary"
          type="submit"
          style={{ alignSelf: 'start' }}
          disabled={form.courseIds.length === 0 || create.isPending}
        >
          Cadastrar
        </button>
      </form>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Disciplina</th>
              <th>Cursos</th>
              <th>Professores neste periodo</th>
              <th>Situacao</th>
              <th aria-label="Acoes" />
            </tr>
          </thead>
          <tbody>
            {list.data?.data.map((item) => {
              const linked = item.professors ?? [];
              const linkedIds = linked.map((professor) => professor.id);
              const remaining = availableProfessors(linkedIds);
              const selectedProfessorId = pickedProfessor[item.id] ?? '';
              return (
                <tr key={item.id}>
                  <td>
                    {item.name} ({item.code})
                  </td>
                  <td>{formatCourseCodes(item.courses)}</td>
                  <td>
                    <div className="cell-stack">
                      {linked.length === 0 && <span className="muted">Nenhum</span>}
                      {linked.map((professor) => (
                        <div className="list-row" key={professor.id}>
                          <span>{professor.name}</span>
                          <button
                            type="button"
                            className="button button-ghost"
                            disabled={unlinkProfessor.isPending}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Retirar ${professor.name} de ${item.name} neste periodo? Os monitores dele nesta disciplina tambem serao desvinculados.`,
                                )
                              ) {
                                return;
                              }
                              setFeedback(null);
                              unlinkProfessor.mutate({ professorId: professor.id, subjectId: item.id });
                            }}
                          >
                            Retirar
                          </button>
                        </div>
                      ))}
                      {item.isActive && remaining.length > 0 && (
                        <div className="inline-add">
                          <select
                            value={selectedProfessorId}
                            onChange={(event) =>
                              setPickedProfessor((current) => ({ ...current, [item.id]: event.target.value }))
                            }
                            aria-label={`Adicionar professor em ${item.name}`}
                          >
                            <option value="">Adicionar professor</option>
                            {remaining.map((professor) => (
                              <option key={professor.id} value={professor.id}>
                                {professor.user.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className="button button-ghost"
                            disabled={!selectedProfessorId || linkProfessor.isPending}
                            onClick={() => {
                              setFeedback(null);
                              linkProfessor.mutate({ professorId: selectedProfessorId, subjectId: item.id });
                            }}
                          >
                            Vincular
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${item.isActive ? 'badge-ok' : 'badge-off'}`}>
                      {item.isActive ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button
                      type="button"
                      className="button button-ghost"
                      disabled={toggleActive.isPending}
                      onClick={() => {
                        const next = !item.isActive;
                        if (
                          !next &&
                          !window.confirm(
                            `Desativar ${item.name}? Ela some das novas vinculacoes, mas o historico permanece.`,
                          )
                        ) {
                          return;
                        }
                        setFeedback(null);
                        toggleActive.mutate({ id: item.id, isActive: next });
                      }}
                    >
                      {item.isActive ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export const RoomsPage = () => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['rooms'], queryFn: catalogApi.rooms });
  const [form, setForm] = useState({ name: '', building: '', floor: '', capacity: 20 });
  const create = useMutation({
    mutationFn: catalogApi.createRoom,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rooms'] }),
  });
  return (
    <CrudPage
      title="Salas"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate(form);
      }}
    >
      <label className="field">
        <span>Nome</span>
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label className="field">
        <span>Predio</span>
        <input required value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
      </label>
      <label className="field">
        <span>Andar</span>
        <input required value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
      </label>
      <label className="field">
        <span>Capacidade</span>
        <input
          type="number"
          required
          min={1}
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
        />
      </label>
      <button className="button button-primary" type="submit">
        Cadastrar
      </button>
      <table className="table">
        <thead>
          <tr>
            <th>Sala</th>
            <th>Local</th>
            <th>Vagas</th>
          </tr>
        </thead>
        <tbody>
          {list.data?.data.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>
                {item.building} · {item.floor}
              </td>
              <td>{item.capacity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </CrudPage>
  );
};

export const ProfessorsPage = () => {
  const queryClient = useQueryClient();
  const subjects = useQuery({ queryKey: ['subject-options'], queryFn: catalogApi.subjectOptions });
  const list = useQuery({ queryKey: ['professors'], queryFn: () => adminApi.professors({ perPage: 100 }) });
  const [form, setForm] = useState({ name: '', email: '', password: '', registration: '' });
  const [link, setLink] = useState({ professorId: '', subjectId: '' });
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const periodLabel = list.data?.data[0]?.period?.label;

  const invalidateProfessors = () => {
    void queryClient.invalidateQueries({ queryKey: ['professors'] });
    void queryClient.invalidateQueries({ queryKey: ['subjects'] });
  };

  const create = useMutation({
    mutationFn: adminApi.createProfessor,
    onSuccess: () => {
      setForm({ name: '', email: '', password: '', registration: '' });
      setFeedback({ type: 'success', text: 'Professor cadastrado' });
      void invalidateProfessors();
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });
  const linkMut = useMutation({
    mutationFn: () => adminApi.linkSubject(link.professorId, link.subjectId),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Professor vinculado a disciplina neste periodo' });
      void invalidateProfessors();
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });
  const unlinkMut = useMutation({
    mutationFn: ({ professorId, subjectId }: { professorId: string; subjectId: string }) =>
      adminApi.unlinkSubject(professorId, subjectId),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Professor retirado da disciplina neste periodo' });
      void invalidateProfessors();
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });

  return (
    <section className="page">
      <h1>Professores</h1>
      {feedback && (
        <p className={`alert alert-${feedback.type === 'success' ? 'success' : 'error'}`} role="alert">
          {feedback.text}
        </p>
      )}
      <form
        className="card form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setFeedback(null);
          create.mutate(form);
        }}
      >
        <input required placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input required type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input required placeholder="Matricula" value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} />
        <input required minLength={8} type="password" placeholder="Senha" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="button button-primary" type="submit">
          Cadastrar professor
        </button>
      </form>
      <form
        className="card form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          setFeedback(null);
          linkMut.mutate();
        }}
      >
        <h2>Vincular disciplina no periodo atual{periodLabel ? ` (${periodLabel})` : ''}</h2>
        <p className="muted">A mesma disciplina pode ter varios professores no mesmo periodo, um por turma.</p>
        <select required value={link.professorId} onChange={(e) => setLink({ ...link, professorId: e.target.value })}>
          <option value="">Professor</option>
          {list.data?.data.map((item) => (
            <option key={item.id} value={item.id}>
              {item.user.name}
            </option>
          ))}
        </select>
        <select required value={link.subjectId} onChange={(e) => setLink({ ...link, subjectId: e.target.value })}>
          <option value="">Disciplina</option>
          {subjects.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({formatCourseCodes(item.courses)})
            </option>
          ))}
        </select>
        <button className="button button-primary" type="submit" disabled={linkMut.isPending}>
          Vincular
        </button>
      </form>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Matricula</th>
              <th>Disciplinas neste periodo</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.data.map((item) => (
              <tr key={item.id}>
                <td>{item.user.name}</td>
                <td>{item.user.email}</td>
                <td>{item.registration}</td>
                <td>
                  {(item.subjectLinks ?? []).length === 0 && <span className="muted">Nenhuma</span>}
                  {(item.subjectLinks ?? []).map((linkItem) => (
                    <div className="list-row" key={linkItem.id}>
                      <div>
                        <strong>{linkItem.subject.name}</strong>
                        <p className="muted">{linkItem.subject.code}</p>
                      </div>
                      <button
                        type="button"
                        className="button button-ghost"
                        disabled={unlinkMut.isPending}
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Retirar ${item.user.name} de ${linkItem.subject.name} neste periodo? Os monitores dele nesta disciplina tambem serao desvinculados.`,
                            )
                          ) {
                            return;
                          }
                          setFeedback(null);
                          unlinkMut.mutate({ professorId: item.id, subjectId: linkItem.subjectId });
                        }}
                      >
                        Retirar
                      </button>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export const StudentsAdminPage = () => {
  const [search, setSearch] = useState('');
  const list = useQuery({
    queryKey: ['admin-students', search],
    queryFn: () => adminApi.students({ search: search || undefined }),
  });
  return (
    <section className="page">
      <h1>Alunos</h1>
      <div className="card">
        <input placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Matricula</th>
              <th>Curso</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.data.map((item) => (
              <tr key={item.id}>
                <td>{item.user.name}</td>
                <td>{item.registration}</td>
                <td>{item.course?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export const ProfessorSubjectPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const monitors = useQuery({ queryKey: ['monitors', id], queryFn: () => professorApi.monitors(id), enabled: Boolean(id) });
  const sessions = useQuery({ queryKey: ['prof-sessions', id], queryFn: () => professorApi.sessions(id), enabled: Boolean(id) });
  const stats = useQuery({ queryKey: ['prof-stats', id], queryFn: () => professorApi.statistics(id), enabled: Boolean(id) });
  const reviews = useQuery({ queryKey: ['prof-reviews', id], queryFn: () => professorApi.reviews(id), enabled: Boolean(id) });
  const students = useQuery({
    queryKey: ['search-students', id, search],
    queryFn: () => professorApi.students(search, id),
    enabled: search.length >= 2 && Boolean(id),
  });
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const assign = useMutation({
    mutationFn: (studentId: string) => professorApi.assignMonitor(id, studentId),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Monitor vinculado neste periodo' });
      void queryClient.invalidateQueries({ queryKey: ['monitors', id] });
      void queryClient.invalidateQueries({ queryKey: ['prof-stats', id] });
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });
  const unassign = useMutation({
    mutationFn: (monitorId: string) => professorApi.unassignMonitor(id, monitorId),
    onSuccess: () => {
      setFeedback({ type: 'success', text: 'Monitor retirado da disciplina neste periodo' });
      void queryClient.invalidateQueries({ queryKey: ['monitors', id] });
      void queryClient.invalidateQueries({ queryKey: ['prof-stats', id] });
    },
    onError: (error) => setFeedback({ type: 'error', text: extractErrorMessage(error) }),
  });

  return (
    <section className="page">
      <Link to="/">Voltar</Link>
      {feedback && (
        <p className={`alert alert-${feedback.type === 'success' ? 'success' : 'error'}`} role="alert">
          {feedback.text}
        </p>
      )}
      <div className="stats-grid">
        <Stat label="Monitores" value={stats.data?.monitors ?? '-'} />
        <Stat label="Sessoes no mes" value={stats.data?.sessionsThisMonth ?? '-'} />
        <Stat label="Alunos atendidos" value={stats.data?.studentsAttended ?? '-'} />
        <Stat label="Avaliacao" value={stats.data?.averageRating?.toFixed(1) ?? '-'} />
        <Stat label="Clareza" value={stats.data?.averageClarity?.toFixed(1) ?? '-'} />
        <Stat label="Pontualidade" value={stats.data?.averagePunctuality?.toFixed(1) ?? '-'} />
        <Stat label="Dominio" value={stats.data?.averageMastery?.toFixed(1) ?? '-'} />
      </div>
      <div className="card">
        <h2>Adicionar monitor</h2>
        <input placeholder="Buscar aluno por nome ou matricula" value={search} onChange={(e) => setSearch(e.target.value)} />
        {students.data?.map((student) => (
          <div className="list-row" key={student.id}>
            <div>
              <strong>{student.user.name}</strong>
              <p className="muted">
                {student.registration} · {student.course?.name}
              </p>
            </div>
            <button className="button button-primary" type="button" onClick={() => assign.mutate(student.id)}>
              Adicionar
            </button>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Monitores</h2>
        <p className="muted">No fim do periodo, retire o monitor para a disciplina ficar livre para o proximo semestre. Voce gerencia so os monitores da sua turma.</p>
        {monitors.data?.map((item) => (
          <div className="list-row" key={item.id}>
            <div>
              <strong>{item.monitor.user.name}</strong>
              <p className="muted">{item.monitor.student.registration}</p>
            </div>
            <span className={`badge ${item.isActive ? 'badge-ok' : 'badge-off'}`}>
              {item.isActive ? 'Ativo' : 'Inativo'}
            </span>
            {item.isActive && (
              <button
                type="button"
                className="button button-ghost"
                disabled={unassign.isPending}
                onClick={() => {
                  if (!window.confirm(`Retirar ${item.monitor.user.name} desta disciplina neste periodo?`)) {
                    return;
                  }
                  setFeedback(null);
                  unassign.mutate(item.monitorId);
                }}
              >
                Retirar
              </button>
            )}
          </div>
        ))}
        {monitors.data?.length === 0 && <p className="muted">Nenhum monitor nesta disciplina neste periodo.</p>}
      </div>
      <div className="card">
        <h2>Sessoes</h2>
        {sessions.data?.map((session) => (
          <div className="list-row" key={session.id}>
            <div>
              <strong>{session.title}</strong>
              <p className="muted">
                {formatWhen(session.startAt)} · {session.subjectMonitor?.monitor.name}
              </p>
            </div>
            <span className="badge">{STATUS_LABELS[session.status]}</span>
          </div>
        ))}
      </div>
      <div className="card">
        <h2>Avaliacoes</h2>
        <p className="muted">O autor aparece para o professor mesmo quando o aluno pediu anonimato.</p>
        {reviews.data?.map((review) => (
          <ReviewCard key={review.id} review={review} showAuthor />
        ))}
        {reviews.data?.length === 0 && <p className="muted">Nenhuma avaliacao nesta disciplina ainda.</p>}
      </div>
    </section>
  );
};

const CrudPage = ({
  title,
  onSubmit,
  children,
}: {
  title: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}) => (
  <section className="page">
    <h1>{title}</h1>
    <form className="card form-grid" onSubmit={onSubmit}>
      {children}
    </form>
  </section>
);


