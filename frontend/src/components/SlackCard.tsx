'use client';

import { useEffect, useState } from 'react';
import type { SlackRunRequest, SlackStatus } from '@hub-pulse/shared';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';

const JOBS: { job: SlackRunRequest['job']; label: string; done: (r: Record<string, unknown>) => string }[] = [
  { job: 'meetings', label: 'Schedule meeting messages', done: (r) => `${r.scheduled ?? 0} messages scheduled for ${r.meetings ?? 0} meetings` },
  { job: 'daily', label: "Send yesterday's summary", done: (r) => `Daily summary sent to ${r.sent ?? 0} project leads` },
  { job: 'monthly', label: 'Send monthly report', done: (r) => `Monthly report for ${r.month} sent to ${r.sent ?? 0} people` },
];

/**
 * Admin: is Slack connected, and run its jobs now (they also run on their own: meeting messages whenever the
 * calendar syncs, the daily summary every morning, the monthly report on the 1st).
 */
export function SlackCard() {
  const { flash } = useStore();
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.slackStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  if (!status) return null;

  const run = async (job: (typeof JOBS)[number]) => {
    setBusy(job.job);
    try {
      flash(job.done(await api.slackRun(job.job)));
      setStatus(await api.slackStatus());
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Slack failed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="card" aria-labelledby="slack-h">
      <div className="between">
        <h2 id="slack-h">Slack</h2>
        <span className={`pill ${status.configured ? 'good' : 'neutral'}`}>{status.configured ? 'Connected' : 'Not connected'}</span>
      </div>
      {status.configured ? (
        <>
          <span className="small muted">
            {status.linked} of {status.members} members linked to Slack{status.interactive ? '' : ' · buttons in Slack need SLACK_SIGNING_SECRET'}.
            Reminders 10 min before meetings, &quot;did you attend?&quot; after, a daily summary for project leads and a monthly report.
          </span>
          <div className="inline" style={{ gap: 8, justifyContent: 'flex-start' }}>
            {JOBS.map((j) => (
              <button key={j.job} type="button" className="btn btn-outline btn-sm" style={{ minHeight: 30, padding: '0 14px', fontSize: 12.5 }} disabled={busy !== null} onClick={() => void run(j)}>
                {busy === j.job ? 'Working…' : j.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <span className="small muted">Slack is optional. Set SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET to send reminders and reports.</span>
      )}
    </section>
  );
}
