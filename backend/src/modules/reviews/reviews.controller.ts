import type { RequestHandler } from 'express';

import { requireUser } from '../../shared/http/require-user.js';
import { reviewsService } from './reviews.service.js';
import type { CreateReviewInput } from './reviews.schemas.js';

export const reviewsController = {
  create: (async (req, res) => {
    res.status(201).json({
      review: await reviewsService.create(requireUser(req).id, req.body as CreateReviewInput),
    });
  }) as RequestHandler,

  mineAsMonitor: (async (req, res) => {
    res.json({ data: await reviewsService.listForMonitor(requireUser(req).id) });
  }) as RequestHandler,

  bySubject: (async (req, res) => {
    res.json({
      data: await reviewsService.listForProfessor(requireUser(req).id, req.params['id'] as string),
    });
  }) as RequestHandler,
};
