import pino from 'pino';

import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  // Em producao o log vai em JSON para ser consumido por um agregador;
  // em desenvolvimento passa pelo pino-pretty para ficar legivel no terminal.
  ...(env.isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
        },
      }),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.passwordHash',
      '*.token',
      'req.query.token',
      '*.refreshToken',
    ],
    censor: '[oculto]',
  },
});

export type Logger = typeof logger;
