import type { AuthenticatedUser } from '../http/authenticated-user.js';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware `authenticate`. */
      user?: AuthenticatedUser;
    }
  }
}

export {};
