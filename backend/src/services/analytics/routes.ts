import { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../core/auth';
import { parse } from '../../core/validate';
import { memberHistory, memberRows, seriesTrends, tierTrends } from './service';

export const analyticsRouter = Router();

analyticsRouter.use('/analytics', requireAdmin);

const weeksQuery = z.object({ weeks: z.coerce.number().int().min(1).max(52).default(6) });

analyticsRouter.get('/analytics/members', async (_req, res) => {
  res.json(await memberRows());
});

analyticsRouter.get('/analytics/members/:id', async (req, res) => {
  const { weeks } = parse(weeksQuery, req.query);
  res.json(await memberHistory(String(req.params.id), weeks));
});

analyticsRouter.get('/analytics/tiers', async (req, res) => {
  res.json(await tierTrends(parse(weeksQuery, req.query).weeks));
});

analyticsRouter.get('/analytics/series', async (req, res) => {
  res.json(await seriesTrends(parse(weeksQuery, req.query).weeks));
});
