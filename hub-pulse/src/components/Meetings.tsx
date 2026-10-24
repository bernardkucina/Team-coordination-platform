'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { meetingPhase } from '@/lib/rules';
import { DEMO_TODAY, addDays, dayLabel, durText, toMin } from '@/lib/time';
import type { AttendanceStatus, Meeting } from '@/lib/types';
import { useTrackingActions } from './Tracking';
import { Icon } from './ui';

export const STATUS_LOOK: Record<AttendanceStatus, { label: string; cls: string; solid: string; text: string }> = {
  present: { label: 'Present', cls: 'good', solid: 'var(--hub)', text: '#fff' },
  remote: { label: 'Remote', cls: 'info', solid: 'var(--blue-mid)', text: '#fff' },
  excused: { label: 'Excused', cls: 'warn', solid: 'var(--amber)', text: 'var(--ink)' },
  missed: { label: 'Missed', cls: 'bad', solid: 'var(--red)', text: '#fff' },
};

const duration = (m: Meeting) => durText(toMin(m.end) - toMin(m.start));

/**
 * Today's meetings from Google Calendar. Click a meeting to open it: track your time there,
 * and as an admin record everyone's attendance in the same place.
 */
export function TodayMeetings() {
  const { state, me, isAdmin } = useStore();
  const { start, stop } = useTrackingActions();
  const today = state.meetings
    .filter((m) => m.date === DEMO_TODAY && (isAdmin || state.series.find((s) => s.id === m.seriesId)?.invited.includes(me.id)))
    .sort((a, b) => a.start.localeCompare(b.start));
  const [openId, setOpenId] = useState<string | null>(() => today.find((m) => meetingPhase(m) === 'live')?.id ?? null);

  return (
    <section className="card" aria-labelledby="meet-h">
      <div className="between">
        <h2 id="meet-h">Today&apos;s meetings</h2>
        <span className="tiny muted">from Google Calendar · click a meeting to open it</span>
      </div>
      <ul className="stack" style={{ gap: 10 }}>
        {today.map((m) => {
          const series = state.series.find((s) => s.id === m.seriesId);
          const invited = !!series?.invited.includes(me.id);
          const rec = state.attendance.find((r) => r.meetingId === m.id && r.memberId === me.id);
          const phase = meetingPhase(m);
          const tracking = state.tracking?.meetingId === m.id && state.tracking.memberId === me.id;
          const live = phase === 'live';
          const open = openId === m.id;
          const marked = state.attendance.filter((r) => r.meetingId === m.id).length;
          return (
            <li key={m.id} style={{ borderRadius: 12, border: `1px solid ${live || open ? 'var(--ink)' : 'var(--line)'}`, background: live ? 'var(--surface-2)' : '#fff' }}>
              <button
                type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : m.id)}
                className="inline" style={{ width: '100%', gap: '12px 16px', padding: 14, border: 0, background: 'transparent', textAlign: 'left', color: 'var(--ink)' }}
              >
                <span className="stack" style={{ gap: 0, minWidth: 80 }}>
                  <span className="strong">{m.start}</span>
                  <span className="tiny muted">{duration(m)}</span>
                </span>
                <span className="stack" style={{ gap: 2, flex: '1 1 180px', minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{series?.name}</span>
                  <span className="tiny muted">
                    {series?.projectId ? state.projects.find((p) => p.id === series.projectId)?.name : 'Hub-wide'}
                    {isAdmin && phase !== 'upcoming' ? ` · ${marked} of ${series?.invited.length} marked${m.recorded ? ' · saved' : ''}` : ''}
                  </span>
                </span>
                {tracking ? <span className="pill dark">Tracking now</span>
                  : rec ? <span className={`pill ${STATUS_LOOK[rec.status].cls}`}>{STATUS_LOOK[rec.status].label}{rec.at ? ` · ${rec.at}` : ''}</span>
                  : live ? <span className="pill info">Happening now</span>
                  : phase === 'upcoming' ? <span className="small muted">Later today</span>
                  : <span className="pill neutral">Not marked yet</span>}
                <span aria-hidden="true" className="muted" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>›</span>
              </button>

              {open ? (
                <div className="stack" style={{ padding: '0 14px 14px', gap: 14 }}>
                  {invited ? (
                    <div className="inline" style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
                      {tracking ? (
                        <>
                          <span className="small">You are tracking this meeting since {state.tracking?.at}.</span>
                          <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 40 }} onClick={stop}>Stop and log hours</button>
                        </>
                      ) : live && !state.tracking ? (
                        <>
                          <button type="button" className="btn btn-primary" onClick={() => start(m)}>{Icon.clock}Track time</button>
                          <button type="button" className="btn btn-outline" onClick={() => start(m, 'remote')}>Joining remotely</button>
                          <span className="tiny muted">Clocks you in and logs the time when you stop.</span>
                        </>
                      ) : phase === 'upcoming' ? (
                        <span className="small muted">Clock-in opens 10 minutes before {m.start}.</span>
                      ) : rec ? (
                        <span className="small">You were marked <strong>{STATUS_LOOK[rec.status].label.toLowerCase()}</strong>{rec.at ? `, clocked in at ${rec.at}` : ''}.</span>
                      ) : (
                        <span className="small muted">This meeting has ended. An admin can still mark you.</span>
                      )}
                    </div>
                  ) : null}
                  {isAdmin && phase !== 'upcoming' ? <AttendanceRecorder meeting={m} embedded /> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Admin: mark who was there. People who clocked in themselves are already filled in. */
export function AttendanceRecorder({ meeting, embedded }: { meeting: Meeting; embedded?: boolean }) {
  const { state, dispatch, me, memberName, flash } = useStore();
  const series = state.series.find((s) => s.id === meeting.seriesId);
  if (!series) return null;
  const phase = meetingPhase(meeting);
  const records = state.attendance.filter((r) => r.meetingId === meeting.id);
  const marked = series.invited.filter((id) => records.some((r) => r.memberId === id)).length;
  const actions = phase !== 'upcoming' ? (
    <div className="inline">
      <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 40 }} onClick={() => dispatch({ type: 'fillPresent', meetingId: meeting.id })}>Mark the rest present</button>
      <button
        type="button" className="btn btn-primary btn-sm" style={{ minHeight: 40 }}
        onClick={() => { dispatch({ type: 'markRecorded', meetingId: meeting.id }); flash(`Attendance saved for ${series.name}`); }}
      >Save attendance</button>
    </div>
  ) : null;

  return (
    <section className={embedded ? 'stack' : 'card'} aria-labelledby={`rec-${meeting.id}`}>
      <div className="between" style={{ alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 4 }}>
          {embedded ? (
            <h3 id={`rec-${meeting.id}`}>Attendance</h3>
          ) : (
            <>
              {phase === 'live' ? <span className="pill info" style={{ alignSelf: 'flex-start' }}>Happening now · {meeting.start} to {meeting.end}</span> : null}
              <h2 id={`rec-${meeting.id}`}>{series.name}</h2>
            </>
          )}
          <span className="small muted">
            {embedded ? '' : `${dayLabel(meeting.date)}, ${meeting.start} · `}{marked} of {series.invited.length} marked · self clock-ins are filled in
            {meeting.recorded ? ' · saved' : ''}
          </span>
        </div>
        {actions}
      </div>
      {phase === 'upcoming' ? (
        <p className="small muted" style={{ padding: 14, borderRadius: 10, background: 'var(--surface-2)' }}>
          This meeting hasn&apos;t started. Members can clock in from 10 minutes before it starts.
        </p>
      ) : (
        <ul className="list">
          {series.invited.map((memberId) => {
            const rec = records.find((r) => r.memberId === memberId);
            return (
              <li key={memberId} className="inline" style={{ gap: '8px 12px', padding: '8px 0' }}>
                <span className="stack" style={{ gap: 2, flex: '1 1 140px', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{memberName(memberId)}{memberId === me.id ? ' (you)' : ''}</span>
                  <span className="tiny muted">
                    {rec?.source === 'self' ? `Clocked in at ${rec.at}` : rec ? 'Marked by admin' : 'Not marked yet'}
                  </span>
                </span>
                <div className="inline" role="group" aria-label={`Attendance for ${memberName(memberId)}`} style={{ gap: 4 }}>
                  {(Object.keys(STATUS_LOOK) as AttendanceStatus[]).map((st) => {
                    const on = rec?.status === st;
                    const look = STATUS_LOOK[st];
                    return (
                      <button
                        key={st} type="button" className="btn btn-sm" aria-pressed={on}
                        style={{ minHeight: 38, background: on ? look.solid : '#fff', color: on ? look.text : 'var(--ink)', borderColor: on ? look.solid : 'var(--field)' }}
                        onClick={() => dispatch({ type: 'setAttendance', meetingId: meeting.id, memberId, status: st, source: 'admin' })}
                      >{look.label}</button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Admin: what is coming up in the next 7 days, plus meetings that still need attendance. */
export function PlannedMeetings() {
  const { state } = useStore();
  const horizon = addDays(DEMO_TODAY, 7);
  const planned = state.meetings
    .filter((m) => meetingPhase(m) === 'upcoming' && m.date <= horizon)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const needs = state.meetings.filter((m) => meetingPhase(m) === 'past' && !m.recorded).length;

  return (
    <section className="card" aria-labelledby="plan-h">
      <div className="between">
        <h2 id="plan-h">Planned meetings</h2>
        <span className="tiny muted">next 7 days · Google Calendar</span>
      </div>
      <ul className="list">
        {planned.map((m) => {
          const s = state.series.find((x) => x.id === m.seriesId);
          return (
            <li key={m.id} className="inline" style={{ flexWrap: 'nowrap', gap: 12 }}>
              <span className="stack" style={{ gap: 0, width: 96, flex: 'none' }}>
                <span className="small strong">{dayLabel(m.date)}</span>
                <span className="tiny muted">{m.start}</span>
              </span>
              <span className="stack" style={{ gap: 2 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{s?.name}</span>
                <span className="tiny muted">{s?.invited.length} invited</span>
              </span>
            </li>
          );
        })}
      </ul>
      {needs > 0 ? (
        <Link href="/team?tab=attendance" className="between small strong" style={{ padding: 12, borderRadius: 10, background: 'var(--warn-bg)', color: 'var(--warn)', textDecoration: 'none' }}>
          {needs} past {needs === 1 ? 'meeting still needs' : 'meetings still need'} attendance <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </section>
  );
}
