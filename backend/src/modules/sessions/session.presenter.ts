import type { ParticipantStatus, SessionModality, SessionStatus, SessionType } from '@prisma/client';

type NamedUser = { name: string };
type RoomSnapshot = {
  id: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
} | null;

type SubjectSnapshot = { id: string; name: string; code: string };

type SessionRecord = {
  id: string;
  title: string;
  topic: string | null;
  description: string | null;
  type: SessionType;
  modality: SessionModality;
  startAt: Date;
  endAt: Date;
  maxParticipants: number;
  status: SessionStatus;
  meetingUrl: string | null;
  room: RoomSnapshot;
  subjectMonitor: {
    id: string;
    subject: SubjectSnapshot;
    monitor: { id: string; user: NamedUser };
  };
};

export type PublicSessionDto = {
  id: string;
  title: string;
  topic: string | null;
  description: string | null;
  type: SessionType;
  modality: SessionModality;
  startAt: Date;
  endAt: Date;
  maxParticipants: number;
  status: SessionStatus;
  meetingUrl: string | null;
  room: RoomSnapshot;
  occupied?: number;
  averageRating: number | null;
  compatibility?: number;
  subjectMonitor: {
    id: string;
    subject: SubjectSnapshot;
    monitor: { id: string; name: string };
  };
};

const presentRoom = (room: RoomSnapshot): RoomSnapshot =>
  room
    ? {
        id: room.id,
        name: room.name,
        building: room.building,
        floor: room.floor,
        capacity: room.capacity,
      }
    : null;

/** Catalogo, detalhe e agenda do aluno: sem userId, e-mail ou studentId de terceiros. */
export const presentPublicSession = (
  session: SessionRecord,
  options: {
    meetingUrl: string | null;
    occupied?: number;
    averageRating?: number | null;
    compatibility?: number;
  },
): PublicSessionDto => ({
  id: session.id,
  title: session.title,
  topic: session.topic,
  description: session.description,
  type: session.type,
  modality: session.modality,
  startAt: session.startAt,
  endAt: session.endAt,
  maxParticipants: session.maxParticipants,
  status: session.status,
  meetingUrl: options.meetingUrl,
  room: presentRoom(session.room),
  ...(options.occupied === undefined ? {} : { occupied: options.occupied }),
  averageRating: options.averageRating ?? null,
  ...(options.compatibility === undefined ? {} : { compatibility: options.compatibility }),
  subjectMonitor: {
    id: session.subjectMonitor.id,
    subject: {
      id: session.subjectMonitor.subject.id,
      name: session.subjectMonitor.subject.name,
      code: session.subjectMonitor.subject.code,
    },
    monitor: {
      id: session.subjectMonitor.monitor.id,
      name: session.subjectMonitor.monitor.user.name,
    },
  },
});

export const canSeeMeetingUrl = (status: ParticipantStatus | undefined): boolean =>
  status === 'CONFIRMED' || status === 'ATTENDED';

export const presentParticipantForMonitor = (row: {
  id: string;
  status: ParticipantStatus;
  requestedAt: Date;
  confirmedAt: Date | null;
  attendedAt: Date | null;
  cancelledAt: Date | null;
  student: {
    registration: string;
    course: { id: string; name: string; code: string };
    user: { name: string; email: string };
  };
}) => ({
  id: row.id,
  status: row.status,
  requestedAt: row.requestedAt,
  confirmedAt: row.confirmedAt,
  attendedAt: row.attendedAt,
  cancelledAt: row.cancelledAt,
  student: {
    registration: row.student.registration,
    course: {
      id: row.student.course.id,
      name: row.student.course.name,
      code: row.student.course.code,
    },
    user: { name: row.student.user.name, email: row.student.user.email },
  },
});

export const presentOwnParticipation = (row: {
  id: string;
  sessionId: string;
  status: ParticipantStatus;
  requestedAt: Date;
  confirmedAt: Date | null;
  attendedAt: Date | null;
  cancelledAt: Date | null;
}) => ({
  id: row.id,
  sessionId: row.sessionId,
  status: row.status,
  requestedAt: row.requestedAt,
  confirmedAt: row.confirmedAt,
  attendedAt: row.attendedAt,
  cancelledAt: row.cancelledAt,
});

/** Sessoes que o professor administra: nome do monitor, sem user.id. */
export const presentProfessorSession = (session: {
  id: string;
  title: string;
  topic: string | null;
  description: string | null;
  type: SessionType;
  modality: SessionModality;
  startAt: Date;
  endAt: Date;
  maxParticipants: number;
  status: SessionStatus;
  meetingUrl: string | null;
  room: RoomSnapshot;
  subjectMonitor: { monitor: { id: string; user: NamedUser } };
  _count?: { participants: number };
}) => ({
  id: session.id,
  title: session.title,
  topic: session.topic,
  description: session.description,
  type: session.type,
  modality: session.modality,
  startAt: session.startAt,
  endAt: session.endAt,
  maxParticipants: session.maxParticipants,
  status: session.status,
  meetingUrl: session.meetingUrl,
  room: presentRoom(session.room),
  occupied: session._count?.participants,
  subjectMonitor: {
    monitor: { id: session.subjectMonitor.monitor.id, name: session.subjectMonitor.monitor.user.name },
  },
});
