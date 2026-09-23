import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  catalogApi,
  formatWhen,
  MODALITY_LABELS,
  monitorApi,
  STATUS_LABELS,
  TYPE_LABELS,
  type SessionModality,
  type SessionType,
} from '@/features/domain/api';
import { extractErrorMessage } from '@/shared/api/http-client';

export const NewSessionPage = () => {
  const navigate = useNavigate();
  const subjects = useQuery({ queryKey: ['monitor-subjects'], queryFn: monitorApi.subjects });
  const rooms = useQuery({ queryKey: ['room-options'], queryFn: catalogApi.roomOptions });
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    subjectMonitorId: '',
    title: '',
    topic: '',
    type: 'OFFICE_HOURS' as SessionType,
    modality: 'PRESENTIAL' as SessionModality,
    startAt: '',
    endAt: '',
    maxParticipants: 10,
    roomId: '',
    meetingUrl: '',
  });

  const create = useMutation({
    mutationFn: () =>
      monitorApi.createSession({
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        roomId: form.roomId || undefined,
        meetingUrl: form.meetingUrl || undefined,
        topic: form.topic || undefined,
      }),
    onSuccess: (session) => navigate(`/sessoes/${session.id}`),
    onError: (err) => setError(extractErrorMessage(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <section className="page">
      <h1>Nova sessao de monitoria</h1>
      <form className="card form-grid" onSubmit={submit}>
        <label className="field">
          <span>Disciplina</span>
          <select required value={form.subjectMonitorId} onChange={(e) => setForm({ ...form, subjectMonitorId: e.target.value })}>
            <option value="">Selecione</option>
            {subjects.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.subject.name} · {item.professor.user.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Titulo</span>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        <label className="field">
          <span>Assunto</span>
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SessionType })}>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Modalidade</span>
          <select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value as SessionModality })}>
            {Object.entries(MODALITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Inicio</span>
          <input type="datetime-local" required value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
        </label>
        <label className="field">
          <span>Fim</span>
          <input type="datetime-local" required value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
        </label>
        <label className="field">
          <span>Vagas</span>
          <input type="number" min={1} required value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: Number(e.target.value) })} />
        </label>
        {form.modality !== 'ONLINE' && (
          <label className="field">
            <span>Sala</span>
            <select required value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
              <option value="">Selecione</option>
              {rooms.data?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.capacity} lugares)
                </option>
              ))}
            </select>
          </label>
        )}
        {form.modality !== 'PRESENTIAL' && (
          <label className="field">
            <span>Link da reuniao</span>
            <input type="url" required value={form.meetingUrl} onChange={(e) => setForm({ ...form, meetingUrl: e.target.value })} />
          </label>
        )}
        {error && <p className="alert alert-error">{error}</p>}
        <button className="button button-primary" type="submit" disabled={create.isPending}>
          Publicar sessao
        </button>
      </form>
    </section>
  );
};

