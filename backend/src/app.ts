/**
 * The monolith: one Express app and one process. Every service is mounted under /api; services stay in
 * their own folders and talk to each other only through each other's index.ts. In production the same
 * process also serves the built frontend (see server.ts).
 */
import express, { Router, type RequestHandler } from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler, notFound } from './core/errors';
import { loadSession, requireAuth } from './core/auth';
import { membersRouter } from './services/members';
import { accessRouter } from './services/access';
import { tasksRouter } from './services/tasks';
import { meetingsRouter } from './services/meetings';
import { attendanceRouter } from './services/attendance';
import { hoursRouter } from './services/hours';
import { analyticsRouter } from './services/analytics';
import { registerSlackListeners, slackRouter } from './services/slack';
import { gatewayRouter } from './gateway/routes';
import { seedTeambuildings } from './seed/teambuildings';
import { seedDemoTasks } from './seed/demo-tasks';
import { seedGeneralTasks } from './seed/general-tasks';
import { seedGeneralHistory } from './seed/general-history';

/**
 * Made-up sandbox data that is not in /material (teambuildings, open tasks for this week) is written to the database once per process,
 * so a database seeded before it existed gets it without a re-seed. Idempotent; never blocks the app on failure.
 */
let demoData: Promise<void> | null = null;
const ensureDemoData = () =>
  (demoData ??= (async () => {
    try {
      const tb = await seedTeambuildings();
      if (tb.records) console.log(`Demo data: added ${tb.records} teambuilding attendance records`);
      const tasks = await seedDemoTasks();
      if (tasks) console.log(`Demo data: added ${tasks} open tasks for this week`);
      const general = await seedGeneralTasks();
      if (general.tasks || general.duties) console.log(`Demo data: added ${general.tasks} General tasks, ${general.duties} make-up duties`);
      const history = await seedGeneralHistory();
      if (history) console.log(`Demo data: added ${history} finished General tasks (history)`);
    } catch (err) {
      console.warn('Demo data: could not add it', err);
    }
  })());

/** @param frontend Handles every non-API request (the Next.js app) when the frontend is served from here. */
export const createApp = (frontend?: RequestHandler) => {
  registerSlackListeners();
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const api = Router();
  api.use(async (_req, _res, next) => {
    await ensureDemoData();
    next();
  });
  api.use(express.json({ limit: '1mb' }));
  api.use(cookieParser());
  api.use(loadSession);
  // Sign-in and the super admin's access routes check their own permissions.
  api.use(membersRouter);
  api.use(accessRouter);
  // Slack button clicks (signed by Slack), the daily cron (CRON_SECRET) and admin Slack tools (requireAdmin).
  api.use(slackRouter);
  // Everything after this needs a signed-in member.
  api.use(requireAuth);
  api.use(gatewayRouter);
  api.use(tasksRouter);
  api.use(meetingsRouter);
  api.use(attendanceRouter);
  api.use(hoursRouter);
  api.use(analyticsRouter);
  api.use(() => {
    throw notFound('Route');
  });

  app.use('/api', api, errorHandler);
  if (frontend) app.use(frontend);
  return app;
};
