import type { Prisma } from '@prisma/client';

import type { AcademicPeriod } from '../../shared/academic-period.js';

const coursePublic = { id: true, name: true, code: true, isActive: true } as const;

export const subjectCoursesInclude = {
  courseLinks: {
    include: { course: { select: coursePublic } },
  },
} satisfies Prisma.SubjectInclude;

export const subjectWithProfessorsInclude = (period: AcademicPeriod) =>
  ({
    ...subjectCoursesInclude,
    professorLinks: {
      where: { isActive: true, year: period.year, semester: period.semester },
      include: {
        professor: { select: { id: true, user: { select: { name: true } } } },
      },
    },
  }) satisfies Prisma.SubjectInclude;

type LinkedCourse = { id: string; name: string; code: string; isActive: boolean };
type LinkedProfessor = { id: string; user: { name: string } };

export const presentSubject = <
  T extends {
    courseLinks: Array<{ course: LinkedCourse }>;
    professorLinks?: Array<{ professor: LinkedProfessor }>;
  },
>(
  subject: T,
) => {
  const { courseLinks, professorLinks, ...rest } = subject;
  return {
    ...rest,
    courses: [...courseLinks]
      .map((link) => link.course)
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    ...(professorLinks
      ? {
          professors: professorLinks
            .map((link) => ({ id: link.professor.id, name: link.professor.user.name }))
            .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
        }
      : {}),
  };
};
