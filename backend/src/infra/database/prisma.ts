import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const createPrismaClient = () =>
  new PrismaClient({
    // A partir do Prisma 7 a conexao vem de um driver adapter, e nao mais de
    // uma `url` no schema. O adapter do MariaDB e o caminho oficial para MySQL.
    adapter: new PrismaMariaDb(env.DATABASE_URL),
    log: env.isProduction
      ? [{ emit: 'event', level: 'error' }]
      : [
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'warn' },
          { emit: 'event', level: 'query' },
        ],
  });

// O `tsx watch` recria o modulo a cada alteracao; sem este cache o processo
// acumularia um pool de conexoes por reload ate o MySQL recusar novas.
const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createPrismaClient> };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

prisma.$on('error', (event) => logger.error({ prisma: event }, 'Erro no Prisma'));

if (!env.isProduction) {
  prisma.$on('warn', (event) => logger.warn({ prisma: event }, 'Aviso do Prisma'));
  prisma.$on('query', (event) =>
    logger.debug({ query: event.query, params: event.params, durationMs: event.duration }, 'Query'),
  );
}

export const disconnectDatabase = () => prisma.$disconnect();
