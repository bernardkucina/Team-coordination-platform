/**
 * Sessions: every way of signing in (sandbox picker now, Google later) ends in the same
 * httpOnly session cookie, so no service cares how someone signed in.
 */
import { randomBytes } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { db } from './db';
import { config } from './config';
import { forbidden, unauthorized } from './errors';

export const SESSION_COOKIE = 'hp_session';

export interface SessionMember {
  id: string;
  name: string;
  isAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      member?: SessionMember;
    }
  }
}

export const startSession = async (res: Response, memberId: string): Promise<void> => {
  const id = randomBytes(32).toString('base64url');
  const maxAge = config.sessionDays * 86_400_000;
  await db.session.create({ data: { id, memberId, expiresAt: new Date(Date.now() + maxAge) } });
  res.cookie(SESSION_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge, path: '/' });
};

export const endSession = async (req: Request, res: Response): Promise<void> => {
  const id = req.cookies?.[SESSION_COOKIE];
  if (id) await db.session.deleteMany({ where: { id } });
  res.clearCookie(SESSION_COOKIE, { path: '/' });
};

/** Loads the signed-in member (if any) onto req.member. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const id = req.cookies?.[SESSION_COOKIE];
  if (typeof id === 'string' && id) {
    const session = await db.session.findUnique({
      where: { id },
      include: { member: { select: { id: true, name: true, isAdmin: true, active: true } } },
    });
    if (session && session.expiresAt > new Date() && session.member.active) {
      const { id: memberId, name, isAdmin } = session.member;
      req.member = { id: memberId, name, isAdmin };
    }
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.member) throw unauthorized();
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.member) throw unauthorized();
  if (!req.member.isAdmin) throw forbidden();
  next();
};

/** The signed-in member, for handlers behind requireAuth. */
export const me = (req: Request): SessionMember => {
  if (!req.member) throw unauthorized();
  return req.member;
};
