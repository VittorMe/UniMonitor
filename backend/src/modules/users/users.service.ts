import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error.js';
import type { AuthenticatedUser } from '../../shared/http/authenticated-user.js';
import { hashPassword } from '../auth/password.service.js';
import { refreshTokenRepository } from '../auth/refresh-token.repository.js';
import { usersRepository, type PublicUser } from './users.repository.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schemas.js';

export interface Paginated<T> {
  data: T[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export const usersService = {
  async list(query: ListUsersQuery): Promise<Paginated<PublicUser>> {
    const { data, total } = await usersRepository.list({
      page: query.page,
      perPage: query.perPage,
      ...(query.search ? { search: query.search } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.isActive === undefined ? {} : { isActive: query.isActive }),
    });

    return {
      data,
      meta: {
        page: query.page,
        perPage: query.perPage,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.perPage)),
      },
    };
  },

  async getById(id: string): Promise<PublicUser> {
    const user = await usersRepository.findById(id);

    if (!user) {
      throw new NotFoundError('Usuario nao encontrado');
    }

    return user;
  },

  async create(input: CreateUserInput): Promise<PublicUser> {
    const existing = await usersRepository.findByEmailWithPassword(input.email);

    if (existing) {
      throw new ConflictError('Ja existe um usuario com este e-mail');
    }

    return usersRepository.create({
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    });
  },

  async update(id: string, input: UpdateUserInput, actor: AuthenticatedUser): Promise<PublicUser> {
    const user = await usersService.getById(id);

    if (input.email && input.email !== user.email) {
      const existing = await usersRepository.findByEmailWithPassword(input.email);

      if (existing) {
        throw new ConflictError('Ja existe um usuario com este e-mail');
      }
    }

    // Um administrador nao pode rebaixar ou desativar a propria conta, senao
    // pode se trancar fora do sistema sem que ninguem possa reverter.
    if (actor.id === id) {
      if (input.role && input.role !== user.role) {
        throw new BadRequestError('Nao e possivel alterar o proprio perfil de acesso');
      }
      if (input.isActive === false) {
        throw new BadRequestError('Nao e possivel desativar a propria conta');
      }
    }

    if (user.role === 'ADMIN' && (input.role !== undefined || input.isActive === false)) {
      await assertNotLastActiveAdmin(id);
    }

    const updated = await usersRepository.update(id, input);

    // Perda de acesso deve valer imediatamente, nao no fim da validade do token.
    if (input.isActive === false || (input.role && input.role !== user.role)) {
      await refreshTokenRepository.revokeAllForUser(id);
    }

    return updated;
  },

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const user = await usersService.getById(id);

    if (actor.id === id) {
      throw new BadRequestError('Nao e possivel excluir a propria conta');
    }

    if (user.role === 'ADMIN') {
      await assertNotLastActiveAdmin(id);
    }

    await usersRepository.delete(id);
  },
};

/**
 * Impede que o sistema fique sem nenhum administrador ativo, o que tornaria
 * a gestao de usuarios inacessivel.
 */
const assertNotLastActiveAdmin = async (userId: string): Promise<void> => {
  const remaining = await usersRepository.countActiveAdminsExcept(userId);

  if (remaining === 0) {
    throw new BadRequestError('O sistema precisa de pelo menos um administrador ativo');
  }
};
