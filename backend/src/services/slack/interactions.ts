/**
 * Buttons and forms in Slack messages. Slack posts them to /api/slack/interactions; every request is checked
 * against the signing secret before anything is changed.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SessionMember } from '../../core/auth';
import { HttpError } from '../../core/errors';
import { findMemberBySlackUserId } from '../members';
import { getMeetingRow, getSeries } from '../meetings';
import { markSelf, reportAttendance } from '../attendance';
import { respond, slack } from './client';
import { doneMessage, reasonModal } from './blocks';

const MAX_AGE_S = 5 * 60;

/** Slack's request signature: v0=HMAC-SHA256(secret, "v0:<timestamp>:<raw body>"), at most 5 minutes old. */
export const verifySlackSignature = (rawBody: string, timestamp: string | undefined, signature: string | undefined, secret: string, nowS = Date.now() / 1000): boolean => {
  if (!timestamp || !signature || Math.abs(nowS - Number(timestamp)) > MAX_AGE_S) return false;
  const expected = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
};

interface BlockActions {
  type: 'block_actions';
  user: { id: string };
  trigger_id: string;
  response_url: string;
  actions: { action_id: string; value?: string }[];
}

interface ViewSubmission {
  type: 'view_submission';
  user: { id: string };
  view: { callback_id: string; private_metadata: string; state: { values: Record<string, Record<string, { value?: string | null }>> } };
}

type Payload = BlockActions | ViewSubmission | { type: string };

const asSession = async (slackUserId: string): Promise<SessionMember | null> => {
  const m = await findMemberBySlackUserId(slackUserId);
  return m ? { id: m.id, name: m.name, isAdmin: m.isAdmin } : null;
};

const reason = (err: unknown) => (err instanceof HttpError ? err.message : 'Something went wrong. Try again in Hub Pulse.');

/** Returns the JSON body to answer Slack with (null = empty 200). */
export const handleInteraction = async (payload: Payload): Promise<unknown> => {
  if (payload.type === 'block_actions') {
    const p = payload as BlockActions;
    const action = p.actions[0];
    if (!action?.value || action.action_id === 'open_app') return null;
    const member = await asSession(p.user.id);
    if (!member) {
      await respond(p.response_url, doneMessage('Your Slack account is not linked to a Hub Pulse member. Ask the super admin to add your Slack email.'));
      return null;
    }
    const meetingId = action.value;
    const series = (await getSeries((await getMeetingRow(meetingId)).seriesId)).name;
    try {
      switch (action.action_id) {
        case 'clockin_present':
        case 'clockin_remote': {
          const mode = action.action_id === 'clockin_present' ? 'present' : 'remote';
          await markSelf(meetingId, member, mode);
          await respond(p.response_url, doneMessage(`:white_check_mark: Clocked in to *${series}* ${mode === 'present' ? 'in person' : 'online'}.`));
          break;
        }
        case 'attend_present':
        case 'attend_remote': {
          const answer = action.action_id === 'attend_present' ? 'present' : 'remote';
          await reportAttendance(meetingId, member, answer);
          await respond(p.response_url, doneMessage(`:white_check_mark: Thanks! *${series}*: you attended ${answer === 'present' ? 'in person' : 'online'}.`));
          break;
        }
        case 'attend_absent':
          await slack('views.open', { trigger_id: p.trigger_id, view: reasonModal({ meetingId, responseUrl: p.response_url }, series) });
          break;
      }
    } catch (err) {
      await respond(p.response_url, doneMessage(`:warning: ${reason(err)}`));
    }
    return null;
  }

  if (payload.type === 'view_submission' && (payload as ViewSubmission).view.callback_id === 'absent_reason') {
    const p = payload as ViewSubmission;
    const meta = JSON.parse(p.view.private_metadata) as { meetingId: string; responseUrl: string };
    const why = p.view.state.values.reason?.value?.value?.trim() ?? '';
    const member = await asSession(p.user.id);
    if (!member) return { response_action: 'errors', errors: { reason: 'Your Slack account is not linked to a Hub Pulse member.' } };
    try {
      await reportAttendance(meta.meetingId, member, 'absent', why);
    } catch (err) {
      return { response_action: 'errors', errors: { reason: reason(err) } };
    }
    const series = (await getSeries((await getMeetingRow(meta.meetingId)).seriesId)).name;
    await respond(meta.responseUrl, doneMessage(`:memo: Thanks, the admins will see why you missed *${series}*: "${why}"`)).catch(() => undefined);
    return null;
  }
  return null;
};
