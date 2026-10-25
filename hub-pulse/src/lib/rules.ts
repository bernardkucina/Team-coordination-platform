import type { AttendanceRecord, Meeting, MeetingSeries, Member, Task, TimeEntry } from './types';
import { TIER_HOURS } from './types';
import { CURRENT_WEEK, DEMO_TODAY, WEEK_PACE, dateInWeek, toMin, weekOf } from './time';

/** Pretend clock for the demo: Shapers Voice (19:00–20:00) is happening. */
export const DEMO_NOW = '19:10';
/** Members can log hours for today and this many days back. */
export const MEMBER_LOG_DAYS_BACK = 1;
/** Clock-in opens this many minutes before a meeting starts (see PLAN.md). */
export const CLOCK_IN_OPENS_MIN = 15;

export const entryMinutes = (e: TimeEntry): number => toMin(e.end) - toMin(e.start);

export const weekHours = (entries: TimeEntry[], memberId: string, week = CURRENT_WEEK): number =>
  entries.filter((e) => e.memberId === memberId && weekOf(e.date) === week).reduce((a, e) => a + entryMinutes(e), 0) / 60;

export interface WeekSplit {
  hub: number;
  remote: number;
}

/** Hours in the hub vs remote for one member in one week (current week from time entries). */
export const weekSplit = (entries: TimeEntry[], memberId: string, week = CURRENT_WEEK): WeekSplit => {
  const mine = entries.filter((e) => e.memberId === memberId && weekOf(e.date) === week);
  const sum = (place: TimeEntry['place']) => mine.filter((e) => e.place === place).reduce((a, e) => a + entryMinutes(e), 0) / 60;
  return { hub: sum('hub'), remote: sum('remote') };
};

export interface WeekStats {
  week: number;
  hours: number;
  hub: number;
  remote: number;
  tasksDone: number;
  current: boolean;
}

/** Every week we have for a member, oldest first: the finished weeks plus the current one. */
export const memberWeeks = (member: Member, entries: TimeEntry[], tasks: Task[]): WeekStats[] => {
  const first = CURRENT_WEEK - member.pastWeeks.length;
  const past = member.pastWeeks.map((hours, i) => ({
    week: first + i, hours, hub: member.pastWeeksHub[i] ?? 0, remote: hours - (member.pastWeeksHub[i] ?? 0),
    tasksDone: member.pastTasksDone[i] ?? 0, current: false,
  }));
  const split = weekSplit(entries, member.id);
  const doneNow = tasks.filter((t) => t.owner === member.id && t.doneAt !== null && weekOf(t.doneAt) === CURRENT_WEEK).length;
  return [...past, { week: CURRENT_WEEK, hours: split.hub + split.remote, hub: split.hub, remote: split.remote, tasksDone: doneNow, current: true }];
};

export type PaceStatus = 'met' | 'on-track' | 'behind';

export const paceStatus = (hours: number, member: Member): PaceStatus => {
  const commitment = TIER_HOURS[member.tier];
  if (hours >= commitment) return 'met';
  if (hours >= commitment * WEEK_PACE) return 'on-track';
  return 'behind';
};

/** On pace (or ahead) and took initiative this month. */
export const isSuperstar = (hours: number, member: Member): boolean =>
  paceStatus(hours, member) !== 'behind' && (member.picked >= 2 || member.ideas >= 2);

export type MeetingPhase = 'past' | 'live' | 'upcoming';

export const meetingPhase = (m: Meeting): MeetingPhase => {
  if (m.date < DEMO_TODAY) return 'past';
  if (m.date > DEMO_TODAY) return 'upcoming';
  const now = toMin(DEMO_NOW);
  if (now >= toMin(m.end)) return 'past';
  if (now >= toMin(m.start) - CLOCK_IN_OPENS_MIN) return 'live';
  return 'upcoming';
};

export interface AttendanceStats {
  invited: number;
  present: number;
  remote: number;
  excused: number;
  missed: number;
  /** showed up ÷ (invited − excused); null when nothing counts. */
  rate: number | null;
}

/**
 * Only finished meetings count. A meeting nobody marked for this person counts as missed
 * once it has been recorded by an admin; before that it is simply not counted yet.
 */
export const attendanceStats = (
  memberId: string,
  meetings: Meeting[],
  series: MeetingSeries[],
  records: AttendanceRecord[],
): AttendanceStats => {
  const stats: AttendanceStats = { invited: 0, present: 0, remote: 0, excused: 0, missed: 0, rate: null };
  for (const m of meetings) {
    if (meetingPhase(m) !== 'past') continue;
    const s = series.find((x) => x.id === m.seriesId);
    if (!s || !s.invited.includes(memberId)) continue;
    const rec = records.find((r) => r.meetingId === m.id && r.memberId === memberId);
    if (!rec && !m.recorded) continue;
    stats.invited++;
    stats[rec ? rec.status : 'missed']++;
  }
  const base = stats.invited - stats.excused;
  stats.rate = base > 0 ? Math.round(((stats.present + stats.remote) / base) * 100) : null;
  return stats;
};

export type DayHours = Map<string, { hub: number; remote: number }>;

/**
 * Hours per day for one member. This week's days come from the logged entries; earlier weeks only have
 * weekly totals in the sandbox, so the demo spreads each week over its first few weekdays.
 */
export const dailyHours = (member: Member, entries: TimeEntry[], tasks: Task[]): DayHours => {
  const SPREAD = [0, 2, 1, 3, 4];
  const perDay: DayHours = new Map();
  for (const w of memberWeeks(member, entries, tasks)) {
    if (w.current) continue;
    const days = w.hours > 0 ? Math.min(5, Math.max(1, Math.round(w.hours / 2.5))) : 0;
    for (let k = 0; k < days; k++) perDay.set(dateInWeek(w.week, SPREAD[k]), { hub: w.hub / days, remote: w.remote / days });
  }
  for (const e of entries.filter((x) => x.memberId === member.id)) {
    const h = (toMin(e.end) - toMin(e.start)) / 60;
    const d = perDay.get(e.date) ?? { hub: 0, remote: 0 };
    perDay.set(e.date, e.place === 'hub' ? { ...d, hub: d.hub + h } : { ...d, remote: d.remote + h });
  }
  return perDay;
};

/** Adds several members' day maps together. */
export const sumDays = (maps: DayHours[]): DayHours => {
  const out: DayHours = new Map();
  for (const m of maps) for (const [d, v] of m) {
    const o = out.get(d) ?? { hub: 0, remote: 0 };
    out.set(d, { hub: o.hub + v.hub, remote: o.remote + v.remote });
  }
  return out;
};

/** Every date of the current month, built from strings so a clock change can't skip a day. */
export const currentMonthDays = (): string[] => {
  const [yy, mm] = DEMO_TODAY.split('-').map(Number);
  return Array.from({ length: new Date(yy, mm, 0).getDate() }, (_, k) => `${DEMO_TODAY.slice(0, 8)}${String(k + 1).padStart(2, '0')}`);
};
