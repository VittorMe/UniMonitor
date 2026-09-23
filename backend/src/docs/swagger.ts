import type { RequestHandler } from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { env } from '../config/env.js';
import { authenticate } from '../shared/http/middlewares/authenticate.js';
import { authorize } from '../shared/http/middlewares/authorize.js';
import { openApiSpec } from './openapi.js';

const swaggerHelmet: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      childSrc: ["'self'", 'blob:'],
    },
  },
});

const swaggerServe = (Array.isArray(swaggerUi.serve) ? swaggerUi.serve : [swaggerUi.serve]) as RequestHandler[];

const docsGuard: RequestHandler[] = env.isProduction ? [authenticate, authorize('ADMIN')] : [];

/** Documentacao interativa em /api/docs; spec bruta em /api/docs.json */
export const mountSwagger = (app: Express) => {
  app.get('/api/docs.json', ...docsGuard, (_req, res) => {
    res.json(openApiSpec);
  });

  app.use(
    '/api/docs',
    ...docsGuard,
    swaggerHelmet,
    ...swaggerServe,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'UniMonitor API',
      swaggerOptions: {
        persistAuthorization: true,
        withCredentials: true,
      },
    }),
  );
};
