'use client';

import { useStore } from '@/lib/store';
import { meetingPhase } from '@/lib/rules';
import { DEMO_TODAY, durText, nowHM, pad } from '@/lib/time';
import type { Meeting } from '@/lib/types';
import { useElapsed } from './HoursCard';
import { Icon } from './ui';

/** Meetings the current user is invited to that are open for clock-in right now. */
export function useLiveMeeting(): Meeting | undefined {
  const { state, me } = useStore();
  return state.meetings.find((m) => {
    const s = state.series.find((x) => x.id === m.seriesId);
    return m.date === DEMO_TODAY && meetingPhase(m) === 'live' && !!s?.invited.includes(me.id);
  });
}

export function useTrackingActions() {
  const { state, dispatch, me, flash } = useStore();
  const start = (meeting: Meeting, mode: 'present' | 'remote' = 'present') => {
    dispatch({ type: 'startTracking', tracking: { meetingId: meeting.id, memberId: me.id, mode, at: nowHM(), startedAt: Date.now() } });
    flash(mode === 'present' ? 'Clocked in. Tracking the meeting.' : 'Marked as remote. Tracking the meeting.');
  };
  const stop = () => {
    const t = state.tracking;
    if (!t) return;
    const meeting = state.meetings.find((m) => m.id === t.meetingId);
    const series = state.series.find((s) => s.id === meeting?.seriesId);
    const end = nowHM();
    dispatch({ type: 'stopTracking', end, projectId: series?.projectId ?? 'ops' });
    flash(`Logged ${t.at} – ${end} for ${series?.name ?? 'the meeting'}`);
  };
  return { start, stop };
}

export function TrackMeetingButton() {
  const { state } = useStore();
  const live = useLiveMeeting();
  const { start } = useTrackingActions();
  if (state.tracking) return null;
  return (
    <button
      type="button" className="btn btn-primary" style={{ minHeight: 48, fontSize: 15, fontWeight: 700 }}
      disabled={!live} title={live ? undefined : 'No meeting is happening right now'}
      onClick={() => live && start(live)}
    >
      {Icon.clock}
      Track meeting
    </button>
  );
}

export function TrackingBanner() {
  const { state, dispatch, me } = useStore();
  const { stop } = useTrackingActions();
  const t = state.tracking;
  const elapsed = useElapsed(t?.startedAt ?? null);
  if (!t || t.memberId !== me.id) return null;
  const meeting = state.meetings.find((m) => m.id === t.meetingId);
  const series = state.series.find((s) => s.id === meeting?.seriesId);
  const clock = `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`;
  return (
    <section className="card dark" aria-label="Meeting being tracked" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
      <div className="inline" style={{ gap: 14 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--good-dot)', boxShadow: '0 0 0 6px rgba(35,191,106,0.25)' }} />
        <span className="stack" style={{ gap: 2 }}>
          <span className="small" style={{ color: '#b8c0db' }}>Tracking · {t.mode === 'present' ? 'in person' : 'remote'} · clocked in {t.at}</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>{series?.name}</span>
        </span>
      </div>
      <div className="inline" style={{ gap: 12 }}>
        <span style={{ fontSize: 32, fontWeight: 700 }} aria-label={`Running for ${durText(Math.floor(elapsed / 60))}`}>{clock}</span>
        <button type="button" className="btn btn-ghost-dark" onClick={() => dispatch({ type: 'setTrackingMode', mode: t.mode === 'present' ? 'remote' : 'present' })}>
          {t.mode === 'present' ? "I'm remote" : "I'm in the room"}
        </button>
        <button type="button" className="btn btn-light" onClick={stop}>Stop and log hours</button>
      </div>
    </section>
  );
}
