import type { ParticipantStatus, Prisma, SessionStatus } from '@prisma/client';

import { prisma } from '../../infra/database/prisma.js';
import { parsePeriod } from '../../shared/academic-period.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error.js';
import { intervalsOverlap } from '../../shared/utils/overlap.js';
import { academicAccess } from '../academic/academic-access.js';
import { notifyUser } from '../notifications/notifications.controller.js';
import { issueAttendanceToken, verifyAttendanceToken } from './attendance-token.js';
import {
  canSeeMeetingUrl,
  presentOwnParticipation,
  presentParticipantForMonitor,
  presentProfessorSession,
  presentPublicSession,
} from './session.presenter.js';
import type {
  AvailabilityInput,
  CreateSessionInput,
  SearchSessionsQuery,
  UpdateSessionInput,
} from './session.schemas.js';

const ACTIVE_SESSION_STATUSES: SessionStatus[] = ['PUBLISHED', 'FULL', 'IN_PROGRESS'];
const OCCUPYING_PARTICIPANT: ParticipantStatus[] = ['PENDING', 'CONFIRMED', 'ATTENDED'];
const AUTO_CONFIRM_TYPES = new Set(['OFFICE_HOURS', 'GROUP', 'STUDY_GROUP']);

const countOccupancy = (sessionId: string) =>
  prisma.sessionParticipant.count({
    where: { sessionId, status: { in: OCCUPYING_PARTICIPANT } },
  });

const syncCapacityStatus = async (sessionId: string) => {
  const session = await prisma.monitoringSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status === 'CANCELLED' || session.status === 'COMPLETED' || session.status === 'IN_PROGRESS') {
    return;
  }

  const occupied = await countOccupancy(sessionId);
  const next: SessionStatus = occupied >= session.maxParticipants ? 'FULL' : 'PUBLISHED';
  if (session.status !== next && (session.status === 'PUBLISHED' || session.status === 'FULL')) {
    await prisma.monitoringSession.update({ where: { id: sessionId }, data: { status: next } });
  }
};

const assertNoConflicts = async (input: {
  startAt: Date;
  endAt: Date;
  monitorId: string;
  roomId?: string | null;
  ignoreSessionId?: string;
}) => {
  const sessions = await prisma.monitoringSession.findMany({
    where: {
      status: { in: ACTIVE_SESSION_STATUSES },
      ...(input.ignoreSessionId ? { id: { not: input.ignoreSessionId } } : {}),
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
      OR: [
        { subjectMonitor: { monitorId: input.monitorId } },
        ...(input.roomId ? [{ roomId: input.roomId }] : []),
      ],
    },
    include: { subjectMonitor: true, room: true },
  });

  for (const session of sessions) {
    if (!intervalsOverlap(input.startAt, input.endAt, session.startAt, session.endAt)) continue;

    if (session.subjectMonitor.monitorId === input.monitorId) {
      throw new ConflictError('Horario indisponivel: o monitor ja possui outra sessao neste intervalo');
    }
    if (input.roomId && session.roomId === input.roomId) {
      throw new ConflictError(`Horario indisponivel: a sala ${session.room?.name ?? ''} ja esta reservada`);
    }
  }
};

