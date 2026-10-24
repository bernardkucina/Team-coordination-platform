import type { Meeting as DbMeeting } from '@prisma/client';
import type { Meeting, MeetingSeries } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { localParts } from '../../core/clock';
import { notFound } from '../../core/errors';
import { slugify } from '../tasks';
import { meetingIdOf, seriesNameOf, type CalendarEvent } from './ics';

export const toMeeting = (m: DbMeeting): Meeting => {
  const start = localParts(m.startsAt);
  return { id: m.id, seriesId: m.seriesId, date: start.date, start: start.time, end: localParts(m.endsAt).time, recorded: m.recorded };
};

export const listSeries = async (): Promise<MeetingSeries[]> => {
  const series = await db.meetingSeries.findMany({
    include: { members: { where: { member: { active: true } }, select: { memberId: true } } },
    orderBy: { name: 'asc' },
  });
  return series.map((s) => ({ id: s.id, name: s.name, projectId: s.projectId, invited: s.members.map((m) => m.memberId) }));
};

export const getSeries = async (id: string): Promise<MeetingSeries> => {
  const series = (await listSeries()).find((s) => s.id === id);
  if (!series) throw notFound('Meeting series');
  return series;
};

/** Meetings starting in [from, to), oldest first. */
export const listMeetingRows = (range: { from?: Date; to?: Date } = {}): Promise<DbMeeting[]> =>
  db.meeting.findMany({
    where: { startsAt: { ...(range.from && { gte: range.from }), ...(range.to && { lt: range.to }) } },
    orderBy: { startsAt: 'asc' },
  });

export const getMeetingRow = async (id: string): Promise<DbMeeting> => {
  const meeting = await db.meeting.findUnique({ where: { id } });
  if (!meeting) throw notFound('Meeting');
  return meeting;
};

/** Whether a member is invited to the series of a meeting. */
export const isInvited = async (meeting: DbMeeting, memberId: string): Promise<boolean> =>
  (await db.seriesMember.count({ where: { seriesId: meeting.seriesId, memberId } })) > 0;

export const setRecorded = (id: string, recorded: boolean) => db.meeting.update({ where: { id }, data: { recorded } });

/**
 * Copies calendar events into the database, keyed by event UID. Only the platform's own copy is written;
 * the calendar itself is never changed. Re-running it updates times and titles and keeps attendance.
 */
export const importCalendarEvents = async (events: CalendarEvent[]): Promise<{ series: number; meetings: number; skipped: number }> => {
  const seriesIds = new Set<string>();
  let meetings = 0;
  let skipped = 0;
  for (const event of events) {
    const seriesName = seriesNameOf(event);
    if (!seriesName) {
      skipped++;
      continue;
    }
    const seriesId = slugify(seriesName);
    if (!seriesIds.has(seriesId)) {
      await db.meetingSeries.upsert({ where: { id: seriesId }, create: { id: seriesId, name: seriesName }, update: { name: seriesName } });
      seriesIds.add(seriesId);
    }
    const data = { seriesId, title: event.summary, location: event.location, startsAt: event.start, endsAt: event.end };
    await db.meeting.upsert({ where: { uid: event.uid }, create: { id: meetingIdOf(event.uid), uid: event.uid, ...data }, update: data });
    meetings++;
  }
  return { series: seriesIds.size, meetings, skipped };
};
