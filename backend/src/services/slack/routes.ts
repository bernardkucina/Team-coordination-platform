import express, { Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../core/auth';
import { config } from '../../core/config';
import { badRequest, unauthorized } from '../../core/errors';
import { today } from '../../core/clock';
import { parse } from '../../core/validate';
import { listMembers } from '../members';
import { syncIfStale } from '../meetings';
import { slackEnabled } from './client';
import { handleInteraction, verifySlackSignature } from './interactions';
import { scheduleMeetingMessages } from './schedule';
import { sendDailySummary, sendMonthlyReports } from './digests';

export const slackRouter = Router();

/** Buttons and forms in Slack messages. Public, but every request must carry Slack's signature. */
slackRouter.post('/slack/interactions', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  if (!config.slack.signingSecret) throw unauthorized('Slack is not set up.');
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
  const ok = verifySlackSignature(raw, req.header('x-slack-request-timestamp'), req.header('x-slack-signature'), config.slack.signingSecret);
  if (!ok) throw unauthorized('Bad Slack signature.');
  const payload = new URLSearchParams(raw).get('payload');
  if (!payload) throw badRequest('No payload.');
  const answer = await handleInteraction(JSON.parse(payload));
  if (answer) res.json(answer);
  else res.status(200).end();
});

/** The daily job (Vercel Cron, once a day): calendar sync, meeting messages, daily summary, monthly report on the 1st. */
slackRouter.get('/cron/daily', async (req, res) => {
  if (!config.cronSecret || req.header('authorization') !== `Bearer ${config.cronSecret}`) throw unauthorized('Not the cron.');
  await syncIfStale(8000);
  const result: Record<string, unknown> = { slack: slackEnabled() };
  if (slackEnabled()) {
    result.meetings = await scheduleMeetingMessages();
    result.daily = await sendDailySummary();
    if (today().endsWith('-01')) result.monthly = await sendMonthlyReports();
  }
  res.json(result);
});

/* ---------- admin: status and "run now" (for testing and the demo) ---------- */

slackRouter.get('/slack/status', requireAdmin, async (_req, res) => {
  const members = await listMembers();
  res.json({ configured: slackEnabled(), interactive: !!config.slack.signingSecret, linked: members.filter((m) => m.slackUserId).length, members: members.length });
});

slackRouter.post('/slack/run', requireAdmin, async (req, res) => {
  if (!slackEnabled()) throw badRequest('Slack is not connected. Set SLACK_BOT_TOKEN.');
  const { job } = parse(z.object({ job: z.enum(['meetings', 'daily', 'monthly']) }), req.body);
  if (job === 'meetings') res.json(await scheduleMeetingMessages());
  else if (job === 'daily') res.json(await sendDailySummary());
  else res.json(await sendMonthlyReports());
});
