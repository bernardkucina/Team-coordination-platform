'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { meetingPhase } from '@/lib/rules';
import { DEMO_TODAY, addDays, dayLabel, durText, toMin, whenText } from '@/lib/time';
import type { AttendanceStatus, Meeting } from '@/lib/types';
import { ReminderToggle } from './MeetingReminder';
import { useTrackingActions } from './Tracking';
import { Icon } from './ui';

export const STATUS_LOOK: Record<AttendanceStatus, { label: string; cls: string; solid: string; text: string }> = {
  present: { label: 'Present', cls: 'good', solid: '#184897', text: '#fff' },
  remote: { label: 'Remote', cls: 'info', solid: '#3d7ce1', text: '#fff' },
  excused: { label: 'Excused', cls: 'warn', solid: '#f2b253', text: '#0a133c' },
  missed: { label: 'Missed', cls: 'bad', solid: '#c22222', text: '#fff' },
};

const duration = (m: Meeting) => durText(toMin(m.end) - toMin(m.start));

/** Today never lists more than this many meetings. */
const MAX_MEETINGS = 3;

/**
 * Meetings from the calendar. Members see "My meetings": their next meetings (happening now first), at most 3.
 * Admins see today's meetings for everyone, to record attendance. Click a meeting to open it: track your time,
 * say you can't come, or (admins) record attendance.
 */
export function TodayMeetings() {
  const { state, me, isAdmin, syncCalendar } = useStore();
  const { start, stop } = useTrackingActions();
  const [syncing, setSyncing] = useState(false);
  const invited = (m: Meeting) => !!state.series.find((s) => s.id === m.seriesId)?.invited.includes(me.id);
  const all = state.meetings
    .filter((m) => (isAdmin ? m.date === DEMO_TODAY : invited(m) && m.date >= DEMO_TODAY && meetingPhase(m) !== 'past'))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const today = all.slice(0, MAX_MEETINGS);
  const [openId, setOpenId] = useState<string | null>(() => today.find((m) => meetingPhase(m) === 'live')?.id ?? null);
  const calendar = state.calendar;

  const sync = async () => {
    setSyncing(true);
    await syncCalendar();
    setSyncing(false);
  };

  return (
    <section className="card" aria-labelledby="meet-h">
      <div className="between">
        <h2 id="meet-h">{isAdmin ? 'Today\'s meetings' : 'My meetings'}</h2>
        {isAdmin && calendar?.configured ? (
          <span className="inline tiny muted" style={{ gap: 8 }}>
            {calendar.error ? <span style={{ color: 'var(--bad)' }}>Calendar sync failed</span>
              : calendar.syncedAt ? <span>Google Calendar · synced {whenText(calendar.syncedAt)}</span> : <span>Google Calendar · not synced yet</span>}
            <button type="button" className="btn btn-outline btn-sm" disabled={syncing} onClick={() => void sync()}>{syncing ? 'Syncing…' : 'Sync now'}</button>
          </span>
        ) : (
          <span className="tiny muted">from Google Calendar · click a meeting to open it</span>
        )}
      </div>
      {today.length === 0 ? <p className="small muted" style={{ margin: 0 }}>{isAdmin ? 'No meetings today.' : 'No meetings coming up.'}</p> : null}
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
            <li key={m.id} style={{ borderRadius: 12, border: `1px solid ${live || open ? '#99b3de' : 'var(--line)'}`, background: live ? '#f5f8fd' : '#fff' }}>
              <button
                type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : m.id)}
                className="inline" style={{ width: '100%', gap: '12px 16px', padding: 14, border: 0, background: 'transparent', textAlign: 'left', color: 'var(--ink)' }}
              >
                <span className="stack" style={{ gap: 0, minWidth: 80 }}>
                  {m.date !== DEMO_TODAY ? <span className="tiny strong muted">{dayLabel(m.date)}</span> : null}
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
                  : phase === 'upcoming' ? <span className="small muted">{m.date === DEMO_TODAY ? 'Later today' : 'Coming up'}</span>
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
                        <CantCome meeting={m} />
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
      <ReminderToggle />
      {all.length > today.length ? (
        <span className="tiny muted">
          {all.length - today.length} more {isAdmin ? 'today, see' : 'coming up'}{isAdmin ? <> <Link href="/team?tab=attendance">Team › Attendance</Link></> : null}
        </span>
      ) : null}
    </section>
  );
}

