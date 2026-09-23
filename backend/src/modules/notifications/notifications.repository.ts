import type { NotificationType } from '@prisma/client';

import { prisma } from '../../infra/database/prisma.js';

export const notificationsRepository = {
  create: (data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
  }) => prisma.notification.create({ data }),

  listForUser: (userId: string, take = 30) =>
    prisma.notification.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        title: true,
        message: true,
        link: true,
        readAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take,
    }),

  markRead: (id: string, userId: string) =>
    prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    }),

  markAllRead: (userId: string) =>
    prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    }),

  countUnread: (userId: string) =>
    prisma.notification.count({ where: { userId, readAt: null } }),
};
