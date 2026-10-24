/**
 * The demo is pinned to Thursday 22 October 2026 (week 43), while the Shapers Voice
 * meeting from the sandbox calendar is happening. Swap for the real date with a database.
 */
export const DEMO_TODAY = '2026-10-22';
export const CURRENT_WEEK = 43;
const WEEK_43_MONDAY = new Date(2026, 9, 19);
const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const pad = (n: number): string => String(n).padStart(2, '0');

export const toMin = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

export const fromMin = (m: number): string => pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60);

export const durText = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
};

export const hoursText = (h: number): string => String(Math.round(h * 10) / 10).replace('.', ',') + ' h';

export const nowHM = (): string => {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
};

const toISO = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const fromISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (iso: string, days: number): string => toISO(new Date(fromISO(iso).getTime() + days * DAY_MS));

/** ISO date of a weekday (0 = Monday) in a given week number. */
export const dateInWeek = (week: number, weekday: number): string =>
  toISO(new Date(WEEK_43_MONDAY.getTime() + ((week - CURRENT_WEEK) * 7 + weekday) * DAY_MS));

export const fridayOf = (week: number): string => dateInWeek(week, 4);

export const weekOf = (iso: string): number =>
  CURRENT_WEEK + Math.floor((fromISO(iso).getTime() - WEEK_43_MONDAY.getTime()) / (7 * DAY_MS));

/** 0 = Monday. */
export const weekdayOf = (iso: string): number => (fromISO(iso).getDay() + 6) % 7;

export const shortDate = (iso: string | null): string => {
  if (!iso) return 'no date';
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

export const dayLabel = (iso: string): string => {
  if (iso === DEMO_TODAY) return 'Today';
  if (iso === addDays(DEMO_TODAY, -1)) return 'Yesterday';
  return `${WEEKDAYS[weekdayOf(iso)]} ${shortDate(iso)}`;
};

export const monthOfWeek = (week: number): string => MONTHS[fromISO(dateInWeek(week, 0)).getMonth()];

/**
 * Expected share of the weekly commitment by today, pro-rated by working days
 * (Wednesday = 3/5, Thursday = 4/5, Friday onwards = 5/5).
 */
export const WEEK_PACE = Math.min(5, weekdayOf(DEMO_TODAY) + 1) / 5;

export const longDate = (iso: string): string => {
  const d = fromISO(iso);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
};
