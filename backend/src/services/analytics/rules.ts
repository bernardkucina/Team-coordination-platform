import { DRIFT_HOURS_SHARE, DRIFT_MISSED_MEETINGS, type PaceStatus } from '@hub-pulse/shared';

/**
 * "Drifting away": under half the commitment in each of the last two finished weeks,
 * and missed at least one meeting in those weeks without an excuse.
 */
export const isDrifting = (lastTwoWeeksHours: number[], commitment: number, missedMeetings: number): boolean =>
  lastTwoWeeksHours.length === 2 &&
  lastTwoWeeksHours.every((h) => h < commitment * DRIFT_HOURS_SHARE) &&
  missedMeetings >= DRIFT_MISSED_MEETINGS;

/** On pace (or ahead) and took initiative this month. */
export const isSuperstar = (pace: PaceStatus, picked: number, ideas: number): boolean =>
  pace !== 'behind' && (picked >= 2 || ideas >= 2);
