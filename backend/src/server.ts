import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { disconnectDatabase, prisma } from './infra/database/prisma.js';

const start = async (): Promise<void> => {
  // Falhar aqui e melhor do que subir a API e devolver 500 em toda requisicao.
  await prisma.$connect();
  logger.info('Conexao com o MySQL estabelecida');

  const server = createApp().listen(env.PORT, () => {
    logger.info(`API ouvindo em http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} recebido, encerrando`);

    // Para de aceitar novas conexoes e espera as em andamento terminarem
    // antes de fechar o pool do banco.
    server.close(async (error) => {
      if (error) {
        logger.error({ err: error }, 'Falha ao fechar o servidor HTTP');
      }

      await disconnectDatabase();
      process.exit(error ? 1 : 0);
    });

    setTimeout(() => {
      logger.error('Encerramento nao concluiu em 10s, forcando saida');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Promise rejeitada sem tratamento');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Excecao nao capturada');
  process.exit(1);
});

await start().catch(async (error: unknown) => {
  logger.fatal({ err: error }, 'Falha ao iniciar a API');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
