import { describe, expect, it } from 'vitest';
import { isDrifting, isSuperstar } from './rules';

describe('analytics rules', () => {
  it('flags drifting only with low hours in both weeks and a missed meeting', () => {
    expect(isDrifting([2, 4], 10, 1)).toBe(true);
    expect(isDrifting([2, 5], 10, 1)).toBe(false); // 5 is exactly half: not under
    expect(isDrifting([2, 4], 10, 0)).toBe(false);
  });

  it('needs pace and initiative for superstar', () => {
    expect(isSuperstar('on-track', 2, 0)).toBe(true);
    expect(isSuperstar('met', 0, 2)).toBe(true);
    expect(isSuperstar('behind', 3, 3)).toBe(false);
    expect(isSuperstar('met', 1, 1)).toBe(false);
  });
});
