import type { Role } from '@prisma/client';

import { prisma } from '../../infra/database/prisma.js';
import { currentAcademicPeriod } from '../../shared/academic-period.js';
import { ConflictError, ForbiddenError } from '../../shared/errors/app-error.js';
import { academicAccess } from '../academic/academic-access.js';
import { notifyUser } from '../notifications/notifications.controller.js';
import type { CreateReviewInput } from './reviews.schemas.js';

const reviewInclude = {
  student: { include: { user: { select: { id: true, name: true, email: true } } } },
  session: {
    include: {
      subjectMonitor: { include: { subject: true, professor: true } },
    },
  },
} as const;

type ReviewRecord = Awaited<ReturnType<typeof prisma.review.findFirstOrThrow<{ include: typeof reviewInclude }>>>;
type Viewer = { id: string; role: Role };

const isPrivilegedViewer = (viewer: Viewer, review: ReviewRecord) => {
  if (review.student.userId === viewer.id) return true;
  return viewer.role === 'PROFESSOR' && review.session.subjectMonitor.professor.userId === viewer.id;
};

const canSeeAuthor = (viewer: Viewer, review: ReviewRecord) => {
  if (isPrivilegedViewer(viewer, review)) return true;
  return !review.isAnonymous;
};

const canSeeComment = (viewer: Viewer, review: ReviewRecord) => {
  if (!review.comment) return false;
  if (review.publishComment) return true;
  return isPrivilegedViewer(viewer, review);
};

const presentReview = (viewer: Viewer, review: ReviewRecord) => {
  const privileged = isPrivilegedViewer(viewer, review);
  const seesAuthor = canSeeAuthor(viewer, review);
  const seesComment = canSeeComment(viewer, review);

  return {
    id: review.id,
    monitorId: review.monitorId,
    sessionId: review.sessionId,
    sessionTitle: review.session.title,
    subject: review.session.subjectMonitor.subject.name,
    rating: review.rating,
    clarity: review.clarity,
    punctuality: review.punctuality,
    mastery: review.mastery,
    comment: seesComment ? review.comment : null,
    commentHidden: Boolean(review.comment) && !seesComment,
    isAnonymous: review.isAnonymous,
    publishComment: review.publishComment,
    createdAt: review.createdAt,
    author: seesAuthor
      ? privileged
        ? {
            studentId: review.studentId,
            name: review.student.user.name,
            email: review.student.user.email,
            registration: review.student.registration,
          }
        : { name: review.student.user.name }
      : null,
  };
};

export const reviewsService = {
  async create(studentUserId: string, input: CreateReviewInput) {
    const student = await academicAccess.requireStudent(studentUserId);
    const session = await academicAccess.getSessionOrThrow(input.sessionId);

    const participant = await prisma.sessionParticipant.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    });
    if (participant?.status !== 'ATTENDED') {
      throw new ForbiddenError('So e possivel avaliar sessoes em que voce esteve presente');
    }

    const existing = await prisma.review.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    });
    if (existing) throw new ConflictError('Voce ja avaliou esta sessao');

    const rating = Math.round((input.clarity + input.punctuality + input.mastery) / 3);

    const created = await prisma.review.create({
      data: {
        sessionId: session.id,
        studentId: student.id,
        monitorId: session.subjectMonitor.monitorId,
        rating,
        clarity: input.clarity,
        punctuality: input.punctuality,
        mastery: input.mastery,
        comment: input.comment,
        isAnonymous: input.isAnonymous,
        publishComment: input.publishComment,
      },
      include: reviewInclude,
    });

    await notifyUser({
      userId: session.subjectMonitor.monitor.user.id,
      type: 'NEW_REVIEW',
      title: 'Voce recebeu uma nova avaliacao',
      message: input.isAnonymous
        ? `Nova avaliacao anonima (${rating}/5) em ${session.title}.`
        : `Nota ${rating} em ${session.title}.`,
    });

    return presentReview({ id: studentUserId, role: 'STUDENT' }, created);
  },

  async listForMonitor(monitorUserId: string) {
    const monitor = await academicAccess.requireMonitor(monitorUserId);
    const rows = await prisma.review.findMany({
      where: { monitorId: monitor.id },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => presentReview({ id: monitorUserId, role: 'MONITOR' }, row));
  },

  async listForProfessor(professorUserId: string, subjectId: string) {
    const period = currentAcademicPeriod();
    const professor = await academicAccess.requireProfessor(professorUserId);
    await academicAccess.requireProfessorOwnsSubject(professor.id, subjectId, period);

    const rows = await prisma.review.findMany({
      where: {
        session: {
          subjectMonitor: {
            subjectId,
            professorId: professor.id,
            year: period.year,
            semester: period.semester,
          },
        },
      },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => presentReview({ id: professorUserId, role: 'PROFESSOR' }, row));
  },
};
