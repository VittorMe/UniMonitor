import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  formatWhen,
  MODALITY_LABELS,
  STATUS_LABELS,
  studentApi,
  TYPE_LABELS,
  type SessionModality,
} from '@/features/domain/api';
import { extractErrorMessage } from '@/shared/api/http-client';

export const FindSessionsPage = () => {
  const subjects = useQuery({ queryKey: ['student-subjects'], queryFn: studentApi.subjects });
  const [filters, setFilters] = useState({
    subjectId: '',
    date: '',
    modality: '',
    type: '',
    topic: '',
  });
  const params = useMemo(
    () => ({
      subjectId: filters.subjectId || undefined,
      date: filters.date || undefined,
      modality: filters.modality || undefined,
      type: filters.type || undefined,
      topic: filters.topic || undefined,
    }),
    [filters],
  );
  const results = useQuery({
    queryKey: ['search-sessions', params],
    queryFn: () => studentApi.search(params),
  });
  const join = useMutation({
    mutationFn: studentApi.join,
    onSuccess: () => results.refetch(),
  });

  return (
    <section className="page">
      <h1>Encontrar monitoria</h1>
      <form className="card form-grid" onSubmit={(event) => event.preventDefault()}>
        <select value={filters.subjectId} onChange={(e) => setFilters({ ...filters, subjectId: e.target.value })}>
          <option value="">Todas as disciplinas</option>
          {subjects.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
        <select value={filters.modality} onChange={(e) => setFilters({ ...filters, modality: e.target.value })}>
          <option value="">Todas as modalidades</option>
          {Object.entries(MODALITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
          <option value="">Todos os tipos</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input placeholder="Assunto" value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })} />
      </form>
      {results.data?.map((session) => (
        <article className="card" key={session.id}>
          <h2>{session.subjectMonitor?.subject.name}</h2>
          <p>
            <strong>{session.title}</strong> {session.topic ? `— ${session.topic}` : ''}
          </p>
          <p className="muted">
            Monitor: {session.subjectMonitor?.monitor.name} · {formatWhen(session.startAt)} ·{' '}
            {session.room?.name ?? MODALITY_LABELS[session.modality as SessionModality]}
          </p>
          <p>
            {(session.occupied ?? session._count?.participants ?? 0)}/{session.maxParticipants} vagas
            {session.averageRating ? ` · ⭐ ${session.averageRating.toFixed(1)}` : ''}
            {typeof session.compatibility === 'number' ? ` · Compatibilidade ${session.compatibility}%` : ''}
          </p>
          <p className="muted">O percentual e uma metrica interna com base na disciplina, assunto, horario, modalidade e avaliacao.</p>
          <button
            className="button button-primary"
            type="button"
            disabled={session.status === 'FULL' || join.isPending}
            onClick={() => join.mutate(session.id)}
          >
            Participar
          </button>
          {join.isError && <p className="alert alert-error">{extractErrorMessage(join.error)}</p>}
        </article>
      ))}
    </section>
  );
};

