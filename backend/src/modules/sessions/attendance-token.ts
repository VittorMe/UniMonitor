import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors/app-error.js';

const WINDOW_MS = 5 * 60 * 1000;

const windowIndex = (date = new Date()) => Math.floor(date.getTime() / WINDOW_MS);

const tokenFor = (sessionId: string, index: number) =>
  createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${sessionId}:${index}`).digest('base64url');

export const issueAttendanceToken = (sessionId: string): string => tokenFor(sessionId, windowIndex());

export const verifyAttendanceToken = (sessionId: string, token: string): void => {
  const current = windowIndex();
  const candidates = [tokenFor(sessionId, current), tokenFor(sessionId, current - 1)];

  const presented = Buffer.from(token);
  const ok = candidates.some((candidate) => {
    const stored = Buffer.from(candidate);
    return stored.length === presented.length && timingSafeEqual(stored, presented);
  });

  if (!ok) {
    throw new UnauthorizedError('QR Code invalido ou expirado');
  }
};