/** Before a meeting: "Can't come" with an optional reason, or take it back. */
function CantCome({ meeting }: { meeting: Meeting }) {
  const { state, dispatch, me, flash } = useStore();
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const rec = state.attendance.find((r) => r.meetingId === meeting.id && r.memberId === me.id);

  if (rec?.status === 'excused') {
    return (
      <>
        <span className="small">You said you can&apos;t come{rec.reason ? `: ${rec.reason}` : ''}.</span>
        {rec.source === 'self' ? (
          <button
            type="button" className="btn btn-outline btn-sm"
            onClick={() => { dispatch({ type: 'unexcuseSelf', meetingId: meeting.id, memberId: me.id }); flash('Glad you can make it'); }}
          >I can come after all</button>
        ) : null}
      </>
    );
  }
  if (!asking) {
    return (
      <>
        <span className="small muted">Clock-in opens 10 minutes before {meeting.start}.</span>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setAsking(true)}>Can&apos;t come</button>
      </>
    );
  }
  const send = () => {
    dispatch({ type: 'setAttendance', meetingId: meeting.id, memberId: me.id, status: 'excused', source: 'self', reason: reason.trim() || undefined });
    flash('Thanks for letting us know');
    setAsking(false);
    setReason('');
  };
  return (
    <>
      <label className="sr-only" htmlFor={`why-${meeting.id}`}>Why can&apos;t you come? (optional)</label>
      <input
        id={`why-${meeting.id}`} className="field" style={{ flex: '1 1 200px' }} placeholder="Why? (optional)" value={reason} autoFocus
        onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()}
      />
      <button type="button" className="btn btn-primary btn-sm" onClick={send}>Send</button>
      <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAsking(false)}>Cancel</button>
    </>
  );
}

/**
 * After a meeting you did not clock in to: did you attend, and how? Shown for a week, at most 3 at a time,
 * until you answer or an admin records you.
 */
export function DidYouAttend() {
  const { state, dispatch, me, flash } = useStore();
  const [absentFor, setAbsentFor] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const weekAgo = addDays(DEMO_TODAY, -7);
  const open = state.meetings
    .filter((m) => meetingPhase(m) === 'past' && m.date >= weekAgo)
    .filter((m) => state.series.find((s) => s.id === m.seriesId)?.invited.includes(me.id))
    .filter((m) => !state.attendance.some((r) => r.meetingId === m.id && r.memberId === me.id))
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start))
    .slice(0, MAX_MEETINGS);
  if (!open.length) return null;

  const answer = (m: Meeting, value: 'present' | 'remote' | 'absent', why?: string) => {
    dispatch({ type: 'reportAttendance', meetingId: m.id, memberId: me.id, answer: value, reason: why });
    flash(value === 'absent' ? 'Thanks, your reason was sent' : 'Thanks, attendance saved');
    setAbsentFor(null);
    setReason('');
  };

  return (
    <section className="card" aria-labelledby="dya-h">
      <h2 id="dya-h">Did you attend?</h2>
      <ul className="list">
        {open.map((m) => {
          const series = state.series.find((s) => s.id === m.seriesId);
          return (
            <li key={m.id} className="stack" style={{ gap: 8, padding: '10px 0' }}>
              <span className="inline" style={{ gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{series?.name}</span>
                <span className="small muted">{dayLabel(m.date)}, {m.start}</span>
              </span>
              {absentFor === m.id ? (
                <span className="inline" style={{ gap: 6 }}>
                  <label className="sr-only" htmlFor={`absent-${m.id}`}>Why couldn&apos;t you come?</label>
                  <input
                    id={`absent-${m.id}`} className="field" style={{ flex: '1 1 220px' }} placeholder="Why couldn't you come?" value={reason} autoFocus
                    onChange={(e) => setReason(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reason.trim() && answer(m, 'absent', reason.trim())}
                  />
                  <button type="button" className="btn btn-primary btn-sm" disabled={!reason.trim()} onClick={() => answer(m, 'absent', reason.trim())}>Send</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setAbsentFor(null)}>Cancel</button>
                </span>
              ) : (
                <span className="inline" role="group" aria-label={`Did you attend ${series?.name ?? 'the meeting'}?`} style={{ gap: 6 }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => answer(m, 'present')}>In person</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => answer(m, 'remote')}>Online</button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setAbsentFor(m.id); setReason(''); }}>I didn&apos;t attend</button>
                </span>
              )}
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
                    {rec?.source === 'self' ? (rec.at ? `Clocked in at ${rec.at}` : 'Answered themselves') : rec ? 'Marked by admin' : 'Not marked yet'}
                    {rec?.reason ? ` · "${rec.reason}"` : ''}
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
