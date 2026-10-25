import { Router, type Request } from 'express';
import { z } from 'zod';
import { me } from '../../core/auth';
import { clientIp } from '../../core/network';
import { hubNetwork } from '../members';
import { badRequest, forbidden } from '../../core/errors';
import { clockTime, id, isoDate, parse } from '../../core/validate';
import { createEntry, deleteEntry, hoursSummary, listEntries, updateEntry } from './service';
import { getTimers, setMeetingMode, startMeeting, startWork, stopMeeting, stopWork } from './timers';

export const hoursRouter = Router();

const entryId = (raw: unknown): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw badRequest('Entry id must be a positive number.');
  return n;
};

/* ---------- time entries ---------- */

/** GET /api/time-entries?memberId=&from=&to=: your own, or anyone's for admins. */
hoursRouter.get('/time-entries', async (req, res) => {
  const user = me(req);
  const q = parse(z.object({ memberId: id.optional(), all: z.enum(['true', 'false']).optional(), from: isoDate.optional(), to: isoDate.optional() }), req.query);
  if ((q.all === 'true' || (q.memberId && q.memberId !== user.id)) && !user.isAdmin) throw forbidden('You can only see your own hours.');
  const memberId = q.all === 'true' ? undefined : (q.memberId ?? user.id);
  res.json(await listEntries({ memberId, from: q.from, to: q.to }));
});

const location = z.enum(['hub', 'remote']);

const createSchema = z.object({
  projectId: id,
  location: location.optional(),
  date: isoDate,
  start: clockTime,
  end: clockTime,
  note: z.string().max(500).optional(),
  memberId: id.optional(),
});

/**
 * "In the hub" only from the Impact Hub wifi, for your own time. Admins correcting someone else's hours are not
 * checked. Off while no hub address is saved.
 */
const assertHubAllowed = async (req: Request, where: 'hub' | 'remote' | undefined): Promise<void> => {
  if (where !== 'hub') return;
  const network = await hubNetwork(clientIp(req));
  if (network.checked && !network.atHub) throw forbidden('"In the hub" is only available on the Impact Hub wifi. Log it as remote.');
};

hoursRouter.post('/time-entries', async (req, res) => {
  const body = parse(createSchema, req.body);
  const user = me(req);
  if (!body.memberId || body.memberId === user.id) await assertHubAllowed(req, body.location);
  res.status(201).json(await createEntry(body, user));
});

const updateSchema = z
  .object({ projectId: id, date: isoDate, start: clockTime, end: clockTime, note: z.string().max(500), location })
  .partial()
  .strict();

hoursRouter.patch('/time-entries/:id', async (req, res) => {
  const patch = parse(updateSchema, req.body);
  const user = me(req);
  if (!user.isAdmin) await assertHubAllowed(req, patch.location);
  res.json(await updateEntry(entryId(req.params.id), patch, user));
});

hoursRouter.delete('/time-entries/:id', async (req, res) => {
  await deleteEntry(entryId(req.params.id), me(req));
  res.status(204).end();
});

/** GET /api/hours/summary?memberId=: this week against the tier's commitment. */
hoursRouter.get('/hours/summary', async (req, res) => {
  const user = me(req);
  const q = parse(z.object({ memberId: id.optional() }), req.query);
  if (q.memberId && q.memberId !== user.id && !user.isAdmin) throw forbidden('You can only see your own hours.');
  res.json(await hoursSummary(q.memberId ?? user.id));
});

/* ---------- timers ---------- */

const mode = z.enum(['present', 'remote']);
const stopSchema = z.object({ projectId: id.optional() });

hoursRouter.get('/timers', async (req, res) => {
  res.json(await getTimers(me(req).id));
});

hoursRouter.post('/timers/work/start', async (req, res) => {
  const { projectId, location: where } = parse(z.object({ projectId: id, location: location.optional() }), req.body);
  await assertHubAllowed(req, where);
  res.json(await startWork(me(req), projectId, where));
});

hoursRouter.post('/timers/work/stop', async (req, res) => {
  res.json(await stopWork(me(req), parse(stopSchema, req.body ?? {}).projectId));
});

hoursRouter.post('/timers/meeting/start', async (req, res) => {
  const body = parse(z.object({ meetingId: id, mode }), req.body);
  res.json(await startMeeting(me(req), body.meetingId, body.mode));
});

hoursRouter.patch('/timers/meeting/mode', async (req, res) => {
  res.json(await setMeetingMode(me(req), parse(z.object({ mode }), req.body).mode));
});

hoursRouter.post('/timers/meeting/stop', async (req, res) => {
  res.json(await stopMeeting(me(req), parse(stopSchema, req.body ?? {}).projectId));
});
