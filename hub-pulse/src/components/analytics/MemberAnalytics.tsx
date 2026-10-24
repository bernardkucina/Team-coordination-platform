'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS } from '@/lib/types';
import { attendanceStats, memberWeeks, meetingPhase } from '@/lib/rules';
import { WEEK_PACE, dateInWeek, dayLabel, hoursText, shortDate } from '@/lib/time';
import { ColumnChart, Kpi, Progress } from '../ui';
import { STATUS_LOOK } from '../Meetings';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const num = (h: number) => String(Math.round(h * 10) / 10).replace('.', ',');

/** A member's own numbers: hours, commitment, tasks, attendance, and hub vs remote. */
export function MemberAnalytics() {
  const { state, me } = useStore();
  const [excuseSent, setExcuseSent] = useState<string[]>([]);

  const commitment = TIER_HOURS[me.tier];
  const weeks = memberWeeks(me, state.timeEntries, state.tasks);
  const current = weeks[weeks.length - 1];
  const finished = weeks.filter((w) => !w.current);
  const totalHours = weeks.reduce((a, w) => a + w.hours, 0);
  const totalHub = weeks.reduce((a, w) => a + w.hub, 0);
  const totalTasks = weeks.reduce((a, w) => a + w.tasksDone, 0);
  const metWeeks = finished.filter((w) => w.hours >= commitment).length;
  let streak = 0;
  for (let i = finished.length - 1; i >= 0 && finished[i].hours >= commitment; i--) streak++;
  const expectedNow = commitment * WEEK_PACE;
  const stats = attendanceStats(me.id, state.meetings, state.series, state.attendance);

  const recentlyDone = state.tasks
    .filter((t) => t.owner === me.id && t.doneAt)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
    .slice(0, 4);

  const seriesRates = state.series
    .filter((s) => s.invited.includes(me.id))
    .map((s) => ({ s, st: attendanceStats(me.id, state.meetings.filter((m) => m.seriesId === s.id), state.series, state.attendance) }))
    .filter(({ st }) => st.invited > 0);

  const myMeetings = state.meetings
    .filter((m) => meetingPhase(m) === 'past' && state.series.find((s) => s.id === m.seriesId)?.invited.includes(me.id))
    .map((m) => ({ m, rec: state.attendance.find((r) => r.meetingId === m.id && r.memberId === me.id) }))
    .filter(({ m, rec }) => rec || m.recorded)
    .sort((a, b) => (b.m.date + b.m.start).localeCompare(a.m.date + a.m.start))
    .slice(0, 6);

  return (
    <>
      <header className="page-head">
        <div>
          <span className="kicker">{me.name} · {me.tier} · {commitment} h a week</span>
          <h1>My analytics</h1>
        </div>
        <span className="small muted">Last {weeks.length} weeks, from {shortDate(dateInWeek(weeks[0].week, 0))}</span>
      </header>

      <section className="kpis" aria-label="Summary">
        <Kpi label="Hours logged" value={hoursText(totalHours)} note={`${hoursText(current.hours)} this week`} />
        <Kpi
          label="Weekly commitment"
          value={`${metWeeks} of ${finished.length} weeks`}
          note={streak > 1 ? `met · ${streak} weeks in a row` : 'met in full weeks'}
        />
        <Kpi label="Tasks finished" value={totalTasks} note={`${current.tasksDone} this week`} />
        <Kpi label="Meeting attendance" value={stats.rate === null ? '—' : `${stats.rate} %`} note={`${stats.present} in person · ${stats.remote} remote · ${stats.missed} missed`} />
        <Kpi label="Worked in the hub" value={`${pct(totalHub, totalHours)} %`} note={`${hoursText(totalHub)} in the hub · ${hoursText(totalHours - totalHub)} remote`} />
      </section>

      <section className="card" aria-labelledby="hw-h">
        <div className="between">
          <h2 id="hw-h">Hours per week, in the hub and remote</h2>
          <span className="inline small muted" style={{ gap: 14 }}>
            <span className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--hub)' }} />In the hub</span>
            <span className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--remote)' }} />Remote</span>
            <span className="legend"><span className="dash" />Commitment ({commitment} h)</span>
          </span>
        </div>
        <ColumnChart
          refValue={commitment}
          columns={weeks.map((w) => ({
            key: String(w.week),
            label: w.current ? `W${w.week} now` : `W${w.week}`,
            value: w.hours,
            valueText: num(w.hours),
            current: w.current,
            parts: [{ value: w.hub, color: 'var(--hub)' }, { value: w.remote, color: 'var(--remote)' }],
            tip: `Week ${w.week}${w.current ? ', in progress' : ''}: ${hoursText(w.hours)} (${hoursText(w.hub)} hub, ${hoursText(w.remote)} remote)`,
          }))}
        />
      </section>

      <div className="row">
        <section className="card" aria-labelledby="cm-h" style={{ flex: '1 1 420px', minWidth: 0 }}>
          <div className="between">
            <h2 id="cm-h">Weekly commitment</h2>
            <span className="small muted">{commitment} h a week</span>
          </div>
          <ul className="list">
            {[...weeks].reverse().map((w) => {
              const met = w.hours >= commitment;
              const onPace = w.current && w.hours >= expectedNow;
              const pill = w.current
                ? (met ? ['good', 'Met already'] : onPace ? ['info', 'On pace'] : ['bad', `${hoursText(expectedNow - w.hours)} behind pace`])
                : (met ? ['good', 'Met'] : ['bad', `${hoursText(commitment - w.hours)} short`]);
              return (
                <li key={w.week} className="inline" style={{ gap: '8px 14px', flexWrap: 'nowrap' }}>
                  <span className="small strong" style={{ width: 92, flex: 'none' }}>
                    W{w.week}{w.current ? <span className="muted" style={{ fontWeight: 500 }}> now</span> : null}
                  </span>
                  <span className="stack" style={{ gap: 4, flex: '1 1 auto', minWidth: 0 }}>
                    <span className="tiny muted">{hoursText(w.hours)} of {commitment} h</span>
                    <Progress value={w.hours} max={commitment} color={met ? 'var(--good-dot)' : undefined} />
                  </span>
                  <span className={`pill ${pill[0]}`}>{pill[1]}</span>
                </li>
              );
            })}
          </ul>
          <span className="tiny muted">This week you are expected to have {hoursText(expectedNow)} by today ({Math.round(WEEK_PACE * 100)} % of the week&apos;s working days).</span>
        </section>

        <section className="card" aria-labelledby="tk-h" style={{ flex: '1 1 380px', minWidth: 0 }}>
          <div className="between">
            <h2 id="tk-h">Tasks finished</h2>
            <span className="small muted">{totalTasks} in {weeks.length} weeks</span>
          </div>
          <ColumnChart
            height={110}
            columns={weeks.map((w) => ({
              key: String(w.week), label: `W${w.week}`, value: w.tasksDone, valueText: String(w.tasksDone), current: w.current,
              tip: `Week ${w.week}: ${w.tasksDone} task${w.tasksDone === 1 ? '' : 's'} finished`,
            }))}
          />
          <h3 style={{ marginTop: 4 }}>Recently finished</h3>
          {recentlyDone.length ? (
            <ul className="list">
              {recentlyDone.map((t) => (
                <li key={t.id} className="between small" style={{ flexWrap: 'nowrap' }}>
                  <span style={{ fontWeight: 600, minWidth: 0 }}>{t.title}</span>
                  <span className="muted" style={{ flex: 'none' }}>{t.doneAt ? dayLabel(t.doneAt) : ''}</span>
                </li>
              ))}
            </ul>
          ) : <p className="small muted">Nothing finished yet.</p>}
        </section>
      </div>

      <div className="row">
        <section className="card" aria-labelledby="mt-h" style={{ flex: '3 1 520px', minWidth: 0 }}>
          <div className="between">
            <h2 id="mt-h">Meeting attendance</h2>
            <span className="small muted">Excused absences don&apos;t count against you</span>
          </div>
          <div className="inline" style={{ gap: 2, height: 14 }} aria-hidden="true">
            {([['present', stats.present], ['remote', stats.remote], ['excused', stats.excused], ['missed', stats.missed]] as const).map(([k, n]) =>
              n ? <div key={k} style={{ height: '100%', flex: `${n} 1 0`, background: STATUS_LOOK[k].solid, borderRadius: 3 }} /> : null,
            )}
          </div>
          <div className="inline small" style={{ gap: 16 }}>
            {([['present', 'in person'], ['remote', 'remote'], ['excused', 'excused'], ['missed', 'missed']] as const).map(([k, label]) => (
              <span key={k} className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: STATUS_LOOK[k].solid }} /><strong>{stats[k]}</strong> {label}</span>
            ))}
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <h3>By meeting series</h3>
            {seriesRates.map(({ s, st }) => (
              <div key={s.id} className="inline" style={{ gap: 12, flexWrap: 'nowrap' }}>
                <span className="small" style={{ width: 140, flex: 'none', fontWeight: 600 }}>{s.name}</span>
                <div style={{ flex: '1 1 auto' }}><Progress value={st.rate ?? 0} max={100} /></div>
                <span className="small strong" style={{ width: 48, textAlign: 'right' }}>{st.rate === null ? '—' : `${st.rate} %`}</span>
              </div>
            ))}
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <h3>Recent meetings</h3>
            <ul className="list">
              {myMeetings.map(({ m, rec }) => {
                const status = rec?.status ?? 'missed';
                const sent = excuseSent.includes(m.id);
                return (
                  <li key={m.id} className="inline" style={{ gap: '8px 12px' }}>
                    <span className="small muted" style={{ width: 96 }}>{dayLabel(m.date)}</span>
                    <span style={{ flex: '1 1 160px', fontWeight: 600, fontSize: 14 }}>{state.series.find((s) => s.id === m.seriesId)?.name}</span>
                    <span className={`pill ${sent ? 'neutral' : STATUS_LOOK[status].cls}`}>
                      {sent ? 'Reason sent to admin' : status === 'missed' ? 'Missed · not excused' : status === 'excused' ? 'Missed · excused' : STATUS_LOOK[status].label}
                    </span>
                    {status === 'missed' && !sent ? (
                      <button type="button" className="btn btn-quiet btn-sm" style={{ color: 'var(--blue)' }} onClick={() => setExcuseSent([...excuseSent, m.id])}>Add a reason</button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section aria-labelledby="gm-h" className="card" style={{ flex: '2 1 300px', minWidth: 0, border: '2px dashed #a3b6d5', background: 'var(--surface-2)' }}>
          <span className="pill info" style={{ alignSelf: 'flex-start' }}>After the MVP</span>
          <h2 id="gm-h" style={{ fontSize: 18 }}>Streaks and recognition</h2>
          <p className="small" style={{ lineHeight: 1.5, color: 'var(--ink-2)' }}>
            Reserved for gamification once the core works: weeks in a row at your commitment, on-time clock-ins, and tasks you picked up yourself.
          </p>
        </section>
      </div>
    </>
  );
}
