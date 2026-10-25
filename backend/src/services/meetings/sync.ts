/**
 * Calendar sync: reads the calendar's public iCal feed and updates our copy of the meetings. Read only: nothing is
 * ever written to the calendar. Runs when an admin presses "Sync now", and on load when the last sync is stale.
 */
import type { CalendarSyncStatus } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { config } from '../../core/config';
import { now } from '../../core/clock';
import { emit } from '../../core/events';
import { listMembers } from '../members';
import { slugify } from '../tasks';
import { memberEmailsOf, parseIcs, seriesNameOf } from './ics';
import { importCalendarEvents } from './service';

const SYNC_ID = 'calendar';
const FETCH_TIMEOUT_MS = 10_000;

export const calendarStatus = async (): Promise<CalendarSyncStatus> => {
  const row = await db.calendarSync.findUnique({ where: { id: SYNC_ID } });
  return {
    configured: !!config.calendarIcsUrl,
    syncedAt: row?.syncedAt?.toISOString() ?? null,
    result: row?.result ?? null,
    error: row?.error ?? null,
  };
};

let running: Promise<CalendarSyncStatus> | null = null;

/** Fetches the feed and imports it. Concurrent calls share one run. */
export const syncCalendar = (): Promise<CalendarSyncStatus> => {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
};

const runSync = async (): Promise<CalendarSyncStatus> => {
  if (!config.calendarIcsUrl) return calendarStatus();
  try {
    const res = await fetch(config.calendarIcsUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`The calendar answered ${res.status}.`);
    const events = parseIcs(await res.text());
    const imported = await importCalendarEvents(events);

    // Who is invited: the "Members:" emails in each event's description. Only adds people; nobody is removed.
    const idByEmail = new Map((await listMembers({ includeInactive: true })).map((m) => [m.email, m.id]));
    const links = events.flatMap((e) => {
      const series = seriesNameOf(e);
      return series
        ? memberEmailsOf(e).map((email) => idByEmail.get(email)).filter((id): id is string => !!id).map((memberId) => ({ seriesId: slugify(series), memberId }))
        : [];
    });
    await db.seriesMember.createMany({ data: links, skipDuplicates: true });

    // Future meetings that disappeared from the calendar, and nobody has marked yet, are removed.
    const uids = events.map((e) => e.uid);
    const removed = await db.meeting.deleteMany({
      where: { uid: { notIn: uids }, startsAt: { gt: now() }, attendance: { none: {} } },
    });

    const result = `${imported.meetings} meetings in ${imported.series} series${removed.count ? `, ${removed.count} removed` : ''}${imported.skipped ? `, ${imported.skipped} without a series skipped` : ''}`;
    await db.calendarSync.upsert({
      where: { id: SYNC_ID },
      create: { id: SYNC_ID, syncedAt: new Date(), result, error: null },
      update: { syncedAt: new Date(), result, error: null },
    });
    await emit('calendar.synced', {});
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db.calendarSync.upsert({ where: { id: SYNC_ID }, create: { id: SYNC_ID, error }, update: { error } });
  }
  return calendarStatus();
};

/** Syncs when the last sync is older than CALENDAR_SYNC_MINUTES. Never throws; waits at most `waitMs`. */
export const syncIfStale = async (waitMs = 4000): Promise<void> => {
  if (!config.calendarIcsUrl) return;
  const status = await calendarStatus();
  const age = status.syncedAt ? Date.now() - Date.parse(status.syncedAt) : Infinity;
  if (age < config.calendarSyncMinutes * 60_000) return;
  await Promise.race([syncCalendar().catch(() => undefined), new Promise((r) => setTimeout(r, waitMs))]);
};
