import type { Request, RequestHandler, Response } from 'express';

import { env } from '../../config/env.js';
import { UnauthorizedError } from '../../shared/errors/app-error.js';
import { requireUser } from '../../shared/http/require-user.js';
import { clearAuthCookies, setAccessCookie, setAuthCookies } from './auth.cookies.js';
import { authService, type AuthResult, type SessionContext } from './auth.service.js';
import { signAccessToken } from './token.service.js';
import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from './auth.schemas.js';

const sessionContext = (req: Request): SessionContext => ({
  ...(req.headers['user-agent'] ? { userAgent: req.headers['user-agent'] } : {}),
  ...(req.ip ? { ipAddress: req.ip } : {}),
});

const readRefreshCookie = (req: Request): string | undefined =>
  req.cookies?.[env.COOKIE_REFRESH_NAME] as string | undefined;

const respondWithSession = (res: Response, result: AuthResult): void => {
  setAuthCookies(res, result);
  res.json({
    user: result.user,
    profile: result.profile,
    period: result.period,
  });
};

const login: RequestHandler = async (req, res) => {
  const result = await authService.login(req.body as LoginInput, sessionContext(req));
  respondWithSession(res, result);
};

const register: RequestHandler = async (req, res) => {
  const result = await authService.register(req.body as RegisterInput, sessionContext(req));
  respondWithSession(res, result);
};

const refresh: RequestHandler = async (req, res) => {
  const token = readRefreshCookie(req);

  if (!token) {
    throw new UnauthorizedError('Sessao ausente. Faca login novamente');
  }

  const result = await authService.refresh(token, sessionContext(req));
  respondWithSession(res, result);
};

const logout: RequestHandler = async (req, res) => {
  await authService.logout(readRefreshCookie(req));
  clearAuthCookies(res);
  res.status(204).send();
};

const logoutAll: RequestHandler = async (req, res) => {
  await authService.logoutAll(requireUser(req).id);
  clearAuthCookies(res);
  res.status(204).send();
};

const me: RequestHandler = async (req, res) => {
  const session = await authService.getSession(requireUser(req).id);
  if (req.user && req.user.role !== session.user.role) {
    setAccessCookie(res, signAccessToken({ sub: session.user.id, email: session.user.email, role: session.user.role }));
  }
  res.json(session);
};

const updateProfile: RequestHandler = async (req, res) => {
  const user = await authService.updateProfile(requireUser(req).id, req.body as UpdateProfileInput);
  setAccessCookie(res, signAccessToken({ sub: user.id, email: user.email, role: user.role }));
  res.json(await authService.getSession(user.id));
};

const changePassword: RequestHandler = async (req, res) => {
  await authService.changePassword(requireUser(req).id, req.body as ChangePasswordInput);
  clearAuthCookies(res);
  res.status(204).send();
};

export const authController = { login, register, refresh, logout, logoutAll, me, updateProfile, changePassword };
