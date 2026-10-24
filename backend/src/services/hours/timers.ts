/**
 * "Track time" stopwatches, kept on the server so they survive a refresh or a second device.
 * A work timer logs a manual entry when stopped. A meeting timer also clocks the member in.
 */
import type { ActiveTimer } from '@prisma/client';
import type { TimeEntry, TimersResponse, Tracking, WorkTimer } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { fromMin, localParts, now, toMin } from '../../core/clock';
import { badRequest, conflict } from '../../core/errors';
import type { SessionMember } from '../../core/auth';
import { getMeetingRow, getSeries } from '../meetings';
import { markSelf, setSelfMode } from '../attendance';
import { createEntry } from './service';

const toWork = (t: ActiveTimer): WorkTimer => ({
  memberId: t.memberId, projectId: t.projectId ?? '', at: localParts(t.startedAt).time, startedAt: t.startedAt.getTime(),
});

const toTracking = (t: ActiveTimer): Tracking => ({
  meetingId: t.meetingId ?? '', memberId: t.memberId, mode: t.mode ?? 'present', at: localParts(t.startedAt).time, startedAt: t.startedAt.getTime(),
});

export const getTimers = async (memberId: string): Promise<TimersResponse> => {
  const timers = await db.activeTimer.findMany({ where: { memberId } });
  const work = timers.find((t) => t.kind === 'work');
  const meeting = timers.find((t) => t.kind === 'meeting');
  return { workTimer: work ? toWork(work) : null, tracking: meeting ? toTracking(meeting) : null };
};

const running = (memberId: string, kind: 'work' | 'meeting') =>
  db.activeTimer.findUnique({ where: { memberId_kind: { memberId, kind } } });

/** Turns a stopped timer into a time entry on the day it started (capped at midnight, at least 1 minute). */
const entryFor = async (timer: ActiveTimer, actor: SessionMember, projectId: string, note: string, source: 'manual' | 'meeting'): Promise<TimeEntry> => {
  const started = localParts(timer.startedAt);
  const stopped = localParts(now());
  const endMin = stopped.date === started.date ? Math.max(toMin(started.time) + 1, toMin(stopped.time)) : 24 * 60 - 1;
  const startMin = Math.min(toMin(started.time), endMin - 1);
  return createEntry(
    { projectId, date: started.date, start: fromMin(startMin), end: fromMin(endMin), note },
    actor, source, timer.meetingId ?? undefined,
  );
};

export const startWork = async (actor: SessionMember, projectId: string): Promise<TimersResponse> => {
  if (await running(actor.id, 'work')) throw conflict('A timer is already running. Stop it first.');
  if (!(await db.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw badRequest('Unknown project.');
  await db.activeTimer.create({ data: { memberId: actor.id, kind: 'work', projectId, startedAt: now() } });
  return getTimers(actor.id);
};

export const stopWork = async (actor: SessionMember, projectId?: string): Promise<TimersResponse> => {
  const timer = await running(actor.id, 'work');
  if (!timer) throw badRequest('No timer is running.');
  const entry = await entryFor(timer, actor, projectId ?? timer.projectId!, '', 'manual');
  await db.activeTimer.delete({ where: { id: timer.id } });
  return { ...(await getTimers(actor.id)), entry };
};

/** Clocks in to the meeting (same window and invite rules as a plain clock-in) and starts its timer. */
export const startMeeting = async (actor: SessionMember, meetingId: string, mode: 'present' | 'remote'): Promise<TimersResponse> => {
  if (await running(actor.id, 'meeting')) throw conflict('You are already tracking a meeting. Stop it first.');
  await markSelf(meetingId, actor, mode);
  await db.activeTimer.create({ data: { memberId: actor.id, kind: 'meeting', meetingId, mode, startedAt: now() } });
  return getTimers(actor.id);
};

export const setMeetingMode = async (actor: SessionMember, mode: 'present' | 'remote'): Promise<TimersResponse> => {
  const timer = await running(actor.id, 'meeting');
  if (!timer?.meetingId) throw badRequest('You are not tracking a meeting.');
  await db.activeTimer.update({ where: { id: timer.id }, data: { mode } });
  await setSelfMode(timer.meetingId, actor.id, mode);
  return getTimers(actor.id);
};

/** Logs the meeting time, on the series' project unless another one is given. */
export const stopMeeting = async (actor: SessionMember, projectId?: string): Promise<TimersResponse> => {
  const timer = await running(actor.id, 'meeting');
  if (!timer?.meetingId) throw badRequest('You are not tracking a meeting.');
  const series = await getSeries((await getMeetingRow(timer.meetingId)).seriesId);
  const target = projectId ?? series.projectId;
  if (!target) throw badRequest('Choose the project to log this meeting on.');
  const entry = await entryFor(timer, actor, target, `Meeting: ${series.name}`, 'meeting');
  await db.activeTimer.delete({ where: { id: timer.id } });
  return { ...(await getTimers(actor.id)), entry };
};
