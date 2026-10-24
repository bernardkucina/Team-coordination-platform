/**
 * The leader's view across hours, attendance and tasks. Reads from the other services only through
 * their public functions and never writes anything.
 */
import type { Member as DbMember } from '@prisma/client';
import type {
  AttendanceRecord, AttendanceStats, MemberAnalyticsRow, MemberHistory, SeriesTrend, Tier, TierTrend,
} from '@hub-pulse/shared';
import { addDays, isoWeek, localParts, now, today, weekStartOf, weekStarts, zonedToUtc } from '../../core/clock';
import { commitmentOf, getMember, listMembers, tierName, toMember, type MemberStats } from '../members';
import { initiativeSince, listTasks, taskOutcomes } from '../tasks';
import { listMeetingRows, listSeries } from '../meetings';
import { attendanceStats, listRecords, meetingPhase, type StatsMeeting } from '../attendance';
import { expectedShare, paceStatus, roundHours, weeklyHours } from '../hours';
import { isDrifting, isSuperstar } from './rules';

/** Weeks of history behind Member.pastWeeks. */
const PAST_WEEKS = 7;

interface Context {
  now: Date;
  today: string;
  thisWeek: string;
  members: DbMember[];
  hours: Map<string, Map<string, number>>;
  meetings: StatsMeeting[];
  invited: Map<string, Set<string>>;
  statusOf: (meetingId: string, memberId: string) => AttendanceRecord['status'] | undefined;
  records: AttendanceRecord[];
  tasks: Awaited<ReturnType<typeof taskOutcomes>>;
  initiative: Map<string, { picked: number; ideas: number }>;
}

const loadContext = async (historyWeeks: number): Promise<Context> => {
  const at = now();
  const day = today();
  const thisWeek = weekStartOf(day);
  const firstWeek = addDays(thisWeek, -7 * Math.max(PAST_WEEKS, historyWeeks));
  const monthStart = zonedToUtc(`${day.slice(0, 7)}-01`);

  const [members, hours, meetingRows, series, records, tasks, initiative] = await Promise.all([
    listMembers({ includeInactive: true }),
    weeklyHours(firstWeek, addDays(thisWeek, 6)),
    listMeetingRows(),
    listSeries(),
    listRecords(),
    taskOutcomes(),
    initiativeSince(monthStart),
  ]);

  const byKey = new Map(records.map((r) => [`${r.meetingId}|${r.memberId}`, r.status]));
  return {
    now: at,
    today: day,
    thisWeek,
    members,
    hours,
    meetings: meetingRows.map((m) => ({ id: m.id, seriesId: m.seriesId, recorded: m.recorded, startsAt: m.startsAt, endsAt: m.endsAt })),
    invited: new Map(series.map((s) => [s.id, new Set(s.invited)])),
    statusOf: (meetingId, memberId) => byKey.get(`${meetingId}|${memberId}`),
    records,
    tasks,
    initiative,
  };
};

const hoursIn = (ctx: Context, memberId: string, weekStart: string): number => ctx.hours.get(memberId)?.get(weekStart) ?? 0;

const meetingsBetween = (ctx: Context, fromWeek: string, toWeekExclusive: string): StatsMeeting[] => {
  const from = zonedToUtc(fromWeek);
  const to = zonedToUtc(toWeekExclusive);
  return ctx.meetings.filter((m) => m.startsAt >= from && m.startsAt < to);
};

const statsFor = (ctx: Context, memberId: string, meetings = ctx.meetings): AttendanceStats =>
  attendanceStats(memberId, meetings, ctx.invited, ctx.statusOf, ctx.now);

const rowFor = (ctx: Context, m: DbMember): MemberAnalyticsRow => {
  const commitment = commitmentOf(m.tier);
  const weekHours = roundHours(hoursIn(ctx, m.id, ctx.thisWeek));
  const expectedHours = roundHours(commitment * expectedShare(ctx.thisWeek, ctx.today));
  const pace = paceStatus(weekHours, commitment, expectedHours);

  const finished = weekStarts(addDays(ctx.thisWeek, -7), 6);
  const avgHours6w = roundHours(finished.reduce((sum, w) => sum + hoursIn(ctx, m.id, w), 0) / finished.length);

  const lastTwo = finished.slice(-2);
  const missedRecently = statsFor(ctx, m.id, meetingsBetween(ctx, lastTwo[0], ctx.thisWeek)).missed;

  const owned = ctx.tasks.filter((t) => t.ownerId === m.id);
  const weekStartInstant = zonedToUtc(ctx.thisWeek);
  const initiative = ctx.initiative.get(m.id) ?? { picked: 0, ideas: 0 };

  return {
    memberId: m.id,
    name: m.name,
    tier: tierName(m.tier),
    active: m.active,
    commitment,
    weekHours,
    expectedHours,
    pace,
    avgHours6w,
    attendance: statsFor(ctx, m.id),
    tasksOpen: owned.filter((t) => t.status !== 'done' && t.status !== 'idea').length,
    tasksDone: owned.filter((t) => t.status === 'done').length,
    tasksDoneThisWeek: owned.filter((t) => t.status === 'done' && t.doneAt && t.doneAt >= weekStartInstant).length,
    drifting: m.active && isDrifting(lastTwo.map((w) => hoursIn(ctx, m.id, w)), commitment, missedRecently),
    superstar: m.active && isSuperstar(pace, initiative.picked, initiative.ideas),
  };
};

