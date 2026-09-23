import { prisma } from '../../infra/database/prisma.js';
import { parsePeriod, periodLabel } from '../../shared/academic-period.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error.js';
import { toPaginated } from '../../shared/http/pagination.js';
import { hashPassword } from '../auth/password.service.js';
import { notifyUser } from '../notifications/notifications.controller.js';
import { academicAccess } from '../academic/academic-access.js';
import { presentSubject, subjectCoursesInclude } from '../catalog/subject.presenter.js';
import type {
  AssignMonitorInput,
  CreateProfessorInput,
  CreateStudentInput,
  LinkSubjectInput,
  UpdateProfessorInput,
} from './people.schemas.js';

const userPublic = { id: true, name: true, email: true, role: true, isActive: true } as const;
const userLookup = { id: true, name: true, email: true, role: true, isActive: true } as const;

const presentStudentForProfessor = (student: {
  id: string;
  registration: string;
  course: { id: string; name: string; code: string } | null;
  user: { name: string; email: string; isActive: boolean };
  monitor: { id: string; isActive: boolean } | null;
}) => ({
  id: student.id,
  registration: student.registration,
  course: student.course,
  user: {
    name: student.user.name,
    email: student.user.email,
    isActive: student.user.isActive,
  },
  monitor: student.monitor ? { id: student.monitor.id, isActive: student.monitor.isActive } : null,
});

const presentMonitorAssignment = (row: {
  id: string;
  monitorId: string;
  isActive: boolean;
  monitor: {
    id: string;
    user: { name: string; email: string };
    student: { registration: string; course: { id: string; name: string; code: string } };
  };
}) => ({
  id: row.id,
  monitorId: row.monitorId,
  isActive: row.isActive,
  monitor: {
    id: row.monitor.id,
    user: { name: row.monitor.user.name, email: row.monitor.user.email },
    student: {
      registration: row.monitor.student.registration,
      course: row.monitor.student.course,
    },
  },
});

const deactivateMonitorIfIdle = async (monitorId: string) => {
  const remaining = await prisma.subjectMonitor.count({
    where: { monitorId, isActive: true },
  });
  if (remaining > 0) return;

  const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
  if (!monitor) return;

  await prisma.user.update({ where: { id: monitor.userId }, data: { role: 'STUDENT' } });
  await prisma.monitor.update({ where: { id: monitorId }, data: { isActive: false } });
};

