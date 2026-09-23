import type { RefreshToken } from '@prisma/client';

import { prisma } from '../../infra/database/prisma.js';

export const refreshTokenRepository = {
  create: (data: {
    tokenHash: string;
    userId: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<RefreshToken> => prisma.refreshToken.create({ data }),

  findByHash: (tokenHash: string): Promise<RefreshToken | null> =>
    prisma.refreshToken.findUnique({ where: { tokenHash } }),

  revoke: (id: string, replacedByTokenHash?: string): Promise<RefreshToken> =>
    prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), ...(replacedByTokenHash ? { replacedByTokenHash } : {}) },
    }),

  /** Usado no logout e ao detectar reuso de token, encerrando todas as sessoes. */
  revokeAllForUser: (userId: string): Promise<{ count: number }> =>
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),

  deleteExpired: (): Promise<{ count: number }> =>
    prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
};
