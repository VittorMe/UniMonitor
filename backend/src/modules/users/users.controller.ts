import type { RequestHandler } from 'express';

import { requireUser } from '../../shared/http/require-user.js';
import { usersService } from './users.service.js';
import type { CreateUserInput, ListUsersQuery, UpdateUserInput } from './users.schemas.js';

const list: RequestHandler = async (req, res) => {
  const result = await usersService.list(req.query as unknown as ListUsersQuery);
  res.json(result);
};

const getById: RequestHandler = async (req, res) => {
  const user = await usersService.getById(req.params['id'] as string);
  res.json({ user });
};

const create: RequestHandler = async (req, res) => {
  const user = await usersService.create(req.body as CreateUserInput);
  res.status(201).json({ user });
};

const update: RequestHandler = async (req, res) => {
  const user = await usersService.update(
    req.params['id'] as string,
    req.body as UpdateUserInput,
    requireUser(req),
  );
  res.json({ user });
};

const remove: RequestHandler = async (req, res) => {
  await usersService.remove(req.params['id'] as string, requireUser(req));
  res.status(204).send();
};

export const usersController = { list, getById, create, update, remove };
