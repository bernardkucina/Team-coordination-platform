import { Router } from 'express';
import { z } from 'zod';
import type { LoginResponse } from '@hub-pulse/shared';
import { config } from '../../core/config';
import { endSession, me, requireAdmin, startSession } from '../../core/auth';
import { badRequest, notFound, unauthorized } from '../../core/errors';
import { parse } from '../../core/validate';
import { findMemberByEmail, getMember, updateMember } from './service';
import { toMember } from './mapping';

export const membersRouter = Router();

/* ---------- auth: sandbox sign-in with a roster email (DEMO_MODE only) ---------- */

membersRouter.post('/auth/demo-login', async (req, res) => {
  if (!config.demoMode) throw notFound('Demo login');
  const { email } = parse(z.object({ email: z.string().trim().min(3).max(200) }), req.body);
  const member = await findMemberByEmail(email);
  // One message for unknown and inactive, so the form does not reveal who is on the roster.
  if (!member || !member.active) throw unauthorized('No active member with that email.');
  await startSession(res, member.id);
  const body: LoginResponse = { memberId: member.id, role: member.isAdmin ? 'admin' : 'member' };
  res.json(body);
});

membersRouter.post('/auth/logout', async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

/* ---------- admin: tier, role, active ---------- */

const updateSchema = z
  .object({
    tier: z.enum(['ShapersGO', 'Shapers Impact', 'Shapers Core']).optional(),
    isAdmin: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .strict();

membersRouter.patch('/members/:id', requireAdmin, async (req, res) => {
  const patch = parse(updateSchema, req.body);
  const id = String(req.params.id);
  if (id === me(req).id && (patch.isAdmin === false || patch.active === false)) {
    throw badRequest('You cannot remove your own admin role or deactivate yourself.');
  }
  await getMember(id);
  res.json(toMember(await updateMember(id, patch)));
});
