import { describe, expect, it } from 'vitest';
import { canLogOn, expectedShare, paceStatus } from './rules';

describe('hours rules', () => {
  it('pro-rates the current week by working days', () => {
    expect(expectedShare('2026-10-19', '2026-10-19')).toBe(0.2); // Monday
    expect(expectedShare('2026-10-19', '2026-10-21')).toBe(0.6); // Wednesday: 6 of 10 h for Impact
    expect(expectedShare('2026-10-19', '2026-10-24')).toBe(1); // Saturday
    expect(expectedShare('2026-10-12', '2026-10-21')).toBe(1); // past week
    expect(expectedShare('2026-10-26', '2026-10-21')).toBe(0); // future week
  });

  it('classifies pace', () => {
    expect(paceStatus(10, 10, 6)).toBe('met');
    expect(paceStatus(6, 10, 6)).toBe('on-track');
    expect(paceStatus(5.5, 10, 6)).toBe('behind');
  });

  it('limits how far back hours can be logged', () => {
    expect(canLogOn('2026-10-24', '2026-10-24', false)).toBe(true);
    expect(canLogOn('2026-10-23', '2026-10-24', false)).toBe(true);
    expect(canLogOn('2026-10-22', '2026-10-24', false)).toBe(false);
    expect(canLogOn('2026-10-18', '2026-10-24', true)).toBe(true);
    expect(canLogOn('2026-10-17', '2026-10-24', true)).toBe(false);
    expect(canLogOn('2026-10-25', '2026-10-24', true)).toBe(false);
  });
});
