import { Router } from 'express';
import { z } from 'zod';
import { isoDate, parse } from '../../core/validate';
import { addDays, zonedToUtc } from '../../core/clock';
import { listMeetingRows, listSeries, toMeeting } from './service';

export const meetingsRouter = Router();

meetingsRouter.get('/series', async (_req, res) => {
  res.json(await listSeries());
});

/** GET /api/meetings?from=YYYY-MM-DD&to=YYYY-MM-DD (local dates, both inclusive). */
meetingsRouter.get('/meetings', async (req, res) => {
  const q = parse(z.object({ from: isoDate.optional(), to: isoDate.optional() }), req.query);
  const rows = await listMeetingRows({
    from: q.from ? zonedToUtc(q.from) : undefined,
    to: q.to ? zonedToUtc(addDays(q.to, 1)) : undefined,
  });
  res.json(rows.map(toMeeting));
});
