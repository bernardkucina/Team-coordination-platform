import { describe, expect, it } from 'vitest';
import type { AttendanceStatus } from '@hub-pulse/shared';
import { attendanceStats, canClockIn, canExcuse, meetingPhase, type StatsMeeting } from './rules';

const meeting = (id: string, start: string, end: string, recorded = true, seriesId = 'grants'): StatsMeeting => ({
  id, seriesId, recorded, startsAt: new Date(start), endsAt: new Date(end),
});

describe('attendance rules', () => {
  const m = meeting('m1', '2026-10-26T17:00:00Z', '2026-10-26T18:00:00Z');

  it('opens clock-in 10 minutes before the start until the end', () => {
    expect(meetingPhase(m, new Date('2026-10-26T16:49:00Z'))).toBe('upcoming');
    expect(canClockIn(m, new Date('2026-10-26T16:50:00Z'))).toBe(true);
    expect(canClockIn(m, new Date('2026-10-26T17:59:00Z'))).toBe(true);
    expect(canClockIn(m, new Date('2026-10-26T18:00:00Z'))).toBe(false);
  });

  it('allows "can\'t come" only before the start', () => {
    expect(canExcuse(m, new Date('2026-10-26T16:59:00Z'))).toBe(true);
    expect(canExcuse(m, new Date('2026-10-26T17:00:00Z'))).toBe(false);
  });

  it('counts finished meetings, excused never counts against, unrecorded gaps are not counted yet', () => {
    const meetings = [
      meeting('a', '2026-10-01T16:00:00Z', '2026-10-01T17:00:00Z'),
      meeting('b', '2026-10-08T16:00:00Z', '2026-10-08T17:00:00Z'),
      meeting('c', '2026-10-15T16:00:00Z', '2026-10-15T17:00:00Z'), // recorded, no record → missed
      meeting('d', '2026-10-22T16:00:00Z', '2026-10-22T17:00:00Z', false), // not recorded, no record → skipped
      meeting('e', '2026-10-29T16:00:00Z', '2026-10-29T17:00:00Z'), // future → skipped
      meeting('f', '2026-10-02T16:00:00Z', '2026-10-02T17:00:00Z', true, 'other'), // not invited
    ];
    const records: Record<string, AttendanceStatus> = { a: 'present', b: 'excused', e: 'present' };
    const stats = attendanceStats('ana', meetings, new Map([['grants', new Set(['ana'])]]), (id) => records[id], new Date('2026-10-24T10:00:00Z'));
    expect(stats).toEqual({ invited: 3, present: 1, remote: 0, excused: 1, missed: 1, rate: 50 });
  });
});
