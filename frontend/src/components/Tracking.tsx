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

/**
 * The big "Track time" button on Today.
 * - While one of your meetings is open for clock-in (10 min before it starts until it ends): clocks you in to it.
 * - Otherwise: starts a work timer (in the hub) on your project; it shows in the hours card, where you stop and log it.
 * Once clicked, the button turns into a running timer with "Stop and log" (a meeting being tracked shows the
 * tracking banner below instead).
 */
export function TrackMeetingButton() {
  const { state, dispatch, me, flash } = useStore();
  const live = useLiveMeeting();
  const { start } = useTrackingActions();
  const timer = state.workTimer && state.workTimer.memberId === me.id ? state.workTimer : null;
  const elapsed = useElapsed(timer?.startedAt ?? null);
  if (state.tracking) return null;

  if (timer) {
    const name = state.projects.find((p) => p.id === timer.projectId)?.name ?? '';
    const clock = `${pad(Math.floor(elapsed / 3600))}:${pad(Math.floor((elapsed % 3600) / 60))}:${pad(elapsed % 60)}`;
    const stopWork = () => {
      const end = nowHM();
      dispatch({ type: 'stopWork', end });
      flash(`Logged ${timer.at} – ${end} on ${name}`);
    };
    return (
      <div className="track-timer" role="timer" aria-label={`Tracking time on ${name} for ${durText(Math.floor(elapsed / 60))}`}>
        <span className="track-dot" aria-hidden="true" />
        <span className="stack" style={{ gap: 0 }}>
          <span className="track-clock">{clock}</span>
          <span className="tiny" style={{ color: 'var(--on-dark-muted)' }}>{name} · since {timer.at}</span>
        </span>
        <button type="button" className="btn btn-light btn-sm" onClick={stopWork}>Stop and log</button>
      </div>
    );
  }

  const series = live ? state.series.find((s) => s.id === live.seriesId) : undefined;
  const active = state.projects.filter((p) => p.status === 'active');
  const project = active.find((p) => p.lead === me.id || p.members.includes(me.id)) ?? active.find((p) => p.id === 'ops') ?? active[0];

  const onClick = () => {
    if (live) return start(live);
    if (!project) return flash('There is no active project to track time on.');
    const where = !state.network.checked || state.network.atHub ? 'hub' : 'remote';
    dispatch({ type: 'startWork', timer: { memberId: me.id, projectId: project.id, at: nowHM(), startedAt: Date.now(), location: where } });
    flash(`Tracking time on ${project.name}, ${where === 'hub' ? 'in the hub' : 'remote'}.`);
  };

  return (
    <button
      type="button" className="btn btn-primary" style={{ minHeight: 48, fontSize: 15, fontWeight: 700 }}
      title={live ? `Clock in to ${series?.name ?? 'the meeting'}` : project ? `Start a timer on ${project.name}` : undefined}
      onClick={onClick}
    >
      {Icon.clock}
      {live ? `Track ${series?.name ?? 'meeting'}` : 'Track time'}
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
          <span className="small" style={{ color: 'var(--on-dark-muted)' }}>Tracking · {t.mode === 'present' ? 'in person' : 'remote'} · clocked in {t.at}</span>
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
