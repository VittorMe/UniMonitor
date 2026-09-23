import type { RequestHandler } from 'express';

import { prisma } from '../../infra/database/prisma.js';
import { ConflictError, NotFoundError } from '../../shared/errors/app-error.js';
import { paginationQuerySchema } from '../../shared/http/common-schemas.js';
import { toPaginated } from '../../shared/http/pagination.js';
import { parsePeriod } from '../../shared/academic-period.js';
import type { CourseBody, RoomBody, SubjectBody } from './catalog.schemas.js';
import { presentSubject, subjectCoursesInclude, subjectWithProfessorsInclude } from './subject.presenter.js';

const listParams = (query: { page: number; perPage: number; search?: string }) => {
  const search = query.search
    ? { OR: [{ name: { contains: query.search } }, { code: { contains: query.search } }] }
    : {};
  return { skip: (query.page - 1) * query.perPage, take: query.perPage, search };
};

export const coursesService = {
  async list(query: { page: number; perPage: number; search?: string }) {
    const { skip, take, search } = listParams(query);
    const where = search;
    const [data, total] = await prisma.$transaction([
      prisma.course.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      prisma.course.count({ where }),
    ]);
    return toPaginated(data, query.page, query.perPage, total);
  },

  getAllActive: () => prisma.course.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),

  async create(input: CourseBody) {
    const exists = await prisma.course.findUnique({ where: { code: input.code } });
    if (exists) throw new ConflictError('Ja existe um curso com este codigo');
    return prisma.course.create({ data: input });
  },

  async update(id: string, input: Partial<CourseBody>) {
    await coursesService.getById(id);
    if (input.code) {
      const exists = await prisma.course.findFirst({ where: { code: input.code, id: { not: id } } });
      if (exists) throw new ConflictError('Ja existe um curso com este codigo');
    }
    return prisma.course.update({ where: { id }, data: input });
  },

  async getById(id: string) {
    const course = await prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundError('Curso nao encontrado');
    return course;
  },
};

export const subjectsService = {
  async list(query: { page: number; perPage: number; search?: string; courseId?: string }) {
    const { skip, take, search } = listParams(query);
    const period = parsePeriod();
    const where = {
      ...search,
      ...(query.courseId ? { courseLinks: { some: { courseId: query.courseId } } } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.subject.findMany({
        where,
        include: subjectWithProfessorsInclude(period),
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.subject.count({ where }),
    ]);
    return toPaginated(data.map(presentSubject), query.page, query.perPage, total);
  },

  getAllActive: async () => {
    const rows = await prisma.subject.findMany({
      where: { isActive: true },
      include: subjectCoursesInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(presentSubject);
  },

  async create(input: SubjectBody) {
    const courseIds = await assertActiveCourses(input.courseIds);
    const exists = await prisma.subject.findUnique({ where: { code: input.code } });
    if (exists) throw new ConflictError('Ja existe uma disciplina com este codigo');
    const created = await prisma.subject.create({
      data: {
        name: input.name,
        code: input.code,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        courseLinks: { create: courseIds.map((courseId) => ({ courseId })) },
      },
      include: subjectWithProfessorsInclude(parsePeriod()),
    });
    return presentSubject(created);
  },

  async update(id: string, input: Partial<SubjectBody>) {
    await subjectsService.getById(id);
    if (input.code) {
      const exists = await prisma.subject.findFirst({ where: { code: input.code, id: { not: id } } });
      if (exists) throw new ConflictError('Ja existe uma disciplina com este codigo');
    }

    const courseIds = input.courseIds ? await assertActiveCourses(input.courseIds) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      if (courseIds) {
        await tx.subjectCourse.deleteMany({ where: { subjectId: id } });
        await tx.subjectCourse.createMany({
          data: courseIds.map((courseId) => ({ subjectId: id, courseId })),
        });
      }

      return tx.subject.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          ...(input.code ? { code: input.code } : {}),
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        },
        include: subjectWithProfessorsInclude(parsePeriod()),
      });
    });

    return presentSubject(updated);
  },

  async getById(id: string) {
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: subjectWithProfessorsInclude(parsePeriod()),
    });
    if (!subject) throw new NotFoundError('Disciplina nao encontrada');
    return presentSubject(subject);
  },
};

const assertActiveCourses = async (courseIds: string[]): Promise<string[]> => {
  const uniqueIds = [...new Set(courseIds)];
  const courses = await prisma.course.findMany({
    where: { id: { in: uniqueIds }, isActive: true },
    select: { id: true },
  });
  if (courses.length !== uniqueIds.length) {
    throw new NotFoundError('Curso invalido ou inativo');
  }
  return uniqueIds;
};

export const roomsService = {
  async list(query: { page: number; perPage: number; search?: string }) {
    const { skip, take } = listParams(query);
    const where = query.search
      ? { OR: [{ name: { contains: query.search } }, { building: { contains: query.search } }] }
      : {};
    const [data, total] = await prisma.$transaction([
      prisma.room.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      prisma.room.count({ where }),
    ]);
    return toPaginated(data, query.page, query.perPage, total);
  },

  getAllActive: () => prisma.room.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),

  async create(input: RoomBody) {
    return prisma.room.create({ data: input });
  },

  async update(id: string, input: Partial<RoomBody>) {
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundError('Sala nao encontrada');
    return prisma.room.update({ where: { id }, data: input });
  },
};

export const catalogListQuery = paginationQuerySchema.extend({});
export type CatalogListQuery = { page: number; perPage: number; search?: string };

export const coursesController = {
  list: (async (req, res) => {
    res.json(await coursesService.list(req.query as unknown as CatalogListQuery));
  }) as RequestHandler,
  options: (async (_req, res) => {
    res.json({ data: await coursesService.getAllActive() });
  }) as RequestHandler,
  create: (async (req, res) => {
    res.status(201).json({ course: await coursesService.create(req.body as CourseBody) });
  }) as RequestHandler,
  update: (async (req, res) => {
    res.json({
      course: await coursesService.update(req.params['id'] as string, req.body as Partial<CourseBody>),
    });
  }) as RequestHandler,
};

export const subjectsController = {
  list: (async (req, res) => {
    const query = req.query as unknown as CatalogListQuery & { courseId?: string };
    res.json(await subjectsService.list(query));
  }) as RequestHandler,
  options: (async (_req, res) => {
    res.json({ data: await subjectsService.getAllActive() });
  }) as RequestHandler,
  create: (async (req, res) => {
    res.status(201).json({ subject: await subjectsService.create(req.body as SubjectBody) });
  }) as RequestHandler,
  update: (async (req, res) => {
    res.json({
      subject: await subjectsService.update(req.params['id'] as string, req.body as Partial<SubjectBody>),
    });
  }) as RequestHandler,
};

export const roomsController = {
  list: (async (req, res) => {
    res.json(await roomsService.list(req.query as unknown as CatalogListQuery));
  }) as RequestHandler,
  options: (async (_req, res) => {
    res.json({ data: await roomsService.getAllActive() });
  }) as RequestHandler,
  create: (async (req, res) => {
    res.status(201).json({ room: await roomsService.create(req.body as RoomBody) });
  }) as RequestHandler,
  update: (async (req, res) => {
    res.json({
      room: await roomsService.update(req.params['id'] as string, req.body as Partial<RoomBody>),
    });
  }) as RequestHandler,
};
