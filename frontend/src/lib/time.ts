/**
 * The clock follows the server (GET /api/bootstrap returns its Europe/Ljubljana time), so "today",
 * the current week and "happening now" match the rules the backend enforces. setClock() runs on load,
 * tickClock() every few seconds. The names keep their demo-era spelling so existing imports still work;
 * they are live bindings, so always read them at render time, never copy them into module constants.
 */
export let DEMO_TODAY = '2026-10-24';
export let CURRENT_WEEK = 43;
/** HH:MM now. */
export let DEMO_NOW = '12:40';
/** Share of the weekly commitment expected by today: working days so far (Wednesday = 3/5, weekend = 1). */
export let WEEK_PACE = 1;
let clockOffsetMs = 0;
/** A fixed reference: Monday 19 October 2026 is ISO week 43. Week numbers are counted from it. */
const ANCHOR_MONDAY = new Date(2026, 9, 19);
const ANCHOR_WEEK = 43;
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

const clockNow = (): Date => new Date(Date.now() + clockOffsetMs);

export const nowHM = (): string => {
  const d = clockNow();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
};

const toISO = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** A timestamp from the API ("2026-10-23T18:00:00.000Z") as a local date; plain dates pass through. */
export const localDate = (when: string): string => (when.length <= 10 ? when : toISO(new Date(when)));

const fromISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** Calendar arithmetic (not 24-hour steps), so days stay right across daylight saving changes. */
export const addDays = (iso: string, days: number): string => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
};

/** Whole calendar days from the anchor Monday (rounded, so a 23- or 25-hour day still counts as one). */
const daysFromAnchor = (iso: string): number => Math.round((fromISO(iso).getTime() - ANCHOR_MONDAY.getTime()) / DAY_MS);

/** ISO date of a weekday (0 = Monday) in a given week number. */
export const dateInWeek = (week: number, weekday: number): string =>
  addDays(toISO(ANCHOR_MONDAY), (week - ANCHOR_WEEK) * 7 + weekday);

export const fridayOf = (week: number): string => dateInWeek(week, 4);

/** ISO week number within 2026 (the frontend's "W43"). */
export const weekOf = (iso: string): number => ANCHOR_WEEK + Math.floor(daysFromAnchor(iso) / 7);

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

const LONG_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Saturday, 24 October". */
export const longDate = (iso: string): string => {
  const d = fromISO(iso);
  return `${LONG_WEEKDAYS[weekdayOf(iso)]}, ${d.getDate()} ${LONG_MONTHS[d.getMonth()]}`;
};

/** Recomputes today, the current week, now and the expected pace from the server-synced clock. */
export const tickClock = (): void => {
  const d = clockNow();
  DEMO_TODAY = toISO(d);
  DEMO_NOW = pad(d.getHours()) + ':' + pad(d.getMinutes());
  CURRENT_WEEK = weekOf(DEMO_TODAY);
  WEEK_PACE = Math.min(weekdayOf(DEMO_TODAY) + 1, 5) / 5;
};

/** Aligns the clock with the server's local date and time (it may run on DEMO_NOW). */
export const setClock = (date: string, time: string): void => {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const server = new Date(y, m - 1, d, h, mi).getTime();
  // The server only sends minutes; ignore differences under a minute so the clock does not jump back.
  const diff = server - Date.now();
  clockOffsetMs = Math.abs(diff) < 60_000 ? 0 : diff;
  tickClock();
};

/** "just now", "12 min ago", "today 14:05", "yesterday 09:30", "12 Oct". Non-ISO text is shown as is. */
export const whenText = (when: string): string => {
  const t = Date.parse(when);
  if (Number.isNaN(t)) return when;
  const mins = Math.round((clockNow().getTime() - t) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const d = new Date(t);
  const iso = toISO(d);
  const hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (iso === DEMO_TODAY) return `today ${hm}`;
  if (iso === addDays(DEMO_TODAY, -1)) return `yesterday ${hm}`;
  return shortDate(iso);
};
