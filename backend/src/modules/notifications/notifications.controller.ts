import type { NotificationType } from '@prisma/client';
import type { RequestHandler } from 'express';
import { z } from 'zod';

import { requireUser } from '../../shared/http/require-user.js';
import { idParamSchema } from '../../shared/http/common-schemas.js';
import { notificationsRepository } from './notifications.repository.js';

export const notifyUser = async (input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}): Promise<void> => {
  await notificationsRepository.create(input);
};

const list: RequestHandler = async (req, res) => {
  const user = requireUser(req);
  const [items, unread] = await Promise.all([
    notificationsRepository.listForUser(user.id),
    notificationsRepository.countUnread(user.id),
  ]);
  res.json({ data: items, unread });
};

const markRead: RequestHandler = async (req, res) => {
  await notificationsRepository.markRead(req.params['id'] as string, requireUser(req).id);
  res.status(204).send();
};

const markAllRead: RequestHandler = async (req, res) => {
  await notificationsRepository.markAllRead(requireUser(req).id);
  res.status(204).send();
};

export const notificationsController = { list, markRead, markAllRead };
export const notificationIdParams = idParamSchema;
export const emptyBody = z.object({}).optional();
