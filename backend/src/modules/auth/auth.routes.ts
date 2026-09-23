import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { env } from '../../config/env.js';
import { authenticate } from '../../shared/http/middlewares/authenticate.js';
import { validate } from '../../shared/http/middlewares/validate.js';
import { authController } from './auth.controller.js';
import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from './auth.schemas.js';

// Limite estreito nas rotas de credencial para dificultar forca bruta.
// Desligado em teste para nao interferir nas suites.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skip: () => env.isTest,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Muitas tentativas de login. Aguarde alguns minutos' } },
});

export const authRoutes = Router();

authRoutes.post('/login', loginRateLimit, validate({ body: loginSchema }), authController.login);
authRoutes.post('/register', loginRateLimit, validate({ body: registerSchema }), authController.register);
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/logout', authController.logout);

authRoutes.get('/me', authenticate, authController.me);
authRoutes.patch('/me', authenticate, validate({ body: updateProfileSchema }), authController.updateProfile);
authRoutes.post('/logout-all', authenticate, authController.logoutAll);
authRoutes.patch(
  '/password',
  authenticate,
  loginRateLimit,
  validate({ body: changePasswordSchema }),
  authController.changePassword,
);
