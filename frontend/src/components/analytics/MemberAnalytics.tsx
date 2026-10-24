'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS } from '@/lib/types';
import { attendanceStats, entryMinutes, meetingPhase, weekHours } from '@/lib/rules';
import { CURRENT_WEEK, DEMO_TODAY, addDays, dayLabel, hoursText, shortDate } from '@/lib/time';
import { ColumnChart, Kpi, Progress, Segmented } from '../ui';
import { STATUS_LOOK } from '../Meetings';

type Period = '8w' | 'year' | 'all';

/** First day of each period. */
const periodStart = (period: Period): string =>
  period === '8w' ? addDays(DEMO_TODAY, -55) : period === 'year' ? `${DEMO_TODAY.slice(0, 4)}-01-01` : '0000-01-01';

export function MemberAnalytics() {
  const { state, me } = useStore();
  const [period, setPeriod] = useState<Period>('8w');

  const commitment = TIER_HOURS[me.tier];
  const weeks = [...me.pastWeeks, weekHours(state.timeEntries, me.id)];
  const week = (i: number) => CURRENT_WEEK - me.pastWeeks.length + i;
  const myEntries = state.timeEntries.filter((e) => e.memberId === me.id);
  const projectName = (id: string) => state.projects.find((p) => p.id === id)?.name ?? id;
  const hoursOn = (from: string) => {
    const byProject = new Map<string, number>();
    for (const e of myEntries) if (e.date >= from) byProject.set(e.projectId, (byProject.get(e.projectId) ?? 0) + entryMinutes(e) / 60);
    return [...byProject].map(([id, h]): [string, number] => [projectName(id), h]).sort((a, b) => b[1] - a[1]);
  };
  const split = hoursOn(periodStart(period));
  const total = split.reduce((a, [, h]) => a + h, 0);
  const top: [string, number] = split[0] ?? ['No hours yet', 0];
  const firstDate = myEntries.reduce((min, e) => (e.date < min ? e.date : min), DEMO_TODAY);
  const periodLabel = `since ${shortDate(period === 'all' ? firstDate : periodStart(period))}`;
  const pct = (h: number) => (total ? Math.round((h / total) * 100) : 0);

  // Tasks I finished in the period, and where my hours were worked (entries without a location are left out).
  const from = periodStart(period);
  const finished = state.tasks.filter((t) => t.owner === me.id && t.status === 'done' && !!t.doneAt && t.doneAt.slice(0, 10) >= from).length;
  const located = myEntries.filter((e) => e.date >= from && e.location);
  const hubHours = located.filter((e) => e.location === 'hub').reduce((a, e) => a + entryMinutes(e), 0) / 60;
  const remoteHours = located.filter((e) => e.location === 'remote').reduce((a, e) => a + entryMinutes(e), 0) / 60;
  const hubShare = hubHours + remoteHours ? Math.round((hubHours / (hubHours + remoteHours)) * 100) : null;

  // Projects I logged time on or own tasks in.
  const myProjects = state.projects
    .map((p) => {
      const entries = myEntries.filter((e) => e.projectId === p.id);
      const tasks = state.tasks.filter((t) => t.projectId === p.id && (t.owner === me.id || t.helpers.includes(me.id)));
      const first = entries.reduce((min, e) => (e.date < min ? e.date : min), DEMO_TODAY);
      return {
        name: p.name,
        when: entries.length ? `${shortDate(first)} to now` : 'no hours yet',
        role: [...new Set(tasks.map((t) => t.workstream))].join(', ') || 'Contributor',
        hours: Math.round(entries.reduce((a, e) => a + entryMinutes(e), 0) / 60),
        tasks: tasks.length,
        active: tasks.some((t) => t.status !== 'done' && t.status !== 'idea') || entries.some((e) => e.date >= addDays(DEMO_TODAY, -28)),
      };
    })
    .filter((p) => p.hours > 0 || p.tasks > 0)
    .sort((a, b) => b.hours - a.hours);
  const stats = attendanceStats(me.id, state.meetings, state.series, state.attendance);
  const metWeeks = me.pastWeeks.filter((h) => h >= commitment).length;

  const myMeetings = state.meetings
    .filter((m) => meetingPhase(m) === 'past' && state.series.find((s) => s.id === m.seriesId)?.invited.includes(me.id))
    .map((m) => ({ m, rec: state.attendance.find((r) => r.meetingId === m.id && r.memberId === me.id) }))
    .filter(({ m, rec }) => rec || m.recorded)
    .sort((a, b) => (b.m.date + b.m.start).localeCompare(a.m.date + a.m.start))
    .slice(0, 8);

  return (
    <>
      <header className="page-head">
        <div>
          <span className="kicker">{me.name}{me.since ? ` · member since ${me.since}` : ` · ${me.tier}`}</span>
          <h1>My analytics</h1>
        </div>
        <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: '8w', label: 'Last 8 weeks' }, { value: 'year', label: 'This year' }, { value: 'all', label: 'All time' }]} />
      </header>

      <section className="kpis" aria-label="Summary">
        <Kpi label="Hours logged" value={hoursText(total)} note={`${periodLabel} · most on ${top[0]}`} />
        <Kpi label="Tasks finished" value={finished} note={periodLabel} />
        <Kpi label="Meeting attendance" value={stats.rate === null ? '—' : `${stats.rate} %`} note={`${stats.present} in person · ${stats.remote} online`} />
        <Kpi
          label="In the hub vs remote" value={hubShare === null ? '—' : `${hubShare} % hub`}
          note={hubShare === null ? 'no locations logged yet' : `${hoursText(hubHours)} in the hub · ${hoursText(remoteHours)} remote`}
        />
        <Kpi label="Weeks at commitment" value={`${metWeeks} of ${me.pastWeeks.length}`} note={`full weeks · ${commitment} h each`} />
      </section>

      <section className="card" aria-labelledby="wk-h">
        <div className="between">
          <h2 id="wk-h">Hours per week</h2>
          <span className="legend"><span className="dash" />Commitment ({commitment} h)</span>
        </div>
        <ColumnChart
          refValue={commitment}
          columns={weeks.map((h, i) => {
            const current = i === weeks.length - 1;
            return {
              key: String(i), label: current ? `W${week(i)} now` : `W${week(i)}`, value: h, valueText: String(Math.round(h * 10) / 10).replace('.', ','),
              tip: `Week ${week(i)}${current ? ', in progress' : ''}: ${hoursText(h)} · ${h >= commitment ? 'commitment met' : `${hoursText(commitment - h)} short`}`,
              current,
            };
          })}
        />
      </section>

      <div className="row">
        <section className="card" aria-labelledby="bp-h" style={{ flex: '1 1 420px', minWidth: 0 }}>
          <h2 id="bp-h">Where my hours went</h2>
          {split.map(([name, h]) => (
            <div key={name} className="stack" style={{ gap: 6 }}>
              <div className="between small">
                <span style={{ fontWeight: 600 }}>{name}</span>
                <span><strong>{hoursText(h)}</strong> · {pct(h)} %</span>
              </div>
              <Progress value={h} max={top[1]} large />
            </div>
          ))}
        </section>
        <section className="card" aria-labelledby="pp-h" style={{ flex: '1 1 420px', minWidth: 0 }}>
          <h2 id="pp-h">My projects</h2>
          <ul className="list">
            {myProjects.map((p) => (
              <li key={p.name} className="inline" style={{ gap: '8px 12px' }}>
                <span className="stack" style={{ gap: 2, flex: '1 1 200px', minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span className="tiny muted">{p.when} · {p.role}</span>
                </span>
                <span className="small"><strong>{p.hours} h</strong> · {p.tasks} tasks</span>
                <span className={`pill ${p.active ? 'good' : 'neutral'}`}>{p.active ? 'Active' : 'Finished'}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="row">
        <section className="card" aria-labelledby="mt-h" style={{ flex: '3 1 520px', minWidth: 0 }}>
          <div className="between">
            <h2 id="mt-h">My meetings</h2>
            <span className="inline small muted" style={{ gap: 14 }}>
              <span>{stats.present} in person</span><span>{stats.remote} remote</span><span>{stats.excused} excused</span><span>{stats.missed} missed</span>
            </span>
          </div>
          <ul className="list">
            {myMeetings.map(({ m, rec }) => {
              const status = rec?.status ?? 'missed';
              const look = STATUS_LOOK[status];
              return (
                <li key={m.id} className="inline" style={{ gap: '10px 12px' }}>
                  <span className="small muted" style={{ width: 96, fontWeight: 600 }}>{dayLabel(m.date)}</span>
                  <span style={{ flex: '1 1 180px', fontWeight: 600, fontSize: 14 }}>{state.series.find((s) => s.id === m.seriesId)?.name}</span>
                  <span className={`pill ${look.cls}`}>{status === 'missed' ? 'Missed · not excused' : status === 'excused' ? 'Missed · excused' : look.label}</span>
                  {rec?.reason ? <span className="tiny muted">&ldquo;{rec.reason}&rdquo;</span> : null}
                </li>
              );
            })}
          </ul>
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
