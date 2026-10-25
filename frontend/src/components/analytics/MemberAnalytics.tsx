'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS } from '@/lib/types';
import { attendanceStats, currentMonthDays, dailyHours, isSuperstar, memberWeeks, meetingPhase } from '@/lib/rules';
import { CURRENT_WEEK, DEMO_TODAY, WEEK_PACE, dateInWeek, dayLabel, hoursText, longDate, shortDate, toMin, weekdayOf } from '@/lib/time';
import { ColumnChart, Kpi, Progress, Segmented } from '../ui';
import { Leaderboards } from './Leaderboards';
import { STATUS_LOOK } from '../Meetings';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const num = (h: number) => String(Math.round(h * 10) / 10).replace('.', ',');

/** A member's own numbers: hours, commitment, tasks, attendance, and hub vs remote. */
export function MemberAnalytics() {
  const { state, me } = useStore();
  const [excuseSent, setExcuseSent] = useState<string[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('month');

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
  let bestRun = 0;
  for (let i = 0, run = 0; i < finished.length; i++) { run = finished[i].hours >= commitment ? run + 1 : 0; bestRun = Math.max(bestRun, run); }
  const expectedNow = commitment * WEEK_PACE;
  const perDay = dailyHours(me, state.timeEntries);
  const monthDays = currentMonthDays();
  const monthName = longDate(DEMO_TODAY).split(' ').slice(-1)[0];
  const monthTotal = monthDays.reduce((a, d) => a + (perDay.get(d)?.hub ?? 0) + (perDay.get(d)?.remote ?? 0), 0);
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
          <h1>My pulse</h1>
        </div>
        <span className="small muted">Last {weeks.length} weeks, from {shortDate(dateInWeek(weeks[0].week, 0))}</span>
      </header>

      <div className="between" style={{ alignItems: 'center', gap: 20 }}>
        <dl className="stat-strip" aria-label="Summary">
          <div><dt>Logged</dt><dd>{hoursText(totalHours)}</dd></div>
          <div><dt>Commitment met</dt><dd>{metWeeks} of {finished.length} weeks</dd></div>
          <div><dt>Meetings</dt><dd>{stats.rate === null ? '—' : `${stats.rate} %`}</dd></div>
        </dl>
        <div className="streak-box" aria-label="Weekly streak">
          <div className="stack" style={{ gap: 2 }}>
            <span className="streak-count">🚀 {streak} {streak === 1 ? 'week' : 'weeks'} in a row{streak > 0 ? ' 🔥' : ''}</span>
            {isSuperstar(current.hours, me) ? <span className="superstar">⭐ Superstar this week</span> : null}
            <span className="tiny muted">{streak > 0 ? `You met your ${commitment} h every week since W${CURRENT_WEEK - streak}.` : `Best run: ${bestRun} weeks. Hit ${commitment} h this week to start a new one.`}</span>
          </div>
          <ol className="streak-weeks">
            {weeks.map((w) => (
              <li key={w.week} className={w.current ? 'now' : w.hours >= commitment ? 'met' : 'miss'} title={`W${w.week}: ${hoursText(w.hours)} of ${commitment} h${w.current ? ', in progress' : ''}`}>
                <span>W{w.week}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <Leaderboards />

      <section className="card" aria-labelledby="hw-h">
        <div className="between">
          <div className="inline" style={{ gap: 14 }}>
            <h2 id="hw-h">{period === 'week' ? 'Hours per week, in the hub and remote' : `Hours per day in ${monthName}: ${hoursText(monthTotal)}`}</h2>
            <Segmented label="Group hours by" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Weeks' }, { value: 'month', label: 'Month' }]} />
          </div>
          <span className="inline small muted" style={{ gap: 14 }}>
            <span className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--hub)' }} />In the hub</span>
            <span className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--remote)' }} />Remote</span>
            {period === 'week' ? <span className="legend"><span className="dash" />Commitment ({commitment} h)</span> : null}
          </span>
        </div>
        {period === 'week' ? (
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
        ) : (
          <ColumnChart
            columns={monthDays.map((d) => {
              const v = perDay.get(d) ?? { hub: 0, remote: 0 };
              const total = v.hub + v.remote;
              const future = d > DEMO_TODAY;
              return {
                key: d,
                label: String(Number(d.slice(8))),
                value: total,
                valueText: total ? num(Math.round(total * 2) / 2) : '',
                current: d === DEMO_TODAY,
                parts: [{ value: v.hub, color: 'var(--hub)' }, { value: v.remote, color: 'var(--remote)' }],
                tip: `${dayLabel(d)}${weekdayOf(d) > 4 ? ' (weekend)' : ''}: ${future ? 'not yet' : total ? `${hoursText(total)} (${hoursText(v.hub)} hub, ${hoursText(v.remote)} remote)` : 'no hours'}`,
              };
            })}
          />
        )}
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

        <section className="card" aria-labelledby="mt-h" style={{ flex: '1 1 420px', minWidth: 0 }}>
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

      </div>
    </>
  );
}