const assertStudentFree = async (studentId: string, startAt: Date, endAt: Date, ignoreSessionId?: string) => {
  const overlapping = await prisma.sessionParticipant.findFirst({
    where: {
      studentId,
      status: { in: OCCUPYING_PARTICIPANT },
      ...(ignoreSessionId ? { sessionId: { not: ignoreSessionId } } : {}),
      session: {
        status: { in: ACTIVE_SESSION_STATUSES },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
    },
    include: { session: true },
  });

  if (overlapping) {
    throw new ConflictError('Voce ja possui outra monitoria neste horario');
  }
};

export const sessionsService = {
  async create(monitorUserId: string, input: CreateSessionInput) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const assignment = await academicAccess.requireMonitorAssignment(monitor.id, input.subjectMonitorId);
    if (!assignment.subject.isActive) {
      throw new BadRequestError('Esta disciplina esta desativada');
    }

    if (input.roomId) {
      const room = await prisma.room.findUnique({ where: { id: input.roomId } });
      if (!room?.isActive) throw new NotFoundError('Sala nao encontrada');
      if (input.maxParticipants > room.capacity) {
        throw new BadRequestError('A quantidade de vagas ultrapassa a capacidade da sala');
      }
    }

    await assertNoConflicts({
      startAt: input.startAt,
      endAt: input.endAt,
      monitorId: assignment.monitorId,
      roomId: input.roomId,
    });

    const created = await prisma.monitoringSession.create({
      data: input,
      include: {
        room: true,
        subjectMonitor: {
          include: {
            subject: true,
            monitor: { include: { user: { select: { name: true } } } },
          },
        },
      },
    });

    return presentPublicSession(created, { meetingUrl: created.meetingUrl });
  },

  async update(monitorUserId: string, sessionId: string, input: UpdateSessionInput) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const session = await academicAccess.getSessionOrThrow(sessionId);
    await academicAccess.requireMonitorAssignment(monitor.id, session.subjectMonitorId);

    if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
      throw new BadRequestError('Nao e possivel editar uma sessao encerrada ou cancelada');
    }

    const startAt = input.startAt ?? session.startAt;
    const endAt = input.endAt ?? session.endAt;
    if (endAt <= startAt) throw new BadRequestError('O termino precisa ser posterior ao inicio');

    await assertNoConflicts({
      startAt,
      endAt,
      monitorId: session.subjectMonitor.monitorId,
      roomId: input.roomId === undefined ? session.roomId : input.roomId,
      ignoreSessionId: session.id,
    });

    const updated = await prisma.monitoringSession.update({
      where: { id: sessionId },
      data: input,
    });

    const participants = await prisma.sessionParticipant.findMany({
      where: { sessionId, status: { in: ['PENDING', 'CONFIRMED'] } },
      include: { student: true },
    });

    await Promise.all(
      participants.map((item) =>
        notifyUser({
          userId: item.student.userId,
          type: 'SESSION_UPDATED',
          title: 'Sessao de monitoria atualizada',
          message: `${session.title} teve horario ou local alterado.`,
          link: `/monitorias/${sessionId}`,
        }),
      ),
    );

    return updated;
  },

  async cancel(monitorUserId: string, sessionId: string) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const session = await academicAccess.getSessionOrThrow(sessionId);
    await academicAccess.requireMonitorAssignment(monitor.id, session.subjectMonitorId);

    if (session.status === 'COMPLETED') {
      throw new BadRequestError('Sessao ja encerrada');
    }

    await prisma.monitoringSession.update({
      where: { id: sessionId },
      data: { status: 'CANCELLED' },
    });

    const participants = await prisma.sessionParticipant.findMany({
      where: { sessionId, status: { in: ['PENDING', 'CONFIRMED'] } },
      include: { student: true },
    });

    await prisma.sessionParticipant.updateMany({
      where: { sessionId, status: { in: ['PENDING', 'CONFIRMED'] } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await Promise.all(
      participants.map((item) =>
        notifyUser({
          userId: item.student.userId,
          type: 'SESSION_CANCELLED',
          title: 'Sessao cancelada',
          message: `${session.title} foi cancelada pelo monitor.`,
        }),
      ),
    );
  },

  async listMine(monitorUserId: string) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    return prisma.monitoringSession.findMany({
      where: { subjectMonitor: { monitorId: monitor.id } },
      include: {
        room: true,
        subjectMonitor: { include: { subject: true } },
        _count: { select: { participants: { where: { status: { in: OCCUPYING_PARTICIPANT } } } } },
      },
      orderBy: { startAt: 'asc' },
    });
  },

  async listBySubjectForProfessor(professorUserId: string, subjectId: string, year?: number, semester?: number) {
    const period = parsePeriod(year, semester);
    const professor = await academicAccess.requireProfessor(professorUserId);
    await academicAccess.requireProfessorOwnsSubject(professor.id, subjectId, period);

    const sessions = await prisma.monitoringSession.findMany({
      where: {
        subjectMonitor: {
          subjectId,
          professorId: professor.id,
          year: period.year,
          semester: period.semester,
        },
      },
      include: {
        room: true,
        subjectMonitor: {
          include: { monitor: { include: { user: { select: { name: true } } } } },
        },
        _count: { select: { participants: { where: { status: { in: OCCUPYING_PARTICIPANT } } } } },
      },
      orderBy: { startAt: 'desc' },
    });

    return sessions.map((session) => presentProfessorSession(session));
  },

  async start(monitorUserId: string, sessionId: string) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const session = await academicAccess.getSessionOrThrow(sessionId);
    await academicAccess.requireMonitorAssignment(monitor.id, session.subjectMonitorId);

    if (session.status !== 'PUBLISHED' && session.status !== 'FULL') {
      throw new BadRequestError('So e possivel iniciar sessoes publicadas');
    }

    await prisma.monitoringSession.update({
      where: { id: sessionId },
      data: { status: 'IN_PROGRESS' },
    });

    const token = issueAttendanceToken(sessionId);
    return { token, expiresInSeconds: 300 };
  },

  async complete(monitorUserId: string, sessionId: string) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const session = await academicAccess.getSessionOrThrow(sessionId);
    await academicAccess.requireMonitorAssignment(monitor.id, session.subjectMonitorId);

    await prisma.$transaction([
      prisma.monitoringSession.update({ where: { id: sessionId }, data: { status: 'COMPLETED' } }),
      prisma.sessionParticipant.updateMany({
        where: { sessionId, status: 'CONFIRMED' },
        data: { status: 'ABSENT' },
      }),
    ]);
  },

  async listParticipants(monitorUserId: string, sessionId: string) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const session = await academicAccess.getSessionOrThrow(sessionId);
    await academicAccess.requireMonitorAssignment(monitor.id, session.subjectMonitorId);

    const rows = await prisma.sessionParticipant.findMany({
      where: { sessionId },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            course: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { requestedAt: 'asc' },
    });

    return rows.map((row) => presentParticipantForMonitor(row));
  },

  async decideParticipant(monitorUserId: string, participantId: string, accept: boolean) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const participant = await prisma.sessionParticipant.findUnique({
      where: { id: participantId },
      include: { session: { include: { subjectMonitor: true } }, student: true },
    });
    if (!participant) throw new NotFoundError('Solicitacao nao encontrada');
    await academicAccess.requireMonitorAssignment(monitor.id, participant.session.subjectMonitorId);

    if (participant.status !== 'PENDING') {
      throw new BadRequestError('Esta solicitacao ja foi decidida');
    }

    if (accept) {
      const occupied = await countOccupancy(participant.sessionId);
      if (occupied >= participant.session.maxParticipants) {
        throw new ConflictError('Nao ha mais vagas nesta sessao');
      }
    }

    const updated = await prisma.sessionParticipant.update({
      where: { id: participantId },
      data: {
        status: accept ? 'CONFIRMED' : 'REJECTED',
        confirmedAt: accept ? new Date() : null,
      },
    });

    await syncCapacityStatus(participant.sessionId);
    await notifyUser({
      userId: participant.student.userId,
      type: accept ? 'REQUEST_ACCEPTED' : 'REQUEST_REJECTED',
      title: accept ? 'Sua solicitacao foi aceita' : 'Sua solicitacao foi recusada',
      message: accept
        ? `Voce esta confirmado em ${participant.session.title}.`
        : `Sua participacao em ${participant.session.title} foi recusada.`,
      link: '/agenda',
    });

    return presentOwnParticipation(updated);
  },

  async search(query: SearchSessionsQuery) {
    const period = parsePeriod(query.year, query.semester);
    const dateFilter = query.date
      ? {
          startAt: {
            gte: new Date(`${query.date}T00:00:00`),
            lt: new Date(`${query.date}T23:59:59.999`),
          },
        }
      : { startAt: { gte: new Date() } };

    const where: Prisma.MonitoringSessionWhereInput = {
      status: { in: ['PUBLISHED', 'FULL'] },
      ...dateFilter,
      subjectMonitor: {
        isActive: true,
        year: period.year,
        semester: period.semester,
        subject: { isActive: true },
        ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      },
      ...(query.modality ? { modality: query.modality } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.topic ? { topic: { contains: query.topic } } : {}),
    };

    const sessions = await prisma.monitoringSession.findMany({
      where,
      include: {
        room: true,
        subjectMonitor: {
          include: {
            subject: true,
            monitor: {
              include: {
                user: { select: { name: true } },
                reviews: { select: { rating: true } },
              },
            },
          },
        },
        _count: { select: { participants: { where: { status: { in: OCCUPYING_PARTICIPANT } } } } },
      },
      orderBy: { startAt: 'asc' },
      take: 50,
    });

    const preferredStart = query.preferredStart ? new Date(query.preferredStart) : null;
    const preferredEnd = query.preferredEnd ? new Date(query.preferredEnd) : null;

    return sessions.map((session) => {
      const ratings = session.subjectMonitor.monitor.reviews.map((item) => item.rating);
      const averageRating = ratings.length
        ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length
        : null;

      let score = 0;
      if (query.subjectId && session.subjectMonitor.subjectId === query.subjectId) score += 40;
      if (query.topic && session.topic?.toLowerCase().includes(query.topic.toLowerCase())) score += 20;
      if (
        preferredStart &&
        preferredEnd &&
        intervalsOverlap(preferredStart, preferredEnd, session.startAt, session.endAt)
      ) {
        score += 15;
      }
      if (query.modality && session.modality === query.modality) score += 10;
      if ((averageRating ?? 0) >= 4.5) score += 10;
      if (session._count.participants < session.maxParticipants) score += 5;

      return presentPublicSession(session, {
        meetingUrl: null,
        occupied: session._count.participants,
        averageRating,
        compatibility: Math.min(100, score),
      });
    });
  },

  async getPublic(sessionId: string, studentUserId?: string) {
    const session = await academicAccess.getSessionOrThrow(sessionId);
    if (session.status === 'DRAFT') {
      throw new NotFoundError('Sessao nao encontrada');
    }

    const occupied = await countOccupancy(sessionId);
    const reviews = await prisma.review.findMany({
      where: { monitorId: session.subjectMonitor.monitorId },
      select: { rating: true },
    });
    const averageRating = reviews.length
      ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
      : null;

    let participationStatus: ParticipantStatus | undefined;
    if (studentUserId) {
      const student = await prisma.student.findUnique({ where: { userId: studentUserId } });
      if (student) {
        const participation = await prisma.sessionParticipant.findUnique({
          where: { sessionId_studentId: { sessionId, studentId: student.id } },
        });
        participationStatus = participation?.status;
      }
    }

    return presentPublicSession(session, {
      meetingUrl: canSeeMeetingUrl(participationStatus) ? session.meetingUrl : null,
      occupied,
      averageRating,
    });
  },

  async join(studentUserId: string, sessionId: string) {
    const student = await academicAccess.requireStudent(studentUserId);
    const studentUser = await prisma.user.findUnique({ where: { id: studentUserId } });
    const session = await academicAccess.getSessionOrThrow(sessionId);

    if (session.status !== 'PUBLISHED') {
      throw new BadRequestError('Esta sessao nao esta aberta para novas inscricoes');
    }
    if (!session.subjectMonitor.subject.isActive) {
      throw new BadRequestError('Esta disciplina esta desativada');
    }

    const existing = await prisma.sessionParticipant.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: student.id } },
    });
    if (existing && existing.status !== 'CANCELLED' && existing.status !== 'REJECTED') {
      throw new ConflictError('Voce ja solicitou esta sessao');
    }

    await assertStudentFree(student.id, session.startAt, session.endAt);
    const occupied = await countOccupancy(sessionId);
    if (occupied >= session.maxParticipants) {
      throw new ConflictError('Nao ha mais vagas nesta sessao');
    }

    const autoConfirm = AUTO_CONFIRM_TYPES.has(session.type);
    const participant = existing
      ? await prisma.sessionParticipant.update({
          where: { id: existing.id },
          data: {
            status: autoConfirm ? 'CONFIRMED' : 'PENDING',
            requestedAt: new Date(),
            confirmedAt: autoConfirm ? new Date() : null,
            cancelledAt: null,
          },
        })
      : await prisma.sessionParticipant.create({
          data: {
            sessionId,
            studentId: student.id,
            status: autoConfirm ? 'CONFIRMED' : 'PENDING',
            confirmedAt: autoConfirm ? new Date() : null,
          },
        });

    await syncCapacityStatus(sessionId);

    await notifyUser({
      userId: session.subjectMonitor.monitor.user.id,
      type: 'GENERIC',
      title: autoConfirm ? 'Novo aluno confirmado' : 'Nova solicitacao de monitoria',
      message: `${studentUser?.name ?? 'Um aluno'} solicitou ${session.title}.`,
      link: `/sessoes/${sessionId}`,
    });

    if (autoConfirm) {
      await notifyUser({
        userId: studentUserId,
        type: 'REQUEST_ACCEPTED',
        title: 'Sua solicitacao foi aceita',
        message: `Voce esta confirmado em ${session.title}.`,
        link: '/agenda',
      });
    }

    return presentOwnParticipation({
      ...participant,
      attendedAt: participant.attendedAt ?? null,
      cancelledAt: participant.cancelledAt ?? null,
    });
  },

  async leave(studentUserId: string, sessionId: string) {
    const student = await academicAccess.requireStudent(studentUserId);
    const participant = await prisma.sessionParticipant.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: student.id } },
      include: { session: true },
    });
    if (!participant) throw new NotFoundError('Participacao nao encontrada');
    if (participant.session.status === 'COMPLETED' || participant.session.status === 'IN_PROGRESS') {
      throw new BadRequestError('Nao e possivel cancelar durante ou apos o atendimento');
    }

    await prisma.sessionParticipant.update({
      where: { id: participant.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await syncCapacityStatus(sessionId);
  },

  async appointments(studentUserId: string) {
    const student = await academicAccess.requireStudent(studentUserId);
    const rows = await prisma.sessionParticipant.findMany({
      where: { studentId: student.id },
      include: {
        session: {
          include: {
            room: true,
            reviews: {
              where: { studentId: student.id },
              select: {
                id: true,
                rating: true,
                clarity: true,
                punctuality: true,
                mastery: true,
                comment: true,
                isAnonymous: true,
                publishComment: true,
                createdAt: true,
              },
            },
            subjectMonitor: {
              include: {
                subject: true,
                monitor: { include: { user: { select: { name: true } } } },
              },
            },
          },
        },
      },
      orderBy: { session: { startAt: 'asc' } },
    });

    return rows.map((row) => {
      const { reviews, ...session } = row.session;
      return {
        ...presentOwnParticipation(row),
        session: presentPublicSession(session, {
          meetingUrl: canSeeMeetingUrl(row.status) ? session.meetingUrl : null,
        }),
        review: reviews[0] ?? null,
      };
    });
  },

  async attendWithToken(studentUserId: string, sessionId: string, token: string) {
    const student = await academicAccess.requireStudent(studentUserId);
    const session = await academicAccess.getSessionOrThrow(sessionId);
    if (session.status !== 'IN_PROGRESS') {
      throw new BadRequestError('A sessao ainda nao foi iniciada');
    }

    verifyAttendanceToken(sessionId, token);

    const participant = await prisma.sessionParticipant.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: student.id } },
    });
    if (!participant || (participant.status !== 'CONFIRMED' && participant.status !== 'ATTENDED')) {
      throw new ForbiddenError('Voce precisa estar confirmado nesta sessao');
    }

    const updated = await prisma.sessionParticipant.update({
      where: { id: participant.id },
      data: { status: 'ATTENDED', attendedAt: new Date() },
    });
    return presentOwnParticipation(updated);
  },
};