export const AgendaPage = () => {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['appointments'], queryFn: studentApi.appointments });
  const leave = useMutation({
    mutationFn: studentApi.leave,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  return (
    <section className="page">
      <h1>Minha agenda</h1>
      {list.data?.map((item) => (
        <article className="card" key={item.id}>
          <h2>{item.session.title}</h2>
          <p className="muted">
            {item.session.subjectMonitor?.subject.name} · {formatWhen(item.session.startAt)}
          </p>
          <p>
            {STATUS_LABELS[item.session.status]} · inscricao: {item.status}
          </p>
          {item.session.meetingUrl && <p>Link: {item.session.meetingUrl}</p>}
          {['PENDING', 'CONFIRMED'].includes(item.status) && item.session.status !== 'IN_PROGRESS' && (
            <button className="button button-ghost" type="button" onClick={() => leave.mutate(item.session.id)}>
              Cancelar participacao
            </button>
          )}
          {item.status === 'ATTENDED' && item.review && (
            <div className="review-card">
              <h3>Sua avaliacao</h3>
              <p className="review-scores">
                Clareza {item.review.clarity} · Pontualidade {item.review.punctuality} · Dominio {item.review.mastery}
              </p>
              {item.review.comment ? <p>{item.review.comment}</p> : <p className="muted">Sem comentario.</p>}
              <p className="muted">
                {item.review.isAnonymous ? 'Enviada de forma anonima' : 'Voce se identificou'}
                {item.review.publishComment ? ' · comentario publico' : ' · comentario privado'}
              </p>
            </div>
          )}
          {item.status === 'ATTENDED' && !item.review && <SessionReviewForm sessionId={item.session.id} />}
        </article>
      ))}
    </section>
  );
};

const SessionReviewForm = ({ sessionId }: { sessionId: string }) => {
  const queryClient = useQueryClient();
  const [clarity, setClarity] = useState(5);
  const [punctuality, setPunctuality] = useState(5);
  const [mastery, setMastery] = useState(5);
  const [comment, setComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [publishComment, setPublishComment] = useState(true);
  const sendReview = useMutation({
    mutationFn: studentApi.review,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        sendReview.mutate({
          sessionId,
          clarity,
          punctuality,
          mastery,
          comment: comment.trim() || undefined,
          isAnonymous,
          publishComment,
        });
      }}
    >
      <h3>Como foi a monitoria?</h3>
      <label className="field">
        <span>Clareza</span>
        <select value={clarity} onChange={(e) => setClarity(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {'⭐'.repeat(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Pontualidade</span>
        <select value={punctuality} onChange={(e) => setPunctuality(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {'⭐'.repeat(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Dominio do conteudo</span>
        <select value={mastery} onChange={(e) => setMastery(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              {'⭐'.repeat(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="field" style={{ gridColumn: '1 / -1' }}>
        <span>Comentario (opcional)</span>
        <input placeholder="O que ajudou, o que melhorar..." value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <label className="check">
        <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} />
        Avaliar de forma anonima (o monitor nao vera seu nome)
      </label>
      <label className="check">
        <input type="checkbox" checked={publishComment} onChange={(e) => setPublishComment(e.target.checked)} />
        Publicar o comentario (senao so professor e admin leem)
      </label>
      {sendReview.isError && <p className="alert alert-error">{extractErrorMessage(sendReview.error)}</p>}
      <button className="button button-primary" type="submit" disabled={sendReview.isPending}>
        Enviar avaliacao
      </button>
    </form>
  );
};

const readPresenceParams = (search: URLSearchParams) => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return {
    sessionId: hash.get('sessionId') ?? search.get('sessionId') ?? '',
    token: hash.get('token') ?? search.get('token') ?? '',
  };
};

export const AttendancePage = () => {
  const [params] = useSearchParams();
  const initial = readPresenceParams(params);
  const [sessionId, setSessionId] = useState(initial.sessionId);
  const [token, setToken] = useState(initial.token);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!window.location.hash && !params.get('token')) {
      return;
    }
    const next = readPresenceParams(params);
    setSessionId((current) => next.sessionId || current);
    setToken((current) => next.token || current);
    window.history.replaceState(null, '', window.location.pathname);
  }, [params]);

  const attend = useMutation({
    mutationFn: () => studentApi.attend(sessionId, token),
    onSuccess: () => setMessage('Presenca registrada'),
    onError: (error) => setMessage(extractErrorMessage(error)),
  });

  return (
    <section className="page">
      <h1>Confirmar presenca</h1>
      <form
        className="card form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          attend.mutate();
        }}
      >
        <input required placeholder="ID da sessao" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
        <input required placeholder="Token do QR" value={token} onChange={(e) => setToken(e.target.value)} />
        <button className="button button-primary" type="submit">
          Confirmar
        </button>
        {message && <p className={attend.isSuccess ? 'alert alert-success' : 'alert alert-error'}>{message}</p>}
        <Link to="/agenda">Ir para agenda</Link>
      </form>
    </section>
  );
};
