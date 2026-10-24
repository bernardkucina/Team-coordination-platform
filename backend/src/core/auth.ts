/**
 * Sessions: every way of signing in (email demo login, super admin password, Google later) ends in the same
 * httpOnly session cookie, so no service cares how someone signed in.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
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
      /** The super admin is signed in. It is not a member and can only use /api/access. */
      superAdmin?: boolean;
    }
  }
}

export type SessionOwner = { memberId: string } | { superAdmin: true };

export const startSession = async (res: Response, owner: SessionOwner): Promise<void> => {
  const id = randomBytes(32).toString('base64url');
  const maxAge = config.sessionDays * 86_400_000;
  await db.session.create({
    data: { id, expiresAt: new Date(Date.now() + maxAge), ...('memberId' in owner ? { memberId: owner.memberId } : { superAdmin: true }) },
  });
  res.cookie(SESSION_COOKIE, id, { httpOnly: true, sameSite: 'lax', secure: config.cookieSecure, maxAge, path: '/' });
};

export const endSession = async (req: Request, res: Response): Promise<void> => {
  const id = req.cookies?.[SESSION_COOKIE];
  if (id) await db.session.deleteMany({ where: { id } });
  res.clearCookie(SESSION_COOKIE, { path: '/' });
};

/** Loads the signed-in member or super admin (if any) onto the request. */
export const loadSession: RequestHandler = async (req, _res, next) => {
  const id = req.cookies?.[SESSION_COOKIE];
  if (typeof id === 'string' && id) {
    const session = await db.session.findUnique({
      where: { id },
      include: { member: { select: { id: true, name: true, isAdmin: true, active: true } } },
    });
    if (session && session.expiresAt > new Date()) {
      if (session.superAdmin) {
        req.superAdmin = true;
      } else if (session.member?.active) {
        const { id: memberId, name, isAdmin } = session.member;
        req.member = { id: memberId, name, isAdmin };
      }
    }
  }
  next();
};

/** Members only. The super admin gets a 403: it manages access and nothing else. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (req.superAdmin) throw forbidden('The super admin only manages access.');
  if (!req.member) throw unauthorized();
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.superAdmin) throw forbidden('The super admin only manages access.');
  if (!req.member) throw unauthorized();
  if (!req.member.isAdmin) throw forbidden();
  next();
};

export const requireSuperAdmin: RequestHandler = (req, _res, next) => {
  if (req.superAdmin) return next();
  if (!req.member) throw unauthorized();
  throw forbidden('Only the super admin can manage access.');
};

/** The signed-in member, for handlers behind requireAuth. */
export const me = (req: Request): SessionMember => {
  if (!req.member) throw unauthorized();
  return req.member;
};

/** Constant-time password check (hashing first makes the lengths equal). */
export const passwordMatches = (given: string, expected: string): boolean =>
  timingSafeEqual(createHash('sha256').update(given).digest(), createHash('sha256').update(expected).digest());

/**
 * Slows down password guessing: at most MAX_FAILURES failed sign-ins per client per window.
 * In memory, which is enough for one process.
 */
const MAX_FAILURES = 10;
const WINDOW_MS = 15 * 60_000;
const failures = new Map<string, { count: number; since: number }>();

export const tooManyFailures = (client: string): boolean => {
  const f = failures.get(client);
  if (!f || Date.now() - f.since > WINDOW_MS) return false;
  return f.count >= MAX_FAILURES;
};

export const recordFailure = (client: string): void => {
  const f = failures.get(client);
  if (!f || Date.now() - f.since > WINDOW_MS) failures.set(client, { count: 1, since: Date.now() });
  else f.count++;
};