export const availabilityService = {
  async list(monitorUserId: string) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    return prisma.monitorAvailability.findMany({
      where: { subjectMonitor: { monitorId: monitor.id } },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  },

  async create(monitorUserId: string, input: AvailabilityInput) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    await academicAccess.requireMonitorAssignment(monitor.id, input.subjectMonitorId);
    if (input.endTime <= input.startTime) {
      throw new BadRequestError('O horario final precisa ser posterior ao inicial');
    }
    return prisma.monitorAvailability.create({ data: input });
  },

  async update(monitorUserId: string, id: string, input: Partial<AvailabilityInput>) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const item = await prisma.monitorAvailability.findUnique({ where: { id } });
    if (!item) throw new NotFoundError('Disponibilidade nao encontrada');
    await academicAccess.requireMonitorAssignment(monitor.id, item.subjectMonitorId);
    return prisma.monitorAvailability.update({ where: { id }, data: input });
  },

  async generate(monitorUserId: string, availabilityId: string, weeks: number) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const availability = await prisma.monitorAvailability.findUnique({ where: { id: availabilityId } });
    if (!availability?.isActive) throw new NotFoundError('Disponibilidade nao encontrada');
    await academicAccess.requireMonitorAssignment(monitor.id, availability.subjectMonitorId);

    const created = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let week = 0; week < weeks; week += 1) {
      const date = nextWeekday(today, availability.weekday, week);
      const [startH, startM] = availability.startTime.split(':').map(Number);
      const [endH, endM] = availability.endTime.split(':').map(Number);
      const startAt = new Date(date);
      startAt.setHours(startH ?? 0, startM ?? 0, 0, 0);
      const endAt = new Date(date);
      endAt.setHours(endH ?? 0, endM ?? 0, 0, 0);

      if (startAt <= new Date()) continue;

      try {
        const session = await sessionsService.create(monitorUserId, {
          subjectMonitorId: availability.subjectMonitorId,
          type: availability.type,
          modality: availability.modality,
          title: availability.title,
          topic: availability.topic ?? undefined,
          startAt,
          endAt,
          maxParticipants: availability.maxParticipants,
          roomId: availability.roomId ?? undefined,
          meetingUrl: availability.meetingUrl ?? undefined,
          status: 'PUBLISHED',
        });
        created.push(session);
      } catch {
        // Conflito em uma das semanas nao interrompe as demais.
      }
    }

    return created;
  },
};

const nextWeekday = (from: Date, isoWeekday: number, weekOffset: number) => {
  const jsDay = isoWeekday === 7 ? 0 : isoWeekday;
  const result = new Date(from);
  const delta = (jsDay - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + delta + weekOffset * 7);
  return result;
};
