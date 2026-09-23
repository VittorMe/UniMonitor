import type { Prisma, Role, User } from '@prisma/client';

import { prisma } from '../../infra/database/prisma.js';

/** Campos devolvidos pela API: nunca inclui `passwordHash`. */
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{ select: typeof publicUserSelect }>;

export interface ListUsersFilters {
  page: number;
  perPage: number;
  search?: string;
  role?: Role;
  isActive?: boolean;
}

const buildWhere = (filters: ListUsersFilters): Prisma.UserWhereInput => ({
  ...(filters.role ? { role: filters.role } : {}),
  ...(filters.isActive === undefined ? {} : { isActive: filters.isActive }),
  ...(filters.search
    ? {
        OR: [{ name: { contains: filters.search } }, { email: { contains: filters.search } }],
      }
    : {}),
});

export const usersRepository = {
  findById: (id: string): Promise<PublicUser | null> =>
    prisma.user.findUnique({ where: { id }, select: publicUserSelect }),

  /** Uso interno da autenticacao: e o unico ponto que expoe o hash da senha. */
  findByEmailWithPassword: (email: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { email } }),

  findByIdWithPassword: (id: string): Promise<User | null> =>
    prisma.user.findUnique({ where: { id } }),

  create: (data: {
    name: string;
    email: string;
    passwordHash: string;
    role: Role;
  }): Promise<PublicUser> => prisma.user.create({ data, select: publicUserSelect }),

  update: (
    id: string,
    data: Partial<{ name: string; email: string; role: Role; isActive: boolean; passwordHash: string }>,
  ): Promise<PublicUser> => prisma.user.update({ where: { id }, data, select: publicUserSelect }),

  delete: (id: string): Promise<PublicUser> =>
    prisma.user.delete({ where: { id }, select: publicUserSelect }),

  touchLastLogin: (id: string): Promise<unknown> =>
    prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } }),

  async list(filters: ListUsersFilters): Promise<{ data: PublicUser[]; total: number }> {
    const where = buildWhere(filters);

    // Transacao garante que contagem e pagina vem do mesmo instante,
    // evitando totais inconsistentes sob escrita concorrente.
    const [data, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        select: publicUserSelect,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
      }),
      prisma.user.count({ where }),
    ]);

    return { data, total };
  },

  countAll: (): Promise<number> => prisma.user.count(),

  countActiveAdminsExcept: (userId: string): Promise<number> =>
    prisma.user.count({ where: { role: 'ADMIN', isActive: true, id: { not: userId } } }),

  findWithProfile: (id: string) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        ...publicUserSelect,
        professor: { select: { id: true, registration: true } },
        student: { select: { id: true, registration: true, courseId: true } },
        monitor: { select: { id: true, isActive: true } },
      },
    }),
};
