import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Valida a requisicao e substitui `body`/`query`/`params` pelo resultado
 * do parse, de modo que o controller receba dados ja coeridos e tipados.
 * Erros de Zod sao capturados pelo error handler e viram 422.
 */
export const validate = (schemas: ValidationSchemas): RequestHandler => {
  return (req, _res, next) => {
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as typeof req.params;
    }
    if (schemas.query) {
      Object.defineProperty(req, 'query', {
        value: schemas.query.parse(req.query),
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    next();
  };
};
