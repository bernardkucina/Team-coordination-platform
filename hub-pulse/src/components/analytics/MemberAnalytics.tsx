'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS } from '@/lib/types';
import { MAJA_PROJECTS } from '@/lib/data';
import { attendanceStats, meetingPhase, weekHours } from '@/lib/rules';
import { dayLabel, hoursText } from '@/lib/time';
import { ColumnChart, Kpi, Progress, Segmented } from '../ui';
import { STATUS_LOOK } from '../Meetings';

type Period = '8w' | 'year' | 'all';

/** Hours per project before this app existed. Only the demo member has history. */
const SPLIT: Record<Period, [string, number][]> = {
  '8w': [['Academy Project', 52], ['Hub Operations', 17], ['Climate Talks 2026', 5]],
  year: [['Academy Project', 118], ['Climate Talks 2026', 72], ['Hub Operations', 61]],
  all: [['Academy Project', 118], ['Hub Operations', 98], ['Climate Talks 2026', 72], ['Mentorship Programme 2025', 48], ['Fundraising Gala 2025', 39]],
};

const PERIOD_LABEL: Record<Period, string> = { '8w': 'since 31 August', year: 'since 1 January 2026', all: 'since March 2025' };

export function MemberAnalytics() {
  const { state, me } = useStore();
  const [period, setPeriod] = useState<Period>('8w');
  const [excuseSent, setExcuseSent] = useState<string[]>([]);

  const commitment = TIER_HOURS[me.tier];
  const weeks = [...me.pastWeeks, weekHours(state.timeEntries, me.id)];
  const split = SPLIT[period];
  const total = split.reduce((a, [, h]) => a + h, 0);
  const top = split[0];
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
          <span className="kicker">{me.name} · member since {me.since}</span>
          <h1>My analytics</h1>
        </div>
        <Segmented label="Period" value={period} onChange={setPeriod} options={[{ value: '8w', label: 'Last 8 weeks' }, { value: 'year', label: 'This year' }, { value: 'all', label: 'All time' }]} />
      </header>

      <section className="kpis" aria-label="Summary">
        <Kpi label="Hours logged" value={hoursText(total)} note={PERIOD_LABEL[period]} />
        <Kpi label="Most time on" value={<span style={{ fontSize: 22 }}>{top[0]}</span>} note={`${hoursText(top[1])} · ${Math.round((top[1] / total) * 100)} % of your time`} />
        <Kpi label="Weeks at commitment" value={`${metWeeks} of ${me.pastWeeks.length}`} note={`full weeks · ${commitment} h each`} />
        <Kpi label="Meeting attendance" value={stats.rate === null ? '—' : `${stats.rate} %`} note="in person or remote" />
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
              key: String(i), label: current ? `W${36 + i} now` : `W${36 + i}`, value: h, valueText: String(Math.round(h * 10) / 10).replace('.', ','),
              tip: `Week ${36 + i}${current ? ', in progress' : ''}: ${hoursText(h)} · ${h >= commitment ? 'commitment met' : `${hoursText(commitment - h)} short`}`,
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
                <span><strong>{hoursText(h)}</strong> · {Math.round((h / total) * 100)} %</span>
              </div>
              <Progress value={h} max={top[1]} large />
            </div>
          ))}
        </section>
        <section className="card" aria-labelledby="pp-h" style={{ flex: '1 1 420px', minWidth: 0 }}>
          <h2 id="pp-h">My projects</h2>
          <ul className="list">
            {MAJA_PROJECTS.map((p) => (
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
              const sent = excuseSent.includes(m.id);
              return (
                <li key={m.id} className="inline" style={{ gap: '10px 12px' }}>
                  <span className="small muted" style={{ width: 96, fontWeight: 600 }}>{dayLabel(m.date)}</span>
                  <span style={{ flex: '1 1 180px', fontWeight: 600, fontSize: 14 }}>{state.series.find((s) => s.id === m.seriesId)?.name}</span>
                  <span className={`pill ${sent ? 'neutral' : look.cls}`}>{sent ? 'Reason sent to admin' : status === 'missed' ? 'Missed · not excused' : status === 'excused' ? 'Missed · excused' : look.label}</span>
                  {status === 'missed' && !sent ? (
                    <button type="button" className="btn btn-quiet btn-sm" style={{ color: 'var(--blue)' }} onClick={() => setExcuseSent([...excuseSent, m.id])}>Add a reason</button>
                  ) : null}
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
