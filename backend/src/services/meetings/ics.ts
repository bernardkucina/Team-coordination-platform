/**
 * A small iCalendar (RFC 5545) reader: enough for the sandbox's meetings.ics and for Google Calendar's
 * export format (UTC or TZID times, folded lines, escaped text). Recurrence rules are not expanded.
 */
import { zonedToUtc } from '../../core/clock';

export interface CalendarEvent {
  uid: string;
  summary: string;
  description: string;
  location: string;
  categories: string[];
  start: Date;
  end: Date;
}

const unescapeText = (v: string): string =>
  v.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));

/** "20260914T160000Z", or a local time with a TZID parameter (the institute's zone when none is given). */
const parseDateTime = (value: string, params: Record<string, string>): Date => {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) throw new Error(`Unsupported date "${value}"`);
  const [, y, mo, d, h = '00', mi = '00', , z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
  if (params.TZID && params.TZID !== 'Europe/Ljubljana') {
    throw new Error(`Unsupported time zone "${params.TZID}"`);
  }
  return zonedToUtc(`${y}-${mo}-${d}`, `${h}:${mi}`);
};

export const parseIcs = (text: string): CalendarEvent[] => {
  // Unfold: a line starting with a space or tab continues the previous one.
  const lines = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: CalendarEvent[] = [];
  let current: Record<string, { value: string; params: Record<string, string> }> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (current?.UID && current.DTSTART) {
        const start = parseDateTime(current.DTSTART.value, current.DTSTART.params);
        events.push({
          uid: current.UID.value.trim(),
          summary: unescapeText(current.SUMMARY?.value ?? ''),
          description: unescapeText(current.DESCRIPTION?.value ?? ''),
          location: unescapeText(current.LOCATION?.value ?? ''),
          categories: (current.CATEGORIES?.value ?? '').split(/(?<!\\),/).map((c) => unescapeText(c).trim()).filter(Boolean),
          start,
          end: current.DTEND ? parseDateTime(current.DTEND.value, current.DTEND.params) : start,
        });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const [name, ...rawParams] = line.slice(0, colon).split(';');
    const params = Object.fromEntries(rawParams.map((p) => p.split('=') as [string, string]));
    current[name.toUpperCase()] = { value: line.slice(colon + 1), params };
  }
  return events;
};

/** The series an event belongs to: its first category, or the "Series: …" line of its description. */
export const seriesNameOf = (event: CalendarEvent): string | null =>
  event.categories[0] ?? /^Series:\s*(.+)$/m.exec(event.description)?.[1]?.trim() ?? null;

/** Member emails listed in the description ("Members: a@x, b@x"). */
export const memberEmailsOf = (event: CalendarEvent): string[] => {
  const line = /^Members:\s*(.+)$/m.exec(event.description)?.[1] ?? '';
  return line.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
};

/** "community-20260914@sandbox.example" → "community-20260914". */
export const meetingIdOf = (uid: string): string => uid.split('@')[0];
