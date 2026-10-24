/**
 * Dates and times. The institute runs on Europe/Ljubljana time: calendar dates ("YYYY-MM-DD") and
 * clock times ("HH:MM") are local, instants (Date) are UTC.
 */
import { config } from './config';

export const TZ = 'Europe/Ljubljana';
const DAY_MS = 86_400_000;

const pad = (n: number): string => String(n).padStart(2, '0');

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
});

const zonedParts = (instant: Date) => {
  const p = Object.fromEntries(partsFormatter.formatToParts(instant).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
};

/** Local date and time of an instant. */
export const localParts = (instant: Date): { date: string; time: string } => {
  const p = zonedParts(instant);
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.mi)}` };
};

/** The instant of a local date and time. */
export const zonedToUtc = (date: string, time = '00:00'): Date => {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Correct by the zone offset at that moment; the second pass handles DST edges.
  let guess = asUtc;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess));
    const offset = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - guess;
    guess = asUtc - offset;
  }
  return new Date(guess);
};

/* ---------- the server clock ---------- */

const bootReal = Date.now();
const bootDemo = config.demoNow ? zonedToUtc(...(config.demoNow.split('T') as [string, string])).getTime() : null;

/** Now. With DEMO_NOW set, the clock starts at that moment and keeps running. */
export const now = (): Date => new Date(bootDemo === null ? Date.now() : bootDemo + (Date.now() - bootReal));

export const today = (): string => localParts(now()).date;

/* ---------- calendar dates ("YYYY-MM-DD") ---------- */

const dateToUtcMs = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

const msToDate = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const addDays = (iso: string, days: number): string => msToDate(dateToUtcMs(iso) + days * DAY_MS);

/** Whole days from a to b (b − a). */
export const daysBetween = (a: string, b: string): number => Math.round((dateToUtcMs(b) - dateToUtcMs(a)) / DAY_MS);

/** 0 = Monday … 6 = Sunday. */
export const weekdayOf = (iso: string): number => (new Date(dateToUtcMs(iso)).getUTCDay() + 6) % 7;

/** Monday of the week the date is in. */
export const weekStartOf = (iso: string): string => addDays(iso, -weekdayOf(iso));

/** ISO 8601 week number (the frontend's "W43"). */
export const isoWeek = (iso: string): number => {
  const thursday = dateToUtcMs(iso) + (3 - weekdayOf(iso)) * DAY_MS;
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return 1 + Math.floor((thursday - yearStart) / (7 * DAY_MS));
};

/** A @db.Date column value as "YYYY-MM-DD". */
export const fromDbDate = (d: Date): string => d.toISOString().slice(0, 10);

/** "YYYY-MM-DD" as a value for a @db.Date column. */
export const toDbDate = (iso: string): Date => new Date(dateToUtcMs(iso));

/** Mondays of the `count` weeks ending with the week of `lastMonday`, oldest first. */
export const weekStarts = (lastMonday: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => addDays(lastMonday, (i - count + 1) * 7));

/* ---------- clock times ("HH:MM") ---------- */

export const HM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const toMin = (hm: string): number => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

export const fromMin = (min: number): string => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
