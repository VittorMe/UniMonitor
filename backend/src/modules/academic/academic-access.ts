import { prisma } from '../../infra/database/prisma.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/app-error.js';
import type { AcademicPeriod } from '../../shared/academic-period.js';
import { subjectCoursesInclude } from '../catalog/subject.presenter.js';

export const academicAccess = {
  async requireProfessor(userId: string) {
    const professor = await prisma.professor.findUnique({ where: { userId } });
    if (!professor) {
      throw new ForbiddenError('Perfil de professor nao encontrado');
    }
    return professor;
  },

  async requireStudent(userId: string) {
    const student = await prisma.student.findUnique({ where: { userId } });
    if (!student) {
      throw new ForbiddenError('Perfil de aluno nao encontrado');
    }
    return student;
  },

  async requireMonitor(userId: string) {
    const monitor = await prisma.monitor.findUnique({ where: { userId } });
    if (!monitor || !monitor.isActive) {
      throw new ForbiddenError('Perfil de monitor nao encontrado');
    }
    return monitor;
  },

  async requireProfessorOwnsSubject(professorId: string, subjectId: string, period: AcademicPeriod) {
    const link = await prisma.professorSubject.findUnique({
      where: {
        professorId_subjectId_year_semester: {
          professorId,
          subjectId,
          year: period.year,
          semester: period.semester,
        },
      },
    });

    if (!link?.isActive) {
      throw new ForbiddenError('Voce nao administra esta disciplina neste periodo');
    }

    return link;
  },

  async requireMonitorAssignment(monitorId: string, subjectMonitorId: string) {
    const assignment = await prisma.subjectMonitor.findFirst({
      where: { id: subjectMonitorId, monitorId, isActive: true },
      include: {
        subject: { include: subjectCoursesInclude },
        professor: { include: { user: { select: { id: true, name: true, email: true } } } },
      },
    });

    if (!assignment) {
      throw new ForbiddenError('Voce nao e monitor desta disciplina neste periodo');
    }

    return assignment;
  },

  async getSessionOrThrow(sessionId: string) {
    const session = await prisma.monitoringSession.findUnique({
      where: { id: sessionId },
      include: {
        room: true,
        subjectMonitor: {
          include: {
            subject: { include: subjectCoursesInclude },
            monitor: { include: { user: { select: { id: true, name: true, email: true } } } },
            professor: { include: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundError('Sessao nao encontrada');
    }

    return session;
  },
};
