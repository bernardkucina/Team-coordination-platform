import type { TimeEntry as DbEntry } from '@prisma/client';
import type { CreateTimeEntryRequest, HoursSummary, TimeEntry, UpdateTimeEntryRequest } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { addDays, fromDbDate, fromMin, isoWeek, toDbDate, toMin, today, weekStartOf } from '../../core/clock';
import { badRequest, forbidden, notFound } from '../../core/errors';
import type { SessionMember } from '../../core/auth';
import { commitmentOf, getMember } from '../members';
import { canLogOn, expectedShare, paceStatus, roundHours } from './rules';

export const toEntry = (e: DbEntry): TimeEntry => ({
  id: e.id,
  memberId: e.memberId,
  projectId: e.projectId,
  date: fromDbDate(e.date),
  start: fromMin(e.startMin),
  end: fromMin(e.endMin),
  note: e.note,
  source: e.source,
});

/** Entries on local dates in [from, to], newest first. */
export const listEntries = async (filter: { memberId?: string; from?: string; to?: string } = {}): Promise<TimeEntry[]> => {
  const entries = await db.timeEntry.findMany({
    where: {
      ...(filter.memberId && { memberId: filter.memberId }),
      date: { ...(filter.from && { gte: toDbDate(filter.from) }), ...(filter.to && { lte: toDbDate(filter.to) }) },
    },
    orderBy: [{ date: 'desc' }, { startMin: 'desc' }],
  });
  return entries.map(toEntry);
};

const assertRange = (start: string, end: string) => {
  if (toMin(end) <= toMin(start)) throw badRequest('The end time must be after the start time.');
};

const assertLogWindow = (date: string, actor: SessionMember) => {
  if (!canLogOn(date, today(), actor.isAdmin)) {
    throw badRequest(actor.isAdmin ? 'Admins can log hours for the last 7 days.' : 'You can log hours for today or yesterday. For older days, ask an admin.');
  }
};

const assertProject = async (projectId: string) => {
  if (!(await db.project.findUnique({ where: { id: projectId }, select: { id: true } }))) throw badRequest('Unknown project.');
};

export const createEntry = async (input: CreateTimeEntryRequest, actor: SessionMember, source: 'manual' | 'meeting' = 'manual', meetingId?: string): Promise<TimeEntry> => {
  const memberId = input.memberId ?? actor.id;
  if (memberId !== actor.id && !actor.isAdmin) throw forbidden('You can only log your own hours.');
  if (source === 'manual') assertLogWindow(input.date, actor);
  assertRange(input.start, input.end);
  await assertProject(input.projectId);
  await getMember(memberId);
  const entry = await db.timeEntry.create({
    data: {
      memberId, projectId: input.projectId, date: toDbDate(input.date), startMin: toMin(input.start), endMin: toMin(input.end),
      note: input.note?.trim() ?? '', source, meetingId,
    },
  });
  return toEntry(entry);
};

const loadEditable = async (id: number, actor: SessionMember): Promise<DbEntry> => {
  const entry = await db.timeEntry.findUnique({ where: { id } });
  if (!entry) throw notFound('Time entry');
  if (entry.memberId !== actor.id && !actor.isAdmin) throw forbidden('You can only change your own hours.');
  assertLogWindow(fromDbDate(entry.date), actor);
  return entry;
};

export const updateEntry = async (id: number, patch: UpdateTimeEntryRequest, actor: SessionMember): Promise<TimeEntry> => {
  const current = toEntry(await loadEditable(id, actor));
  const next = { ...current, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) } as TimeEntry;
  if (next.date !== current.date) assertLogWindow(next.date, actor);
  assertRange(next.start, next.end);
  if (next.projectId !== current.projectId) await assertProject(next.projectId);
  const entry = await db.timeEntry.update({
    where: { id },
    data: { projectId: next.projectId, date: toDbDate(next.date), startMin: toMin(next.start), endMin: toMin(next.end), note: next.note.trim() },
  });
  return toEntry(entry);
};

export const deleteEntry = async (id: number, actor: SessionMember): Promise<void> => {
  await loadEditable(id, actor);
  await db.timeEntry.delete({ where: { id } });
};

/** Hours per member per week (keyed by Monday) for local dates in [fromMonday, toDate]. */
export const weeklyHours = async (fromMonday: string, toDate: string): Promise<Map<string, Map<string, number>>> => {
  const entries = await db.timeEntry.findMany({
    where: { date: { gte: toDbDate(fromMonday), lte: toDbDate(toDate) } },
    select: { memberId: true, date: true, startMin: true, endMin: true },
  });
  const totals = new Map<string, Map<string, number>>();
  for (const e of entries) {
    const week = weekStartOf(fromDbDate(e.date));
    const byWeek = totals.get(e.memberId) ?? new Map<string, number>();
    byWeek.set(week, (byWeek.get(week) ?? 0) + (e.endMin - e.startMin) / 60);
    totals.set(e.memberId, byWeek);
  }
  return totals;
};

export const hoursSummary = async (memberId: string): Promise<HoursSummary> => {
  const member = await getMember(memberId);
  const day = today();
  const weekStart = weekStartOf(day);
  const hours = roundHours((await weeklyHours(weekStart, addDays(weekStart, 6))).get(memberId)?.get(weekStart) ?? 0);
  const commitment = commitmentOf(member.tier);
  const expected = roundHours(commitment * expectedShare(weekStart, day));
  return { memberId, weekStart, isoWeek: isoWeek(weekStart), hours, commitment, expected, pace: paceStatus(hours, commitment, expected) };
};
