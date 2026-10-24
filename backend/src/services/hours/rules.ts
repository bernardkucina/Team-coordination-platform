import { ADMIN_LOG_DAYS_BACK, MEMBER_LOG_DAYS_BACK, WORKING_DAYS, type PaceStatus } from '@hub-pulse/shared';
import { addDays, daysBetween, weekdayOf } from '../../core/clock';

/**
 * Share of the weekly commitment expected by `today` for the week starting `weekStart`:
 * past weeks 1, future weeks 0, the current week pro-rated by working days (Wednesday = 3/5).
 */
export const expectedShare = (weekStart: string, today: string): number => {
  if (today >= addDays(weekStart, 7)) return 1;
  if (today < weekStart) return 0;
  return Math.min(weekdayOf(today) + 1, WORKING_DAYS) / WORKING_DAYS;
};

export const paceStatus = (hours: number, commitment: number, expected: number): PaceStatus => {
  if (hours >= commitment) return 'met';
  if (hours >= expected) return 'on-track';
  return 'behind';
};

/** Members can log today and yesterday; admins up to six days back. Never the future. */
export const canLogOn = (date: string, today: string, isAdmin: boolean): boolean => {
  const back = daysBetween(date, today);
  return back >= 0 && back <= (isAdmin ? ADMIN_LOG_DAYS_BACK : MEMBER_LOG_DAYS_BACK);
};

export const roundHours = (h: number): number => Math.round(h * 100) / 100;
