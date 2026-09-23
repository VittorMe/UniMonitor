import type { RequestHandler } from 'express';

import { requireUser } from '../../shared/http/require-user.js';
import { availabilityService, sessionsService } from './session.service.js';
import type {
  AvailabilityInput,
  CreateSessionInput,
  SearchSessionsQuery,
  UpdateSessionInput,
} from './session.schemas.js';

export const sessionsController = {
  create: (async (req, res) => {
    res.status(201).json({ session: await sessionsService.create(requireUser(req).id, req.body as CreateSessionInput) });
  }) as RequestHandler,

  update: (async (req, res) => {
    res.json({
      session: await sessionsService.update(
        requireUser(req).id,
        req.params['id'] as string,
        req.body as UpdateSessionInput,
      ),
    });
  }) as RequestHandler,

  cancel: (async (req, res) => {
    await sessionsService.cancel(requireUser(req).id, req.params['id'] as string);
    res.status(204).send();
  }) as RequestHandler,

  listMine: (async (req, res) => {
    res.json({ data: await sessionsService.listMine(requireUser(req).id) });
  }) as RequestHandler,

  listForProfessor: (async (req, res) => {
    const query = req.query as { year?: string; semester?: string };
    res.json({
      data: await sessionsService.listBySubjectForProfessor(
        requireUser(req).id,
        req.params['id'] as string,
        query.year ? Number(query.year) : undefined,
        query.semester ? Number(query.semester) : undefined,
      ),
    });
  }) as RequestHandler,

  start: (async (req, res) => {
    res.json(await sessionsService.start(requireUser(req).id, req.params['id'] as string));
  }) as RequestHandler,

  complete: (async (req, res) => {
    await sessionsService.complete(requireUser(req).id, req.params['id'] as string);
    res.status(204).send();
  }) as RequestHandler,

  participants: (async (req, res) => {
    res.json({ data: await sessionsService.listParticipants(requireUser(req).id, req.params['id'] as string) });
  }) as RequestHandler,

  accept: (async (req, res) => {
    res.json({
      participant: await sessionsService.decideParticipant(requireUser(req).id, req.params['id'] as string, true),
    });
  }) as RequestHandler,

  reject: (async (req, res) => {
    res.json({
      participant: await sessionsService.decideParticipant(requireUser(req).id, req.params['id'] as string, false),
    });
  }) as RequestHandler,

  search: (async (req, res) => {
    res.json({ data: await sessionsService.search(req.query as unknown as SearchSessionsQuery) });
  }) as RequestHandler,

  getOne: (async (req, res) => {
    res.json({
      session: await sessionsService.getPublic(req.params['id'] as string, req.user?.id),
    });
  }) as RequestHandler,

  join: (async (req, res) => {
    res.status(201).json({
      participant: await sessionsService.join(requireUser(req).id, req.params['id'] as string),
    });
  }) as RequestHandler,

  leave: (async (req, res) => {
    await sessionsService.leave(requireUser(req).id, req.params['id'] as string);
    res.status(204).send();
  }) as RequestHandler,

  appointments: (async (req, res) => {
    res.json({ data: await sessionsService.appointments(requireUser(req).id) });
  }) as RequestHandler,

  attend: (async (req, res) => {
    const body = req.body as { token: string };
    res.json({
      participant: await sessionsService.attendWithToken(
        requireUser(req).id,
        req.params['id'] as string,
        body.token,
      ),
    });
  }) as RequestHandler,

  listAvailability: (async (req, res) => {
    res.json({ data: await availabilityService.list(requireUser(req).id) });
  }) as RequestHandler,

  createAvailability: (async (req, res) => {
    res.status(201).json({
      availability: await availabilityService.create(requireUser(req).id, req.body as AvailabilityInput),
    });
  }) as RequestHandler,

  updateAvailability: (async (req, res) => {
    res.json({
      availability: await availabilityService.update(
        requireUser(req).id,
        req.params['id'] as string,
        req.body as Partial<AvailabilityInput>,
      ),
    });
  }) as RequestHandler,

  generate: (async (req, res) => {
    const weeks = Number((req.body as { weeks?: number }).weeks ?? 8);
    res.status(201).json({
      data: await availabilityService.generate(requireUser(req).id, req.params['id'] as string, weeks),
    });
  }) as RequestHandler,
};
