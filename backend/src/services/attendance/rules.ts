import { CLOCK_IN_OPENS_MIN, type AttendanceStats, type AttendanceStatus } from '@hub-pulse/shared';

export interface MeetingTimes {
  startsAt: Date;
  endsAt: Date;
}

export type MeetingPhase = 'upcoming' | 'live' | 'past';

/** "live" from CLOCK_IN_OPENS_MIN minutes before the start until the end. */
export const meetingPhase = (m: MeetingTimes, now: Date): MeetingPhase => {
  if (now >= m.endsAt) return 'past';
  if (now.getTime() >= m.startsAt.getTime() - CLOCK_IN_OPENS_MIN * 60_000) return 'live';
  return 'upcoming';
};

export const canClockIn = (m: MeetingTimes, now: Date): boolean => meetingPhase(m, now) === 'live';

/** "Can't come" is only possible before the meeting starts. */
export const canExcuse = (m: MeetingTimes, now: Date): boolean => now < m.startsAt;

/** Days after a meeting ends during which members can still answer "did you attend?". */
export const REPORT_DAYS = 7;

/** "Did you attend?" can be answered after the meeting ended, for REPORT_DAYS days. */
export const canReport = (m: MeetingTimes, now: Date): boolean =>
  now >= m.endsAt && now.getTime() - m.endsAt.getTime() <= REPORT_DAYS * 86_400_000;

export interface StatsMeeting extends MeetingTimes {
  id: string;
  seriesId: string;
  recorded: boolean;
}

/**
 * Only finished meetings of series the member is invited to count. A meeting nobody marked for this member
 * counts as missed once an admin recorded it; before that it is not counted yet. Excused absences never
 * count against anyone: rate = showed up ÷ (invited − excused).
 */
export const attendanceStats = (
  memberId: string,
  meetings: StatsMeeting[],
  invitedBySeries: Map<string, Set<string>>,
  statusOf: (meetingId: string, memberId: string) => AttendanceStatus | undefined,
  now: Date,
): AttendanceStats => {
  const stats: AttendanceStats = { invited: 0, present: 0, remote: 0, excused: 0, missed: 0, rate: null };
  for (const m of meetings) {
    if (meetingPhase(m, now) !== 'past') continue;
    if (!invitedBySeries.get(m.seriesId)?.has(memberId)) continue;
    const status = statusOf(m.id, memberId);
    if (!status && !m.recorded) continue;
    stats.invited++;
    stats[status ?? 'missed']++;
  }
  const base = stats.invited - stats.excused;
  stats.rate = base > 0 ? Math.round(((stats.present + stats.remote) / base) * 100) : null;
  return stats;
};
