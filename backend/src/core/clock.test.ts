import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, isoWeek, localParts, weekStartOf, weekStarts, zonedToUtc } from './clock';

describe('clock', () => {
  it('converts Ljubljana local time to UTC across the DST change', () => {
    expect(zonedToUtc('2026-10-22', '18:00').toISOString()).toBe('2026-10-22T16:00:00.000Z'); // CEST, UTC+2
    expect(zonedToUtc('2026-10-26', '18:00').toISOString()).toBe('2026-10-26T17:00:00.000Z'); // CET, UTC+1
  });

  it('formats an instant as local date and time', () => {
    expect(localParts(new Date('2026-09-14T16:00:00Z'))).toEqual({ date: '2026-09-14', time: '18:00' });
    expect(localParts(new Date('2026-10-25T23:30:00Z'))).toEqual({ date: '2026-10-26', time: '00:30' });
  });

  it('finds Mondays and ISO weeks', () => {
    expect(weekStartOf('2026-10-24')).toBe('2026-10-19');
    expect(weekStartOf('2026-10-19')).toBe('2026-10-19');
    expect(isoWeek('2026-10-19')).toBe(43);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2027-01-01')).toBe(53);
  });

  it('does date arithmetic', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(daysBetween('2026-10-23', '2026-10-24')).toBe(1);
    expect(weekStarts('2026-10-19', 3)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });
});
