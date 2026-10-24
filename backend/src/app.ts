/**
 * The monolith: one Express app and one process. Every service is mounted under /api; services stay in
 * their own folders and talk to each other only through each other's index.ts.
 */
import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler, notFound } from './core/errors';
import { loadSession, requireAuth } from './core/auth';
import { membersRouter } from './services/members';
import { tasksRouter } from './services/tasks';
import { meetingsRouter } from './services/meetings';
import { attendanceRouter } from './services/attendance';
import { hoursRouter } from './services/hours';
import { analyticsRouter } from './services/analytics';
import { gatewayRouter } from './gateway/routes';

export const createApp = () => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const api = Router();
  api.use(loadSession);
  // Sign-in routes are public; everything mounted after requireAuth needs a session.
  api.use(membersRouter);
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

  app.use('/api', api);
  app.use(errorHandler);
  return app;
};