export const professorsService = {
  async list(query: { page: number; perPage: number; search?: string; isActive?: boolean }) {
    const period = parsePeriod();
    const where = {
      ...(query.isActive === undefined ? {} : { user: { isActive: query.isActive } }),
      ...(query.search
        ? {
            OR: [
              { registration: { contains: query.search } },
              { user: { name: { contains: query.search } } },
              { user: { email: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.professor.findMany({
        where,
        include: {
          user: { select: userPublic },
          subjectLinks: {
            where: { isActive: true, year: period.year, semester: period.semester },
            include: { subject: { select: { id: true, name: true, code: true } } },
            orderBy: { subject: { name: 'asc' } },
          },
        },
        orderBy: { user: { name: 'asc' } },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.professor.count({ where }),
    ]);

    return toPaginated(
      data.map((row) => ({
        ...row,
        period: { ...period, label: periodLabel(period) },
      })),
      query.page,
      query.perPage,
      total,
    );
  },

  async create(input: CreateProfessorInput) {
    const emailTaken = await prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) throw new ConflictError('Ja existe um usuario com este e-mail');

    const registrationTaken = await prisma.professor.findUnique({
      where: { registration: input.registration },
    });
    if (registrationTaken) throw new ConflictError('Ja existe um professor com esta matricula');

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: 'PROFESSOR',
      },
    });

    return prisma.professor.create({
      data: { registration: input.registration, userId: user.id },
      include: { user: { select: userPublic } },
    });
  },

  async update(id: string, input: UpdateProfessorInput) {
    const professor = await prisma.professor.findUnique({
      where: { id },
      include: { user: { select: userLookup } },
    });
    if (!professor) throw new NotFoundError('Professor nao encontrado');

    if (input.email && input.email !== professor.user.email) {
      const taken = await prisma.user.findUnique({ where: { email: input.email } });
      if (taken) throw new ConflictError('Ja existe um usuario com este e-mail');
    }

    if (input.registration && input.registration !== professor.registration) {
      const taken = await prisma.professor.findUnique({ where: { registration: input.registration } });
      if (taken) throw new ConflictError('Ja existe um professor com esta matricula');
    }

    return prisma.professor.update({
      where: { id },
      data: {
        ...(input.registration ? { registration: input.registration } : {}),
        user: {
          update: {
            ...(input.name ? { name: input.name } : {}),
            ...(input.email ? { email: input.email } : {}),
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
          },
        },
      },
      include: { user: { select: userPublic } },
    });
  },

  async linkSubject(professorId: string, input: LinkSubjectInput) {
    const period = parsePeriod(input.year, input.semester);
    const professor = await prisma.professor.findUnique({ where: { id: professorId } });
    if (!professor) throw new NotFoundError('Professor nao encontrado');

    const subject = await prisma.subject.findUnique({ where: { id: input.subjectId } });
    if (!subject?.isActive) throw new NotFoundError('Disciplina nao encontrada');

    const alreadyLinked = await prisma.professorSubject.findUnique({
      where: {
        professorId_subjectId_year_semester: {
          professorId,
          subjectId: input.subjectId,
          year: period.year,
          semester: period.semester,
        },
      },
    });
    if (alreadyLinked?.isActive) {
      throw new ConflictError('Este professor ja administra esta disciplina neste periodo');
    }

    const row = await prisma.professorSubject.upsert({
      where: {
        professorId_subjectId_year_semester: {
          professorId,
          subjectId: input.subjectId,
          year: period.year,
          semester: period.semester,
        },
      },
      update: { isActive: true },
      create: {
        professorId,
        subjectId: input.subjectId,
        year: period.year,
        semester: period.semester,
      },
      include: { subject: { include: subjectCoursesInclude } },
    });

    return {
      ...row,
      subject: presentSubject(row.subject),
    };
  },

  async unlinkSubject(professorId: string, subjectId: string, year?: number, semester?: number) {
    const professor = await prisma.professor.findUnique({ where: { id: professorId } });
    if (!professor) throw new NotFoundError('Professor nao encontrado');

    const period = parsePeriod(year, semester);
    const updated = await prisma.professorSubject.updateMany({
      where: { professorId, subjectId, year: period.year, semester: period.semester },
      data: { isActive: false },
    });
    if (updated.count === 0) {
      throw new NotFoundError('Este professor nao esta vinculado a esta disciplina neste periodo');
    }

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    const subjectName = subject?.name ?? 'esta disciplina';
    const label = periodLabel(period);

    const assignments = await prisma.subjectMonitor.findMany({
      where: {
        professorId,
        subjectId,
        year: period.year,
        semester: period.semester,
        isActive: true,
      },
      select: { monitorId: true, monitor: { select: { userId: true } } },
    });

    await prisma.subjectMonitor.updateMany({
      where: {
        professorId,
        subjectId,
        year: period.year,
        semester: period.semester,
        isActive: true,
      },
      data: { isActive: false },
    });

    for (const assignment of assignments) {
      await deactivateMonitorIfIdle(assignment.monitorId);
      await notifyUser({
        userId: assignment.monitor.userId,
        type: 'GENERIC',
        title: 'Monitoria encerrada',
        message: `Voce nao e mais monitor de ${subjectName} em ${label}.`,
      });
    }

    await notifyUser({
      userId: professor.userId,
      type: 'GENERIC',
      title: 'Disciplina desvinculada',
      message: `Voce nao administra mais ${subjectName} em ${label}.`,
    });
  },
};

export const studentsService = {
  async list(query: { page: number; perPage: number; search?: string; courseId?: string }) {
    const where = {
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.search
        ? {
            OR: [
              { registration: { contains: query.search } },
              { user: { name: { contains: query.search } } },
              { user: { email: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.student.findMany({
        where,
        include: { user: { select: userPublic }, course: true, monitor: true },
        orderBy: { user: { name: 'asc' } },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.student.count({ where }),
    ]);

    return toPaginated(data, query.page, query.perPage, total);
  },

  async listForProfessor(
    professorUserId: string,
    query: { page: number; perPage: number; search?: string; courseId?: string; subjectId?: string },
  ) {
    const period = parsePeriod();
    const professor = await academicAccess.requireProfessor(professorUserId);
    const allowedCourses = await allowedCourseIdsForProfessor(professor.id, period, query.subjectId);
    if (query.courseId && !allowedCourses.includes(query.courseId)) {
      return toPaginated([], query.page, query.perPage, 0);
    }
    const courseIds = query.courseId ? [query.courseId] : allowedCourses;
    if (courseIds.length === 0) {
      return toPaginated([], query.page, query.perPage, 0);
    }

    const where = {
      courseId: { in: courseIds },
      ...(query.search
        ? {
            OR: [
              { registration: { contains: query.search } },
              { user: { name: { contains: query.search } } },
              { user: { email: { contains: query.search } } },
            ],
          }
        : {}),
    };

    const [data, total] = await prisma.$transaction([
      prisma.student.findMany({
        where,
        include: {
          user: { select: { name: true, email: true, isActive: true } },
          course: { select: { id: true, name: true, code: true } },
          monitor: { select: { id: true, isActive: true } },
        },
        orderBy: { user: { name: 'asc' } },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      prisma.student.count({ where }),
    ]);

    return toPaginated(data.map(presentStudentForProfessor), query.page, query.perPage, total);
  },

  async create(input: CreateStudentInput) {
    const emailTaken = await prisma.user.findUnique({ where: { email: input.email } });
    if (emailTaken) throw new ConflictError('Ja existe um usuario com este e-mail');

    const registrationTaken = await prisma.student.findUnique({
      where: { registration: input.registration },
    });
    if (registrationTaken) throw new ConflictError('Ja existe um aluno com esta matricula');

    const course = await prisma.course.findUnique({ where: { id: input.courseId } });
    if (!course?.isActive) throw new NotFoundError('Curso nao encontrado');

    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: 'STUDENT',
      },
    });

    return prisma.student.create({
      data: {
        registration: input.registration,
        courseId: input.courseId,
        userId: user.id,
      },
      include: { user: { select: userPublic }, course: true },
    });
  },
};

export const monitorsService = {
  async listBySubject(professorUserId: string, subjectId: string, year?: number, semester?: number) {
    const period = parsePeriod(year, semester);
    const professor = await academicAccess.requireProfessor(professorUserId);
    await academicAccess.requireProfessorOwnsSubject(professor.id, subjectId, period);

    const rows = await prisma.subjectMonitor.findMany({
      where: { subjectId, professorId: professor.id, year: period.year, semester: period.semester },
      include: {
        monitor: {
          include: {
            user: { select: { name: true, email: true } },
            student: { include: { course: { select: { id: true, name: true, code: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(presentMonitorAssignment);
  },

  async assign(professorUserId: string, subjectId: string, input: AssignMonitorInput) {
    const period = parsePeriod(input.year, input.semester);
    const professor = await academicAccess.requireProfessor(professorUserId);
    await academicAccess.requireProfessorOwnsSubject(professor.id, subjectId, period);
    const subjectRow = await prisma.subject.findUnique({ where: { id: subjectId } });
    if (!subjectRow?.isActive) throw new BadRequestError('Esta disciplina esta desativada');

    const student = await prisma.student.findUnique({
      where: { id: input.studentId },
      include: { user: { select: userLookup }, monitor: true },
    });

    if (!student) throw new NotFoundError('Aluno nao encontrado');
    if (!student.user.isActive) throw new BadRequestError('Aluno desativado');

    const subjectCourses = await prisma.subjectCourse.findMany({
      where: { subjectId },
      select: { courseId: true },
    });
    if (!subjectCourses.some((link) => link.courseId === student.courseId)) {
      throw new BadRequestError('Este aluno nao pertence a um curso desta disciplina');
    }

    let monitor = student.monitor;
    if (!monitor) {
      monitor = await prisma.monitor.create({
        data: { userId: student.userId, studentId: student.id, isActive: true },
      });
    } else if (!monitor.isActive) {
      monitor = await prisma.monitor.update({
        where: { id: monitor.id },
        data: { isActive: true },
      });
    }

    const existing = await prisma.subjectMonitor.findUnique({
      where: {
        monitorId_subjectId_year_semester: {
          monitorId: monitor.id,
          subjectId,
          year: period.year,
          semester: period.semester,
        },
      },
    });

    if (existing?.isActive) {
      if (existing.professorId !== professor.id) {
        throw new ConflictError('Este aluno ja e monitor desta disciplina com outro professor neste periodo');
      }
      throw new ConflictError('Este aluno ja e monitor desta disciplina neste periodo');
    }

    const assignment = await prisma.$transaction(async (tx) => {
      if (student.user.role === 'STUDENT') {
        await tx.user.update({ where: { id: student.userId }, data: { role: 'MONITOR' } });
      }

      return tx.subjectMonitor.upsert({
        where: {
          monitorId_subjectId_year_semester: {
            monitorId: monitor.id,
            subjectId,
            year: period.year,
            semester: period.semester,
          },
        },
        update: { isActive: true, professorId: professor.id, approvedAt: new Date() },
        create: {
          monitorId: monitor.id,
          subjectId,
          professorId: professor.id,
          year: period.year,
          semester: period.semester,
        },
        include: {
          monitor: {
            include: {
              user: { select: { name: true, email: true } },
              student: { include: { course: { select: { id: true, name: true, code: true } } } },
            },
          },
          subject: true,
        },
      });
    });

    await notifyUser({
      userId: student.userId,
      type: 'MONITOR_ASSIGNED',
      title: 'Voce foi vinculado como monitor',
      message: `Voce agora e monitor de ${assignment.subject.name} em ${period.year}.${period.semester}.`,
      link: '/monitor',
    });

    return presentMonitorAssignment(assignment);
  },

  async unassign(
    professorUserId: string,
    subjectId: string,
    monitorId: string,
    year?: number,
    semester?: number,
  ) {
    const period = parsePeriod(year, semester);
    const professor = await academicAccess.requireProfessor(professorUserId);
    await academicAccess.requireProfessorOwnsSubject(professor.id, subjectId, period);

    await prisma.subjectMonitor.updateMany({
      where: {
        monitorId,
        subjectId,
        professorId: professor.id,
        year: period.year,
        semester: period.semester,
      },
      data: { isActive: false },
    });

    const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
    const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
    if (monitor) {
      await notifyUser({
        userId: monitor.userId,
        type: 'GENERIC',
        title: 'Monitoria encerrada',
        message: `Voce nao e mais monitor de ${subject?.name ?? 'esta disciplina'} em ${periodLabel(period)}.`,
      });
    }

    await deactivateMonitorIfIdle(monitorId);
  },

  async listMine(monitorUserId: string, year?: number, semester?: number) {
    const period = parsePeriod(year, semester);
    const monitor = await academicAccess.requireMonitor(monitorUserId);

    const rows = await prisma.subjectMonitor.findMany({
      where: {
        monitorId: monitor.id,
        isActive: true,
        year: period.year,
        semester: period.semester,
        subject: { isActive: true },
      },
      include: {
        subject: { include: subjectCoursesInclude },
        professor: { include: { user: { select: { name: true } } } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      subject: presentSubject(row.subject),
      professor: { user: { name: row.professor.user.name } },
    }));
  },
};

export const professorSubjectsService = {
  async listMine(professorUserId: string, year?: number, semester?: number) {
    const period = parsePeriod(year, semester);
    const professor = await academicAccess.requireProfessor(professorUserId);

    const links = await prisma.professorSubject.findMany({
      where: {
        professorId: professor.id,
        isActive: true,
        year: period.year,
        semester: period.semester,
        subject: { isActive: true },
      },
      include: {
        subject: { include: subjectCoursesInclude },
      },
    });

    return Promise.all(
      links.map(async (link) => {
        const [monitors, sessionsThisMonth] = await Promise.all([
          prisma.subjectMonitor.count({
            where: {
              subjectId: link.subjectId,
              professorId: professor.id,
              year: period.year,
              semester: period.semester,
              isActive: true,
            },
          }),
          prisma.monitoringSession.count({
            where: {
              subjectMonitor: { subjectId: link.subjectId, professorId: professor.id },
              startAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
              status: { not: 'CANCELLED' },
            },
          }),
        ]);

        return { ...link, subject: presentSubject(link.subject), monitors, sessionsThisMonth };
      }),
    );
  },
};

const allowedCourseIdsForProfessor = async (
  professorId: string,
  period: { year: number; semester: 1 | 2 },
  subjectId?: string,
): Promise<string[]> => {
  if (subjectId) {
    await academicAccess.requireProfessorOwnsSubject(professorId, subjectId, period);
    const links = await prisma.subjectCourse.findMany({
      where: { subjectId },
      select: { courseId: true },
    });
    return links.map((link) => link.courseId);
  }

  const links = await prisma.professorSubject.findMany({
    where: {
      professorId,
      isActive: true,
      year: period.year,
      semester: period.semester,
    },
    include: { subject: { select: { courseLinks: { select: { courseId: true } } } } },
  });

  return [...new Set(links.flatMap((link) => link.subject.courseLinks.map((item) => item.courseId)))];
};
