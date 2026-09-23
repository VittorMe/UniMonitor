import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';

import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { mountSwagger } from './docs/swagger.js';
import { ForbiddenError } from './shared/errors/app-error.js';
import { errorHandler, notFoundHandler } from './shared/http/middlewares/error-handler.js';
import { apiRoutes } from './routes.js';

export const API_PREFIX = '/api/v1';

export const createApp = (): Express => {
  const app = express();

  // Necessario atras de proxy/load balancer para que req.ip e o cookie
  // `secure` considerem o protocolo original da requisicao.
  if (env.isProduction) {
    app.set('trust proxy', 1);
  }

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/docs')) {
      next();
      return;
    }
    helmet()(req, res, next);
  });

  app.use(
    cors({
      // `credentials` exige uma origem explicita: com cookies o navegador
      // recusa a resposta se o servidor devolver "*".
      origin: (origin, callback) => {
        if (!origin || env.CORS_ORIGINS.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new ForbiddenError(`Origem nao autorizada: ${origin}`));
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === `${API_PREFIX}/health` },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(API_PREFIX, apiRoutes);
  mountSwagger(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
