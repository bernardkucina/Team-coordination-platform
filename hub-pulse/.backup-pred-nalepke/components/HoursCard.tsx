'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS, type Place } from '@/lib/types';
import { MEMBER_LOG_DAYS_BACK, entryMinutes, paceStatus, weekHours } from '@/lib/rules';
import { CURRENT_WEEK, DEMO_TODAY, addDays, dayLabel, durText, hoursText, nowHM, pad, toMin, weekOf } from '@/lib/time';
import { Icon, Progress, Segmented } from './ui';

const STATUS_TEXT = { met: 'Commitment met', 'on-track': 'On track', behind: 'Behind pace' } as const;

export function HoursCard({ title = 'Hours this week' }: { title?: string }) {
  const { state, dispatch, me, isAdmin, flash } = useStore();
  const [projectId, setProjectId] = useState(state.projects.filter((p) => p.status === 'active')[0].id);
  const [place, setPlace] = useState<Place>('hub');
  const [manualOpen, setManualOpen] = useState(false);
  const [daysBack, setDaysBack] = useState(0);
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const [manualError, setManualError] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editError, setEditError] = useState('');

  // Admins can fix the last week; members only today and yesterday.
  const maxBack = isAdmin ? 6 : MEMBER_LOG_DAYS_BACK;
  const commitment = TIER_HOURS[me.tier];
  const hours = weekHours(state.timeEntries, me.id);
  const status = paceStatus(hours, me);
  const oldestEditable = addDays(DEMO_TODAY, -maxBack);
  const timer = state.workTimer && state.workTimer.memberId === me.id ? state.workTimer : null;
  const elapsed = useElapsed(timer?.startedAt ?? null);
  const projectName = (id: string) => state.projects.find((p) => p.id === id)?.name ?? '';

  const mine = state.timeEntries
    .filter((e) => e.memberId === me.id && weekOf(e.date) === CURRENT_WEEK)
    .sort((a, b) => b.date.localeCompare(a.date) || toMin(b.start) - toMin(a.start));

  const startTimer = () => {
    dispatch({ type: 'startWork', timer: { memberId: me.id, projectId, place, at: nowHM(), startedAt: Date.now() } });
    flash(`Tracking time on ${projectName(projectId)}, ${place === 'hub' ? 'in the hub' : 'remote'}`);
  };

  const stopTimer = () => {
    if (!timer) return;
    const end = nowHM();
    dispatch({ type: 'stopWork', end });
    flash(`Logged ${timer.at} – ${end} on ${projectName(timer.projectId)}`);
  };

  const addManual = () => {
    if (!manualStart || !manualEnd || toMin(manualEnd) <= toMin(manualStart)) {
      setManualError('The end time has to be after the start time.');
      return;
    }
    const date = addDays(DEMO_TODAY, -daysBack);
    dispatch({ type: 'logTime', entry: { memberId: me.id, projectId, date, start: manualStart, end: manualEnd, note: '', source: 'manual', place } });
    flash(`Logged ${manualStart} – ${manualEnd} on ${projectName(projectId)}`);
    setManualOpen(false);
    setManualStart('');
    setManualEnd('');
  };

  const saveEdit = (id: number) => {
    if (!editStart || !editEnd || toMin(editEnd) <= toMin(editStart)) {
      setEditError('The end time has to be after the start time.');
      return;
    }
    dispatch({ type: 'editTime', id, start: editStart, end: editEnd });
    flash(`Time updated: ${editStart} – ${editEnd}`);
    setEditing(null);
  };

  return (
    <section className="card" aria-labelledby="hours-h">
      <div className="between">
        <h2 id="hours-h">{title}</h2>
        <span className="small strong" style={{ color: status === 'behind' ? 'var(--bad)' : 'var(--good)' }}>{STATUS_TEXT[status]}</span>
      </div>
      <div className="inline" style={{ alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.02em' }}>{hoursText(hours)}</span>
        <span className="muted">of {commitment} h</span>
      </div>
      <Progress value={hours} max={commitment} large />

      {timer ? (
        <div className="inline" style={{ justifyContent: 'space-between', padding: 14, borderRadius: 12, background: 'var(--navy)', color: '#fff' }}>
          <span className="stack" style={{ gap: 2 }}>
            <span className="tiny" style={{ color: '#b8c0db' }}>Tracking · {projectName(timer.projectId)} · {timer.place === 'hub' ? 'in the hub' : 'remote'} · since {timer.at}</span>
            <span style={{ fontSize: 26, fontWeight: 700 }}>{pad(Math.floor(elapsed / 3600))}:{pad(Math.floor((elapsed % 3600) / 60))}:{pad(elapsed % 60)}</span>
          </span>
          <button type="button" className="btn btn-light" onClick={stopTimer}>Stop and log</button>
        </div>
      ) : (
        <>
        <Segmented<Place> label="Where are you working" value={place} onChange={setPlace} options={[{ value: 'hub', label: 'In the hub' }, { value: 'remote', label: 'Remote' }]} />
        <div className="inline" style={{ flexWrap: 'nowrap' }}>
          <label className="sr-only" htmlFor="log-project">Project</label>
          <select id="log-project" className="field" style={{ flex: '1 1 auto', minWidth: 0, minHeight: 44 }} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {state.projects.filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button type="button" className="btn btn-primary" onClick={startTimer}>{Icon.clock}Track time</button>
        </div>
        </>
      )}

      {!manualOpen ? (
        <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start', color: 'var(--blue)' }} onClick={() => { setManualOpen(true); setManualError(''); }}>
          Forgot to track? Add time manually
        </button>
      ) : (
        <div className="stack" style={{ padding: 14, borderRadius: 12, background: 'var(--surface-2)' }}>
          <div className="inline" style={{ alignItems: 'flex-end' }}>
            {maxBack === 1 ? (
              <div className="seg" role="group" aria-label="Which day">
                <button type="button" aria-pressed={daysBack === 0} onClick={() => setDaysBack(0)}>Today</button>
                <button type="button" aria-pressed={daysBack === 1} onClick={() => setDaysBack(1)}>Yesterday</button>
              </div>
            ) : (
              <div className="field-group">
                <label className="label" htmlFor="log-day">Day</label>
                <select id="log-day" className="field" value={daysBack} onChange={(e) => setDaysBack(Number(e.target.value))}>
                  {Array.from({ length: maxBack + 1 }, (_, d) => <option key={d} value={d}>{dayLabel(addDays(DEMO_TODAY, -d))}</option>)}
                </select>
              </div>
            )}
            <div className="field-group">
              <label className="label" htmlFor="m-start">From</label>
              <input id="m-start" className="field" type="time" step={300} value={manualStart} onChange={(e) => { setManualStart(e.target.value); setManualError(''); }} />
            </div>
            <div className="field-group">
              <label className="label" htmlFor="m-end">To</label>
              <input id="m-end" className="field" type="time" step={300} value={manualEnd} onChange={(e) => { setManualEnd(e.target.value); setManualError(''); }} />
            </div>
          </div>
          <span className="tiny muted">On {projectName(projectId)}, {place === 'hub' ? 'in the hub' : 'remote'}. {isAdmin ? '' : 'You can add today or yesterday. For older days, ask an admin.'}</span>
          {manualError ? <span role="alert" className="tiny strong" style={{ color: 'var(--bad)' }}>{manualError}</span> : null}
          <div className="inline">
            <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 40 }} onClick={addManual}>Add time</button>
            <button type="button" className="btn btn-quiet btn-sm" style={{ minHeight: 40 }} onClick={() => setManualOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="stack" style={{ gap: 4, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
        <h3 style={{ fontSize: 14, marginBottom: 4 }}>Logged this week</h3>
        <ul>
          {state.tracking && state.tracking.memberId === me.id ? <RunningMeeting /> : null}
          {mine.map((e) => {
            const isNew = state.lastEntryId === e.id;
            const canEdit = e.date >= oldestEditable;
            const isEditing = editing === e.id;
            const project = projectName(e.projectId);
            return (
              <li key={e.id} style={{ padding: 10, margin: '0 -10px', borderRadius: 10, background: isNew ? '#f2fbf6' : 'transparent' }}>
                <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <span className="stack" style={{ gap: 3, minWidth: 0 }}>
                    <span className="inline" style={{ gap: 6 }}>
                      <span className="small" style={{ fontWeight: 600 }}>{project}{e.note ? ` · ${e.note}` : ''}</span>
                      {isNew ? <span className="pill good">Just logged</span> : null}
                    </span>
                    <span className="tiny muted">
                      {dayLabel(e.date)} · <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{e.start} – {e.end}</strong> · {e.source === 'meeting' ? 'tracked meeting' : 'work'} · {e.place === 'hub' ? 'in the hub' : 'remote'}
                    </span>
                  </span>
                  <span className="inline" style={{ gap: 4, flex: 'none', flexWrap: 'nowrap' }}>
                    <span className="small strong">{durText(entryMinutes(e))}</span>
                    {canEdit && !isEditing ? (
                      <button
                        type="button" className="btn btn-quiet btn-sm" style={{ color: 'var(--blue)' }}
                        aria-label={`Edit time for ${project}, ${e.start} to ${e.end}`}
                        onClick={() => { setEditing(e.id); setEditStart(e.start); setEditEnd(e.end); setEditError(''); }}
                      >Edit</button>
                    ) : null}
                    {!canEdit ? <span title="Too old to change yourself. Ask an admin." style={{ color: 'var(--faint)', width: 32, display: 'inline-flex', justifyContent: 'center' }} aria-label="Locked">{Icon.lock}</span> : null}
                  </span>
                </div>
                {isEditing ? (
                  <div className="inline" style={{ alignItems: 'flex-end', marginTop: 8 }}>
                    <div className="field-group">
                      <label className="label" htmlFor={`s-${e.id}`}>From</label>
                      <input id={`s-${e.id}`} className="field" type="time" step={300} value={editStart} onChange={(ev) => { setEditStart(ev.target.value); setEditError(''); }} />
                    </div>
                    <div className="field-group">
                      <label className="label" htmlFor={`e-${e.id}`}>To</label>
                      <input id={`e-${e.id}`} className="field" type="time" step={300} value={editEnd} onChange={(ev) => { setEditEnd(ev.target.value); setEditError(''); }} />
                    </div>
                    <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 40 }} onClick={() => saveEdit(e.id)}>Save</button>
                    <button type="button" className="btn btn-quiet btn-sm" style={{ minHeight: 40 }} onClick={() => setEditing(null)}>Cancel</button>
                    {editError ? <span role="alert" className="tiny strong" style={{ width: '100%', color: 'var(--bad)' }}>{editError}</span> : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function RunningMeeting() {
  const { state } = useStore();
  const t = state.tracking;
  const elapsed = useElapsed(t?.startedAt ?? null);
  if (!t) return null;
  const meeting = state.meetings.find((m) => m.id === t.meetingId);
  const series = state.series.find((s) => s.id === meeting?.seriesId);
  return (
    <li style={{ padding: 10, margin: '0 -10px', borderRadius: 10, background: '#f5f8fd' }}>
      <div className="between" style={{ flexWrap: 'nowrap' }}>
        <span className="stack" style={{ gap: 3 }}>
          <span className="inline" style={{ gap: 6 }}>
            <span className="small" style={{ fontWeight: 600 }}>Meeting: {series?.name}</span>
            <span className="pill info">Running</span>
          </span>
          <span className="tiny muted">Today · <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{t.at} – now</strong> · tracking meeting</span>
        </span>
        <span className="small strong">{durText(Math.floor(elapsed / 60))}</span>
      </div>
    </li>
  );
}

/** Seconds since `startedAt`, ticking every second. */
export function useElapsed(startedAt: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000));
}
