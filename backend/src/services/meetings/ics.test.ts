import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { meetingIdOf, memberEmailsOf, parseIcs, seriesNameOf } from './ics';

const SAMPLE = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:grants-20260916@sandbox.example',
  'DTSTART:20260916T153000Z',
  'DTEND:20260916T163000Z',
  'SUMMARY:Grants meeting',
  'DESCRIPTION:Series: Grants\\nMembers: ana.kovac@sandbox.example, ma',
  ' ja.horvat@sandbox.example',
  'LOCATION:Institute\\, Ljubljana',
  'CATEGORIES:Grants',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:local-1@x',
  'DTSTART;TZID=Europe/Ljubljana:20261026T180000',
  'SUMMARY:Local time',
  'X-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

describe('parseIcs', () => {
  it('reads folded, escaped events', () => {
    const [grants] = parseIcs(SAMPLE);
    expect(grants.uid).toBe('grants-20260916@sandbox.example');
    expect(grants.location).toBe('Institute, Ljubljana');
    expect(grants.start.toISOString()).toBe('2026-09-16T15:30:00.000Z');
    expect(seriesNameOf(grants)).toBe('Grants');
    expect(memberEmailsOf(grants)).toEqual(['ana.kovac@sandbox.example', 'maja.horvat@sandbox.example']);
    expect(meetingIdOf(grants.uid)).toBe('grants-20260916');
  });

  it('reads TZID local times', () => {
    const local = parseIcs(SAMPLE)[1];
    expect(local.start.toISOString()).toBe('2026-10-26T17:00:00.000Z');
    expect(local.end).toEqual(local.start);
  });

  it('finds the Google Meet link', () => {
    const [grants, local] = parseIcs(SAMPLE);
    expect(grants.meetUrl).toBeNull();
    expect(local.meetUrl).toBe('https://meet.google.com/abc-defg-hij');
    const [inText] = parseIcs(
      ['BEGIN:VEVENT', 'UID:x@y', 'DTSTART:20261026T170000Z', 'DESCRIPTION:Join: https://meet.google.com/xyz-abcd-efg (video)', 'END:VEVENT'].join('\n'),
    );
    expect(inText.meetUrl).toBe('https://meet.google.com/xyz-abcd-efg');
  });

  it('reads the sandbox calendar', () => {
    const path = fileURLToPath(new URL('../../../../material/meetings.ics', import.meta.url));
    const events = parseIcs(readFileSync(path, 'utf8'));
    expect(events).toHaveLength(55);
    expect(new Set(events.map(seriesNameOf)).size).toBe(6);
  });
});
