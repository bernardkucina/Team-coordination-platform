import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifySlackSignature } from './interactions';
import { addedMessage, dailySummaryMessage, followupMessage, monthlyMessage, reminderMessage } from './blocks';

const sign = (body: string, ts: string, secret = 'shh') => `v0=${createHmac('sha256', secret).update(`v0:${ts}:${body}`).digest('hex')}`;

describe('Slack signature', () => {
  const body = 'payload=%7B%7D';
  const ts = '1792860000';

  it('accepts a correct, fresh signature', () => {
    expect(verifySlackSignature(body, ts, sign(body, ts), 'shh', 1792860010)).toBe(true);
  });

  it('rejects a wrong secret, a changed body and an old timestamp', () => {
    expect(verifySlackSignature(body, ts, sign(body, ts, 'other'), 'shh', 1792860010)).toBe(false);
    expect(verifySlackSignature(`${body}x`, ts, sign(body, ts), 'shh', 1792860010)).toBe(false);
    expect(verifySlackSignature(body, ts, sign(body, ts), 'shh', 1792860000 + 301)).toBe(false);
    expect(verifySlackSignature(body, undefined, sign(body, ts), 'shh')).toBe(false);
  });
});

describe('Slack messages', () => {
  it('reminder has clock-in buttons for the meeting', () => {
    const m = reminderMessage({ meetingId: 'community-20261026', series: 'Community', start: '18:00' }, 'https://x.app');
    expect(m.text).toBe('Community starts at 18:00, in 10 minutes.');
    expect(JSON.stringify(m.blocks)).toContain('"action_id":"clockin_present","value":"community-20261026"');
    expect(JSON.stringify(m.blocks)).toContain('https://x.app/today');
  });

  it('follow-up asks how you attended', () => {
    const ids = JSON.stringify(followupMessage({ meetingId: 'm1', series: 'Grants', when: 'Wed 28 Oct, 16:30' }).blocks);
    expect(ids).toContain('attend_present');
    expect(ids).toContain('attend_remote');
    expect(ids).toContain('attend_absent');
  });

  it('says who added you to what', () => {
    expect(addedMessage({ actor: 'Ana Kovač', role: 'owner', project: 'Grants', task: 'Write budget' }, 'https://x.app').text)
      .toBe('Ana Kovač made you the owner of Write budget in Grants.');
  });

  it('daily summary and monthly report carry the numbers', () => {
    const daily = JSON.stringify(dailySummaryMessage('23 October', [{ name: 'Grants', rows: [{ name: 'Eva', hours: 1.5 }, { name: 'Jan', hours: 2 }] }]).blocks);
    expect(daily).toContain('*Grants*: 3,5 h');
    const n = { hours: 40, commitment: 43, byProject: [{ name: 'Grants', hours: 40 }], hubHours: 30, remoteHours: 10, tasksDone: 2, meetings: { attended: 3, counted: 4 } };
    const monthly = JSON.stringify(monthlyMessage('September 2026', n, { ...n, members: 20 }).blocks);
    expect(monthly).toContain('40 h of 43 h committed (93 %)');
    expect(monthly).toContain('3 of 4 attended (75 %)');
    expect(monthly).toContain('The hub in September 2026');
  });
});