export const SessionDetailPage = () => {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ['monitor-sessions'], queryFn: monitorApi.sessions });
  const session = sessions.data?.find((item) => item.id === id);
  const participants = useQuery({
    queryKey: ['participants', id],
    queryFn: () => monitorApi.participants(id),
    enabled: Boolean(id),
  });
  const [token, setToken] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () => monitorApi.start(id),
    onSuccess: (data) => {
      setToken(data.token);
      queryClient.invalidateQueries({ queryKey: ['monitor-sessions'] });
    },
  });
  const complete = useMutation({
    mutationFn: () => monitorApi.complete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitor-sessions'] }),
  });
  const cancel = useMutation({
    mutationFn: () => monitorApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitor-sessions'] }),
  });
  const decide = useMutation({
    mutationFn: ({ participantId, accept }: { participantId: string; accept: boolean }) =>
      accept ? monitorApi.accept(participantId) : monitorApi.reject(participantId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['participants', id] }),
  });

  const qrUrl = useMemo(() => {
    if (!token || !id) return null;
    const payload = encodeURIComponent(`${window.location.origin}/presenca#sessionId=${id}&token=${token}`);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${payload}`;
  }, [token, id]);

  if (!session) return <p className="muted">Carregando sessao...</p>;

  return (
    <section className="page">
      <Link to="/">Voltar</Link>
      <div className="card">
        <h1>{session.title}</h1>
        <p className="muted">
          {formatWhen(session.startAt)} — {formatWhen(session.endAt)}
        </p>
        <p>
          {TYPE_LABELS[session.type]} · {MODALITY_LABELS[session.modality]} · {STATUS_LABELS[session.status]}
        </p>
        <p>{session.room ? `${session.room.name} · ${session.room.building}` : session.meetingUrl}</p>
        <div className="toolbar" style={{ maxWidth: 'none', display: 'flex', gap: 8 }}>
          {(session.status === 'PUBLISHED' || session.status === 'FULL') && (
            <button className="button button-primary" type="button" onClick={() => start.mutate()}>
              Iniciar atendimento
            </button>
          )}
          {session.status === 'IN_PROGRESS' && (
            <button className="button button-primary" type="button" onClick={() => complete.mutate()}>
              Encerrar
            </button>
          )}
          {session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
            <button className="button button-ghost" type="button" onClick={() => cancel.mutate()}>
              Cancelar
            </button>
          )}
        </div>
      </div>
      {qrUrl && (
        <div className="card" style={{ textAlign: 'center' }}>
          <h2>QR Code de presenca</h2>
          <img alt="QR Code para confirmar presenca" src={qrUrl} width={220} height={220} />
          <p className="muted">O codigo expira em cerca de 5 minutos e e renovado ao iniciar novamente.</p>
        </div>
      )}
      <div className="card">
        <h2>Participantes</h2>
        {participants.data?.map((item) => (
          <div className="list-row" key={item.id}>
            <div>
              <strong>{item.student.user.name}</strong>
              <p className="muted">
                {item.student.registration} · {item.status}
              </p>
            </div>
            {item.status === 'PENDING' && (
              <div>
                <button className="button button-primary" type="button" onClick={() => decide.mutate({ participantId: item.id, accept: true })}>
                  Aceitar
                </button>
                <button className="button button-ghost" type="button" onClick={() => decide.mutate({ participantId: item.id, accept: false })}>
                  Recusar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export const AvailabilityPage = () => {
  const queryClient = useQueryClient();
  const subjects = useQuery({ queryKey: ['monitor-subjects'], queryFn: monitorApi.subjects });
  const list = useQuery({ queryKey: ['availability'], queryFn: monitorApi.availabilities });
  const rooms = useQuery({ queryKey: ['room-options'], queryFn: catalogApi.roomOptions });
  const [form, setForm] = useState({
    subjectMonitorId: '',
    weekday: 2,
    startTime: '18:00',
    endTime: '20:00',
    title: 'Plantao de duvidas',
    maxParticipants: 8,
    modality: 'PRESENTIAL' as SessionModality,
    type: 'OFFICE_HOURS' as SessionType,
    roomId: '',
  });
  const create = useMutation({
    mutationFn: () =>
      monitorApi.createAvailability({
        ...form,
        roomId: form.roomId || undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability'] }),
  });
  const generate = useMutation({
    mutationFn: (id: string) => monitorApi.generate(id, 8),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['monitor-sessions'] }),
  });

  return (
    <section className="page">
      <h1>Disponibilidade recorrente</h1>
      <form
        className="card form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <select required value={form.subjectMonitorId} onChange={(e) => setForm({ ...form, subjectMonitorId: e.target.value })}>
          <option value="">Disciplina</option>
          {subjects.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.subject.name}
            </option>
          ))}
        </select>
        <select value={form.weekday} onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}>
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'].map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
        <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <select value={form.roomId} onChange={(e) => setForm({ ...form, roomId: e.target.value })}>
          <option value="">Sala</option>
          {rooms.data?.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        <button className="button button-primary" type="submit">
          Salvar horario
        </button>
      </form>
      <div className="card">
        {list.data?.map((item) => (
          <div className="list-row" key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <p className="muted">
                Dia {item.weekday} · {item.startTime}-{item.endTime}
              </p>
            </div>
            <button className="button button-ghost" type="button" onClick={() => generate.mutate(item.id)}>
              Gerar 8 semanas
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
