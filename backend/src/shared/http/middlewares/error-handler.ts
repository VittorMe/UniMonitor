import { Prisma } from '@prisma/client';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { AppError, NotFoundError } from '../../errors/app-error.js';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

const zodToDetails = (error: ZodError) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));

interface BodyParserError {
  type: string;
  status: number;
  message: string;
}

/**
 * O body-parser sinaliza corpo malformado ou grande demais com um erro que
 * carrega `type` e `status`. Sem este tratamento eles cairiam no 500 generico,
 * escondendo do cliente que o problema esta na requisicao dele.
 */
const isBodyParserError = (error: unknown): error is BodyParserError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as BodyParserError).type === 'string' &&
  (error as BodyParserError).type.startsWith('entity.') &&
  typeof (error as BodyParserError).status === 'number';

const translateBodyParserError = (error: BodyParserError) => {
  switch (error.type) {
    case 'entity.parse.failed':
      return { statusCode: 400, code: 'INVALID_JSON', message: 'Corpo da requisicao nao e um JSON valido' };
    case 'entity.too.large':
      return { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisicao excede o limite permitido' };
    default:
      return { statusCode: error.status, code: 'BAD_REQUEST', message: 'Corpo da requisicao invalido' };
  }
};

const translatePrismaError = (error: Prisma.PrismaClientKnownRequestError) => {
  switch (error.code) {
    case 'P2002': {
      const target = error.meta?.['target'];
      const fields = Array.isArray(target) ? target.join(', ') : String(target ?? 'campo unico');
      return { statusCode: 409, code: 'CONFLICT', message: `Ja existe um registro com este ${fields}` };
    }
    case 'P2003':
      return { statusCode: 409, code: 'CONFLICT', message: 'Registro referenciado por outro cadastro' };
    case 'P2025':
      return { statusCode: 404, code: 'NOT_FOUND', message: 'Recurso nao encontrado' };
    default:
      return null;
  }
};

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Rota ${req.method} ${req.originalUrl} nao existe`);
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestLogger = req.log ?? logger;

  if (error instanceof ZodError) {
    const body: ErrorBody = {
      error: { code: 'VALIDATION_ERROR', message: 'Dados invalidos', details: zodToDetails(error) },
    };
    res.status(422).json(body);
    return;
  }

  if (error instanceof AppError) {
    const body: ErrorBody = { error: { code: error.code, message: error.message } };
    if (error.details !== undefined) {
      body.error.details = error.details;
    }
    // 5xx com AppError ainda indica defeito nosso, entao registramos o stack.
    if (error.statusCode >= 500) {
      requestLogger.error({ err: error }, error.message);
    } else {
      requestLogger.warn({ code: error.code, statusCode: error.statusCode }, error.message);
    }
    res.status(error.statusCode).json(body);
    return;
  }

  if (isBodyParserError(error)) {
    const translated = translateBodyParserError(error);
    requestLogger.warn({ type: error.type }, translated.message);
    res.status(translated.statusCode).json({
      error: { code: translated.code, message: translated.message },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const translated = translatePrismaError(error);
    if (translated) {
      requestLogger.warn({ prismaCode: error.code }, translated.message);
      res.status(translated.statusCode).json({
        error: { code: translated.code, message: translated.message },
      });
      return;
    }
  }

  requestLogger.error({ err: error }, 'Erro nao tratado');

  // Mensagem e stack reais so saem da API fora de producao, para nao
  // expor detalhes internos a quem chama.
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Erro interno no servidor',
      ...(env.isProduction
        ? {}
        : { details: { message: (error as Error)?.message, stack: (error as Error)?.stack } }),
    },
  });
};
