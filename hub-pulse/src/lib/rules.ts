import type { AttendanceRecord, Meeting, MeetingSeries, Member, TimeEntry } from './types';
import { TIER_HOURS } from './types';
import { CURRENT_WEEK, DEMO_TODAY, WEEK_PACE, toMin, weekOf } from './time';

/** Pretend clock for the demo, so "happening now" is stable. */
export const DEMO_NOW = '12:40';
/** Members can log hours for today and this many days back. */
export const MEMBER_LOG_DAYS_BACK = 1;
/** Clock-in opens this many minutes before a meeting starts. */
export const CLOCK_IN_OPENS_MIN = 10;

export const entryMinutes = (e: TimeEntry): number => toMin(e.end) - toMin(e.start);

export const weekHours = (entries: TimeEntry[], memberId: string, week = CURRENT_WEEK): number =>
  entries.filter((e) => e.memberId === memberId && weekOf(e.date) === week).reduce((a, e) => a + entryMinutes(e), 0) / 60;

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
