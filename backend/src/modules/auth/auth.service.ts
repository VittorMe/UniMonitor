import { prisma } from '../../infra/database/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { currentAcademicPeriod } from '../../shared/academic-period.js';
import { BadRequestError, UnauthorizedError } from '../../shared/errors/app-error.js';
import { durationToMs } from '../../shared/utils/duration.js';
import { usersRepository, type PublicUser } from '../users/users.repository.js';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from './auth.schemas.js';
import { resolveEffectiveRole } from './effective-role.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { refreshTokenRepository } from './refresh-token.repository.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from './token.service.js';

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionPayload {
  user: PublicUser;
  profile: {
    professorId: string | null;
    studentId: string | null;
    monitorId: string | null;
    registration: string | null;
    courseId: string | null;
  };
  period: {
    year: number;
    semester: 1 | 2;
    label: string;
  };
}

export interface AuthResult extends SessionPayload {
  accessToken: string;
  refreshToken: string;
}

const toPublicUser = (user: {
  id: string;
  name: string;
  email: string;
  role: PublicUser['role'];
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const issueTokens = async (
  user: { id: string; email: string; role: PublicUser['role'] },
  context: SessionContext,
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = generateRefreshToken();

  await refreshTokenRepository.create({
    tokenHash: hashRefreshToken(refreshToken),
    userId: user.id,
    expiresAt: new Date(Date.now() + durationToMs(env.JWT_REFRESH_TTL)),
    ...(context.userAgent ? { userAgent: context.userAgent.slice(0, 255) } : {}),
    ...(context.ipAddress ? { ipAddress: context.ipAddress.slice(0, 45) } : {}),
  });

  return { accessToken, refreshToken };
};

export const authService = {
  async login(input: LoginInput, context: SessionContext): Promise<AuthResult> {
    const user = await usersRepository.findByEmailWithPassword(input.email);

    // Comparamos a senha mesmo com usuario inexistente seria o ideal para
    // igualar o tempo de resposta; aqui a mensagem generica ja evita revelar
    // se o e-mail existe.
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedError('E-mail ou senha incorretos');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Usuario desativado. Procure um administrador');
    }

    const role = await resolveEffectiveRole(user);
    const tokens = await issueTokens({ ...user, role }, context);
    await usersRepository.touchLastLogin(user.id);

    logger.info({ userId: user.id }, 'Login realizado');

    return { ...(await authService.getSession(user.id)), ...tokens };
  },

  /**
   * Rotaciona o refresh token: o token usado e revogado e aponta para o novo.
   * Se um token ja revogado for apresentado, tratamos como indicio de roubo
   * e encerramos todas as sessoes do usuario.
   */
  async refresh(refreshToken: string, context: SessionContext): Promise<AuthResult> {
    const stored = await refreshTokenRepository.findByHash(hashRefreshToken(refreshToken));

    if (!stored) {
      throw new UnauthorizedError('Sessao invalida. Faca login novamente');
    }

    if (stored.revokedAt) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      logger.warn({ userId: stored.userId }, 'Reuso de refresh token detectado; sessoes encerradas');
      throw new UnauthorizedError('Sessao invalida. Faca login novamente');
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Sessao expirada. Faca login novamente');
    }

    const user = await usersRepository.findByIdWithPassword(stored.userId);

    if (!user || !user.isActive) {
      await refreshTokenRepository.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Usuario indisponivel. Faca login novamente');
    }

    const role = await resolveEffectiveRole(user);
    const tokens = await issueTokens({ ...user, role }, context);
    await refreshTokenRepository.revoke(stored.id, hashRefreshToken(tokens.refreshToken));

    return { ...(await authService.getSession(user.id)), ...tokens };
  },

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const stored = await refreshTokenRepository.findByHash(hashRefreshToken(refreshToken));

    if (stored && !stored.revokedAt) {
      await refreshTokenRepository.revoke(stored.id);
    }
  },

  async logoutAll(userId: string): Promise<void> {
    await refreshTokenRepository.revokeAllForUser(userId);
  },

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await usersRepository.findByIdWithPassword(userId);

    if (!user) {
      throw new UnauthorizedError('Usuario nao encontrado');
    }

    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedError('Senha atual incorreta');
    }

    await usersRepository.update(userId, { passwordHash: await hashPassword(input.newPassword) });

    // Trocar a senha invalida as sessoes antigas em todos os dispositivos.
    await refreshTokenRepository.revokeAllForUser(userId);

    logger.info({ userId }, 'Senha alterada');
  },

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<PublicUser> {
    const current = await usersRepository.findWithProfile(userId);
    if (!current) {
      throw new UnauthorizedError('Usuario nao encontrado');
    }

    if (input.courseId) {
      if (!current.student) {
        throw new BadRequestError('Somente alunos podem alterar o curso');
      }
      const course = await prisma.course.findUnique({ where: { id: input.courseId } });
      if (!course?.isActive) {
        throw new BadRequestError('Curso invalido ou inativo');
      }
    }

    if (input.registration && !current.student && !current.professor) {
      throw new BadRequestError('Seu perfil nao possui matricula para alterar');
    }

    await prisma.$transaction(async (tx) => {
      if (input.name || input.email) {
        await tx.user.update({
          where: { id: userId },
          data: {
            ...(input.name ? { name: input.name } : {}),
            ...(input.email ? { email: input.email } : {}),
          },
        });
      }

      if (current.student && (input.registration || input.courseId)) {
        await tx.student.update({
          where: { id: current.student.id },
          data: {
            ...(input.registration ? { registration: input.registration } : {}),
            ...(input.courseId ? { courseId: input.courseId } : {}),
          },
        });
      }

      if (current.professor && input.registration) {
        await tx.professor.update({
          where: { id: current.professor.id },
          data: { registration: input.registration },
        });
      }
    });

    const updated = await usersRepository.findById(userId);
    if (!updated) {
      throw new UnauthorizedError('Usuario nao encontrado');
    }

    logger.info({ userId }, 'Perfil atualizado');
    return updated;
  },

  async register(input: RegisterInput, context: SessionContext): Promise<AuthResult> {
    const { studentsService } = await import('../people/people.service.js');
    await studentsService.create({
      name: input.name,
      email: input.email,
      password: input.password,
      registration: input.registration,
      courseId: input.courseId,
    });

    return authService.login({ email: input.email, password: input.password }, context);
  },

  async getSession(userId: string): Promise<SessionPayload> {
    const user = await usersRepository.findWithProfile(userId);
    if (!user) {
      throw new UnauthorizedError('Usuario nao encontrado');
    }

    const effectiveRole = await resolveEffectiveRole(user);

    const period = currentAcademicPeriod();
    return {
      user: toPublicUser({ ...user, role: effectiveRole }),
      profile: {
        professorId: user.professor?.id ?? null,
        studentId: user.student?.id ?? null,
        monitorId: user.monitor?.isActive ? (user.monitor.id ?? null) : null,
        registration: user.professor?.registration ?? user.student?.registration ?? null,
        courseId: user.student?.courseId ?? null,
      },
      period: { ...period, label: `${period.year}.${period.semester}` },
    };
  },
};
