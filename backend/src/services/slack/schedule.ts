/**
 * Meeting messages, scheduled in Slack with chat.scheduleMessage (Slack sends them on time, so this works on
 * serverless hosting without minute-level cron):
 *   reminder: 10 minutes before the meeting, with clock-in buttons;
 *   followup: when the meeting ends, "did you attend?", for members who did not clock in.
 * Messages are kept in step with attendance: saying "can't come" cancels both, clocking in cancels the follow-up.
 * Uses real time (not DEMO_NOW), because Slack sends at real times.
 */
import type { SlackMessageKind } from '@prisma/client';
import { db } from '../../core/db';
import { localParts } from '../../core/clock';
import { config } from '../../core/config';
import { getMeetingRow, getSeries, listMeetingRows } from '../meetings';
import { listRecords } from '../attendance';
import { SlackError, slack, slackEnabled } from './client';
import { followupMessage, reminderMessage } from './blocks';
import { slackTargetFor } from './users';

const REMINDER_BEFORE_MS = 10 * 60_000;
/** Schedule this far ahead. The daily cron runs once a day, so this covers a missed run too. */
const HORIZON_MS = 72 * 3600_000;
/** Slack refuses post times that are too close; leave a margin. */
const MIN_LEAD_MS = 60_000;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const whenText = (d: Date): string => {
  const { date, time } = localParts(d);
  const day = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAYS[day.getUTCDay()]} ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}, ${time}`;
};

const cancel = async (row: { id: number; channel: string; scheduledMessageId: string; postAt: Date }) => {
  if (row.postAt.getTime() > Date.now()) {
    await slack('chat.deleteScheduledMessage', { channel: row.channel, scheduled_message_id: row.scheduledMessageId }).catch((err) => {
      // Already sent or already gone: nothing to cancel.
      if (!(err instanceof SlackError && ['invalid_scheduled_message_id', 'channel_not_found'].includes(err.code))) throw err;
    });
  }
  await db.slackMessage.delete({ where: { id: row.id } });
};

/** Makes the scheduled messages for one member and meeting match what should happen. Returns messages scheduled. */
const syncOne = async (
  meeting: { id: string; seriesId: string; startsAt: Date; endsAt: Date },
  seriesName: string,
  memberId: string,
  status: string | undefined,
): Promise<number> => {
  const now = Date.now();
  // Anyone with a record (clocked in, can't come, answered) needs neither message.
  const want: Record<SlackMessageKind, Date | null> = {
    reminder: !status ? new Date(meeting.startsAt.getTime() - REMINDER_BEFORE_MS) : null,
    followup: !status ? meeting.endsAt : null,
  };
  const existing = await db.slackMessage.findMany({ where: { meetingId: meeting.id, memberId } });
  let scheduled = 0;

  for (const kind of ['reminder', 'followup'] as SlackMessageKind[]) {
    const at = want[kind];
    const row = existing.find((r) => r.kind === kind);
    const valid = at && at.getTime() > now + MIN_LEAD_MS && at.getTime() < now + 120 * 86_400_000;
    if (row && (!valid || row.postAt.getTime() !== at!.getTime())) await cancel(row);
    if (!valid || (row && row.postAt.getTime() === at!.getTime())) continue;

    const target = await slackTargetFor(memberId);
    if (!target) return scheduled;
    const message = kind === 'reminder'
      ? reminderMessage({ meetingId: meeting.id, series: seriesName, start: localParts(meeting.startsAt).time }, config.appUrl)
      : followupMessage({ meetingId: meeting.id, series: seriesName, when: whenText(meeting.startsAt) });
    const res = await slack<{ scheduled_message_id: string }>('chat.scheduleMessage', {
      channel: target.channel, post_at: Math.floor(at!.getTime() / 1000), text: message.text, blocks: message.blocks,
    });
    await db.slackMessage.create({
      data: { kind, meetingId: meeting.id, memberId, channel: target.channel, scheduledMessageId: res.scheduled_message_id, postAt: at! },
    });
    scheduled++;
  }
  return scheduled;
};

/** Schedules reminders and follow-ups for the meetings in the next 72 hours. Safe to run any number of times. */
export const scheduleMeetingMessages = async (): Promise<{ meetings: number; scheduled: number }> => {
  if (!slackEnabled()) return { meetings: 0, scheduled: 0 };
  const meetings = await listMeetingRows({ from: new Date(Date.now() - 3600_000), to: new Date(Date.now() + HORIZON_MS) });
  const records = await listRecords({ meetingIds: meetings.map((m) => m.id) });
  let scheduled = 0;
  for (const meeting of meetings) {
    const series = await getSeries(meeting.seriesId);
    for (const memberId of series.invited) {
      const status = records.find((r) => r.meetingId === meeting.id && r.memberId === memberId)?.status;
      try {
        scheduled += await syncOne(meeting, series.name, memberId, status);
      } catch (err) {
        if (err instanceof SlackError && err.code === 'ratelimited') return { meetings: meetings.length, scheduled };
        throw err;
      }
    }
  }
  return { meetings: meetings.length, scheduled };
};

/** After a member's own attendance changed. */
export const resyncMember = async (meetingId: string, memberId: string): Promise<void> => {
  if (!slackEnabled()) return;
  const meeting = await getMeetingRow(meetingId);
  const series = await getSeries(meeting.seriesId);
  const status = (await listRecords({ meetingIds: [meetingId], memberId }))[0]?.status;
  await syncOne(meeting, series.name, memberId, status);
};