/** One row per member: the admin's main table. */
export const memberRows = async (): Promise<MemberAnalyticsRow[]> => {
  const ctx = await loadContext(PAST_WEEKS);
  return ctx.members.map((m) => rowFor(ctx, m));
};

/** picked / ideas / pastWeeks for every member, for the Member objects the frontend shows. */
const statsOf = (ctx: Context, memberId: string): MemberStats => ({
  ...(ctx.initiative.get(memberId) ?? { picked: 0, ideas: 0 }),
  pastWeeks: weekStarts(addDays(ctx.thisWeek, -7), PAST_WEEKS).map((w) => roundHours(hoursIn(ctx, memberId, w))),
});

export const memberStats = async (): Promise<Map<string, MemberStats>> => {
  const ctx = await loadContext(PAST_WEEKS);
  return new Map(ctx.members.map((m) => [m.id, statsOf(ctx, m.id)]));
};

const TIERS: Tier[] = ['ShapersGO', 'Shapers Impact', 'Shapers Core'];

/** Hours against commitment per tier and week. The current week's commitment is pro-rated. Uses today's tiers. */
export const tierTrends = async (weeks: number): Promise<TierTrend[]> => {
  const ctx = await loadContext(weeks);
  const starts = weekStarts(ctx.thisWeek, weeks);
  return TIERS.map((tier) => {
    const members = ctx.members.filter((m) => m.active && tierName(m.tier) === tier);
    return {
      tier,
      members: members.length,
      weeks: starts.map((w) => {
        const hours = roundHours(members.reduce((sum, m) => sum + hoursIn(ctx, m.id, w), 0));
        const commitment = roundHours(members.reduce((sum, m) => sum + commitmentOf(m.tier), 0) * expectedShare(w, ctx.today));
        return { weekStart: w, isoWeek: isoWeek(w), hours, commitment, share: commitment > 0 ? Math.round((hours / commitment) * 100) / 100 : 0 };
      }),
    };
  });
};

/** Attendance per series and week, over all invited members. */
export const seriesTrends = async (weeks: number): Promise<SeriesTrend[]> => {
  const ctx = await loadContext(weeks);
  const starts = weekStarts(ctx.thisWeek, weeks);
  const series = await listSeries();
  return series.map((s) => ({
    seriesId: s.id,
    name: s.name,
    weeks: starts.map((w) => {
      const meetings = meetingsBetween(ctx, w, addDays(w, 7)).filter((m) => m.seriesId === s.id);
      const total: AttendanceStats = { invited: 0, present: 0, remote: 0, excused: 0, missed: 0, rate: null };
      for (const memberId of s.invited) {
        const one = statsFor(ctx, memberId, meetings);
        total.invited += one.invited;
        total.present += one.present;
        total.remote += one.remote;
        total.excused += one.excused;
        total.missed += one.missed;
      }
      const base = total.invited - total.excused;
      total.rate = base > 0 ? Math.round(((total.present + total.remote) / base) * 100) : null;
      return { weekStart: w, isoWeek: isoWeek(w), ...total };
    }),
  }));
};

/** Everything about one member over time. */
export const memberHistory = async (memberId: string, weeks: number): Promise<MemberHistory> => {
  const dbMember = await getMember(memberId);
  const ctx = await loadContext(weeks);
  const commitment = commitmentOf(dbMember.tier);

  // Finished meetings the member was invited to: their record, or "missed" once the meeting was recorded.
  const attendance: MemberHistory['attendance'] = [];
  for (const m of ctx.meetings) {
    if (!ctx.invited.get(m.seriesId)?.has(memberId)) continue;
    const record = ctx.records.find((r) => r.meetingId === m.id && r.memberId === memberId);
    const finished = meetingPhase(m, ctx.now) === 'past';
    if (!record && !(finished && m.recorded)) continue;
    attendance.push({
      ...(record ?? { meetingId: m.id, memberId, status: 'missed' as const, source: 'admin' as const }),
      date: localParts(m.startsAt).date,
      seriesId: m.seriesId,
    });
  }

  return {
    member: toMember(dbMember, statsOf(ctx, memberId)),
    row: rowFor(ctx, dbMember),
    weeks: weekStarts(ctx.thisWeek, weeks).map((w) => ({
      weekStart: w, isoWeek: isoWeek(w), hours: roundHours(hoursIn(ctx, memberId, w)), commitment: roundHours(commitment * expectedShare(w, ctx.today)),
    })),
    attendance: attendance.reverse(),
    tasks: await listTasks({ ownerId: memberId }),
  };
};
