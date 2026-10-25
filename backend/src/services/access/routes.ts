/**
 * access service: the super admin decides who can sign in and who is an admin. It sees names, emails, tiers
 * and roles, and nothing about tasks, hours or meetings.
 */
import { Router } from 'express';
import { z } from 'zod';
import type { Member as DbMember } from '@prisma/client';
import type { AccessMember } from '@hub-pulse/shared';
import { requireSuperAdmin } from '../../core/auth';
import { parse } from '../../core/validate';
import { createMember, listMembers, setAccess, setSlackEmail, tierFromName, tierName } from '../members';
import { addToHubWideSeries } from '../meetings';

export const accessRouter = Router();

accessRouter.use('/access', requireSuperAdmin);

const toAccess = (m: DbMember): AccessMember => ({
  id: m.id, name: m.name, email: m.email, tier: tierName(m.tier), role: m.isAdmin ? 'admin' : 'member', active: m.active,
  slackEmail: m.slackEmail, slackLinked: !!m.slackUserId,
});

const tier = z.enum(['ShapersGO', 'Shapers Impact', 'Shapers Core']);
const role = z.enum(['member', 'admin']);

accessRouter.get('/access/members', async (_req, res) => {
  res.json((await listMembers({ includeInactive: true })).map(toAccess));
});

accessRouter.post('/access/members', async (req, res) => {
  const body = parse(
    z.object({ name: z.string().trim().min(1).max(120), email: z.email().max(200), tier, role: role.optional() }).strict(),
    req.body,
  );
  const member = await createMember({ name: body.name, email: body.email, tier: tierFromName(body.tier), isAdmin: body.role === 'admin' });
  // Everyone belongs to the hub-wide meeting series (Community), like the roster.
  await addToHubWideSeries(member.id);
  res.status(201).json(toAccess(member));
});

accessRouter.patch('/access/members/:id', async (req, res) => {
  const body = parse(
    z.object({ role: role.optional(), active: z.boolean().optional(), slackEmail: z.union([z.email(), z.literal('')]).optional() }).strict(),
    req.body,
  );
  const id = String(req.params.id);
  let member = await setAccess(id, {
    ...(body.role && { isAdmin: body.role === 'admin' }),
    ...(body.active !== undefined && { active: body.active }),
  });
  if (body.slackEmail !== undefined) member = await setSlackEmail(id, body.slackEmail || null);
  res.json(toAccess(member));
});
