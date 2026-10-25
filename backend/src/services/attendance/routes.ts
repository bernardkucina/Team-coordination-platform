import { Router } from 'express';
import { z } from 'zod';
import { me, requireAdmin } from '../../core/auth';
import { forbidden } from '../../core/errors';
import { id, parse } from '../../core/validate';
import { takeMakeup } from './makeup';
import { fillPresent, listRecords, markSelf, meetingDetail, recordMeeting, reportAttendance, unmarkSelf } from './service';

export const attendanceRouter = Router();

const status = z.enum(['present', 'remote', 'excused', 'missed']);

attendanceRouter.get('/meetings/:id', async (req, res) => {
  res.json(await meetingDetail(String(req.params.id)));
});

/** GET /api/attendance?memberId=: your own records, or anyone's for admins. */
attendanceRouter.get('/attendance', async (req, res) => {
  const user = me(req);
  const q = parse(z.object({ memberId: id.optional() }), req.query);
  const memberId = q.memberId ?? user.id;
  if (memberId !== user.id && !user.isAdmin) throw forbidden('You can only see your own attendance.');
  res.json(await listRecords({ memberId }));
});

const reason = z.string().trim().max(500).optional();

attendanceRouter.post('/meetings/:id/attendance/self', async (req, res) => {
  const body = parse(z.object({ status: z.enum(['present', 'remote', 'excused']), reason }), req.body);
  res.json(await markSelf(String(req.params.id), me(req), body.status, body.reason));
});

attendanceRouter.delete('/meetings/:id/attendance/self', async (req, res) => {
  await unmarkSelf(String(req.params.id), me(req));
  res.status(204).end();
});

attendanceRouter.post('/meetings/:id/attendance/report', async (req, res) => {
  const body = parse(z.object({ status: z.enum(['present', 'remote', 'absent']), reason }), req.body);
  res.json(await reportAttendance(String(req.params.id), me(req), body.status, body.reason));
});

const bulkSchema = z.object({
  records: z.array(z.object({ memberId: id, status })).max(200),
  recorded: z.boolean().optional(),
});

attendanceRouter.put('/meetings/:id/attendance', requireAdmin, async (req, res) => {
  res.json(await recordMeeting(String(req.params.id), parse(bulkSchema, req.body)));
});

attendanceRouter.post('/meetings/:id/attendance/fill-present', requireAdmin, async (req, res) => {
  res.json(await fillPresent(String(req.params.id)));
});

/** Pick a General task for a meeting you missed. */
attendanceRouter.post('/makeups/:meetingId/take', async (req, res) => {
  const body = parse(z.object({ taskId: z.number().int().positive() }), req.body);
  res.json(await takeMakeup(String(req.params.meetingId), me(req), body.taskId));
});
