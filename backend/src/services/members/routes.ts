import { Router } from 'express';
import { z } from 'zod';
import { AREA_IDS, type AreaId, type LoginResponse, type MemberAreasResponse, type SessionInfo } from '@hub-pulse/shared';
import { config } from '../../core/config';
import {
  endSession, me, passwordMatches, recordFailure, requireAdmin, startSession, tooManyFailures,
} from '../../core/auth';
import { HttpError, unauthorized } from '../../core/errors';
import { parse } from '../../core/validate';
import { findMemberByEmail, getMember, setMemberArea, updateMember } from './service';
import { toMember } from './mapping';

export const membersRouter = Router();

/* ---------- auth ---------- */

const NO_MEMBER = 'No active member with that email.';

/**
 * One sign-in form for everyone. The super admin's email asks for its password; roster members sign in with
 * their email only, and only while DEMO_MODE is on (Google sign-in replaces that for real use).
 */
membersRouter.post('/auth/login', async (req, res) => {
  const { email, password } = parse(
    z.object({ email: z.string().trim().toLowerCase().min(3).max(200), password: z.string().max(200).optional() }),
    req.body,
  );
  const client = req.ip ?? 'unknown';
  if (tooManyFailures(client)) throw new HttpError(429, 'Too many failed sign-ins. Try again in 15 minutes.');

  if (email === config.superAdmin.email && config.superAdmin.password) {
    if (!password) throw new HttpError(401, 'Enter the super admin password.', { needsPassword: true });
    if (!passwordMatches(password, config.superAdmin.password)) {
      recordFailure(client);
      throw new HttpError(401, 'Wrong password.', { needsPassword: true });
    }
    await startSession(res, { superAdmin: true });
    const body: LoginResponse = { kind: 'superadmin', name: config.superAdmin.name };
    res.json(body);
    return;
  }

  if (!config.demoMode) throw unauthorized('Email sign-in is turned off. Sign in with Google.');
  const member = await findMemberByEmail(email);
  // One message for unknown and inactive, so the form does not reveal who is on the roster.
  if (!member || !member.active) {
    recordFailure(client);
    throw unauthorized(NO_MEMBER);
  }
  await startSession(res, { memberId: member.id });
  const body: LoginResponse = { kind: 'member', memberId: member.id, role: member.isAdmin ? 'admin' : 'member' };
  res.json(body);
});

/** Who is signed in: a member or the super admin. 401 when nobody is. */
membersRouter.get('/auth/session', (req, res) => {
  let body: SessionInfo;
  if (req.superAdmin) body = { kind: 'superadmin', name: config.superAdmin.name };
  else if (req.member) body = { kind: 'member', memberId: req.member.id, role: req.member.isAdmin ? 'admin' : 'member' };
  else throw unauthorized();
  res.json(body);
});

membersRouter.post('/auth/logout', async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

/* ---------- admin: tier (roles and access belong to the super admin, see the access service) ---------- */

const updateSchema = z.object({ tier: z.enum(['ShapersGO', 'Shapers Impact', 'Shapers Core']).optional() }).strict();

membersRouter.patch('/members/:id', requireAdmin, async (req, res) => {
  const patch = parse(updateSchema, req.body);
  const id = String(req.params.id);
  await getMember(id);
  res.json(toMember(await updateMember(id, patch)));
});

/* ---------- areas: each member joins or leaves for themselves ---------- */

const areaParam = z.object({ areaId: z.enum(AREA_IDS as [AreaId, ...AreaId[]]) });

membersRouter.post('/members/me/areas/:areaId', async (req, res) => {
  const { areaId } = parse(areaParam, req.params);
  const body: MemberAreasResponse = { areas: await setMemberArea(me(req).id, areaId, true) };
  res.json(body);
});

membersRouter.delete('/members/me/areas/:areaId', async (req, res) => {
  const { areaId } = parse(areaParam, req.params);
  const body: MemberAreasResponse = { areas: await setMemberArea(me(req).id, areaId, false) };
  res.json(body);
});
