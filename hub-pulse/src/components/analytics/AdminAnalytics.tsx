'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS, type AttendanceStatus, type Tier } from '@/lib/types';
import { attendanceStats, entryMinutes, paceStatus, weekHours } from '@/lib/rules';
import { CURRENT_WEEK, hoursText, weekOf } from '@/lib/time';
import { Avatar, ColumnChart, Kpi, Progress, Segmented } from '../ui';

const SERIES_COLORS: Record<AttendanceStatus, string> = { present: '#184897', remote: '#7fa6e8', excused: '#e3a93b', missed: '#c93a3a' };

export function AdminAnalytics() {
  const { state } = useStore();
  const [tier, setTier] = useState<Tier | 'all'>('all');
  const [hoverSeries, setHoverSeries] = useState<string | null>(null);

  const members = state.members.filter((m) => tier === 'all' || m.tier === tier);
  const withHours = members.map((m) => ({ m, hours: weekHours(state.timeEntries, m.id) }));
  const behind = withHours.filter(({ m, hours }) => paceStatus(hours, m) === 'behind')
    .sort((a, b) => a.hours / TIER_HOURS[a.m.tier] - b.hours / TIER_HOURS[b.m.tier]);
  const logged = withHours.reduce((a, x) => a + x.hours, 0);
  const committed = members.reduce((a, m) => a + TIER_HOURS[m.tier], 0);

  const allCommitted = state.members.reduce((a, m) => a + TIER_HOURS[m.tier], 0);
  const trend = Array.from({ length: 8 }, (_, i) => {
    const week = CURRENT_WEEK - 7 + i;
    const hours = i < 7
      ? state.members.reduce((a, m) => a + m.pastWeeks[i], 0)
      : state.members.reduce((a, m) => a + weekHours(state.timeEntries, m.id), 0);
    return { week, pct: Math.round((hours / allCommitted) * 100), current: i === 7 };
  });

  const byProject = state.projects.map((p) => ({
    name: p.name,
    hours: state.timeEntries.filter((e) => e.projectId === p.id && weekOf(e.date) === CURRENT_WEEK).reduce((a, e) => a + entryMinutes(e), 0) / 60,
  })).filter((p) => p.hours > 0).sort((a, b) => b.hours - a.hours);
  const projectTotal = byProject.reduce((a, p) => a + p.hours, 0);

  const seriesRows = state.series.map((s) => {
    const sum = { present: 0, remote: 0, excused: 0, missed: 0, invited: 0 };
    for (const id of s.invited) {
      const st = attendanceStats(id, state.meetings.filter((m) => m.seriesId === s.id), state.series, state.attendance);
      sum.present += st.present; sum.remote += st.remote; sum.excused += st.excused; sum.missed += st.missed; sum.invited += st.invited;
    }
    const pct = (n: number) => (sum.invited ? Math.round((n / sum.invited) * 100) : 0);
    return { s, parts: (['present', 'remote', 'excused', 'missed'] as AttendanceStatus[]).map((k) => ({ k, pct: pct(sum[k]) })), showed: pct(sum.present + sum.remote) };
  });

  const overall = (() => {
    const all = state.members.map((m) => attendanceStats(m.id, state.meetings, state.series, state.attendance));
    const showed = all.reduce((a, s) => a + s.present + s.remote, 0);
    const base = all.reduce((a, s) => a + s.invited - s.excused, 0);
    return base ? Math.round((showed / base) * 100) : 0;
  })();

  const doneThisWeek = state.tasks.filter((t) => t.status === 'done' && (t.history[0]?.when === 'just now' || (t.due !== null && weekOf(t.due) === CURRENT_WEEK))).length;
  const inValidation = state.tasks.filter((t) => t.status === 'validation').length;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="kicker">Week {CURRENT_WEEK} · Monday 19 to Sunday 25 October · 2 days left</span>
          <h1>How the hub is doing</h1>
        </div>
        <Segmented
          label="Tier" value={tier} onChange={setTier}
          options={[{ value: 'all', label: 'All tiers' }, ...(Object.keys(TIER_HOURS) as Tier[]).map((t) => ({ value: t, label: t }))]}
        />
      </header>

      <section className="kpis" aria-label="Key numbers">
        <Kpi label="On track this week" value={`${members.length - behind.length} of ${members.length}`} note="members at or above pace" />
        <Kpi label="Hours logged" value={hoursText(logged)} note={`of ${committed} h committed`} />
        <Kpi label="Attendance, last 8 weeks" value={`${overall} %`} note="in person or remote, excused not counted" />
        <Kpi label="Tasks finished this week" value={doneThisWeek} note={`${inValidation} waiting in Validation`} />
      </section>

      <div className="row">
        <section className="card" aria-labelledby="behind-h" style={{ flex: '3 1 520px', minWidth: 0 }}>
          <div className="between">
            <h2 id="behind-h">Behind this week</h2>
            <span className="small muted">Below 71 % of commitment, the pace for Friday</span>
          </div>
          <ul className="list">
            {behind.map(({ m, hours }) => (
              <li key={m.id} className="inline" style={{ gap: 12 }}>
                <Avatar initials={m.initials} />
                <span className="stack" style={{ gap: 2, flex: '1 1 140px' }}>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  <span className="tiny muted">{m.tier}</span>
                </span>
                <span className="stack" style={{ gap: 6, flex: '1 1 160px' }}>
                  <span className="small"><strong>{hoursText(hours)}</strong> of {TIER_HOURS[m.tier]} h · {hoursText(TIER_HOURS[m.tier] - hours)} to go</span>
                  <Progress value={hours} max={TIER_HOURS[m.tier]} />
                </span>
                <Link href="/team" className="btn btn-quiet btn-sm" style={{ textDecoration: 'none' }}>History</Link>
              </li>
            ))}
          </ul>
          {behind.length === 0 ? <p className="small muted">Everyone in this tier is on pace.</p> : null}
        </section>

        <section className="card" aria-labelledby="proj-h" style={{ flex: '2 1 320px', minWidth: 0 }}>
          <h2 id="proj-h">Hours by project, this week</h2>
          {byProject.map((p) => (
            <div key={p.name} className="stack" style={{ gap: 6 }}>
              <div className="between small"><span style={{ fontWeight: 600 }}>{p.name}</span><span><strong>{hoursText(p.hours)}</strong> · {Math.round((p.hours / projectTotal) * 100)} %</span></div>
              <Progress value={p.hours} max={byProject[0].hours} large />
            </div>
          ))}
          <h3 style={{ marginTop: 8 }}>By tier</h3>
          {(Object.keys(TIER_HOURS) as Tier[]).map((t) => {
            const ms = state.members.filter((m) => m.tier === t);
            const h = ms.reduce((a, m) => a + weekHours(state.timeEntries, m.id), 0);
            const c = ms.length * TIER_HOURS[t];
            return (
              <div key={t} className="stack" style={{ gap: 6 }}>
                <div className="between small"><span style={{ fontWeight: 600 }}>{t} · {TIER_HOURS[t]} h</span><span className="muted">{hoursText(h)} of {c} h · {ms.length} people</span></div>
                <Progress value={h} max={c} />
              </div>
            );
          })}
        </section>
      </div>

      <section className="card" aria-labelledby="trend-h">
        <div className="between">
          <h2 id="trend-h">Share of committed hours delivered</h2>
          <span className="legend"><span className="dash" />100 % of commitment</span>
        </div>
        <ColumnChart
          refValue={100} max={115}
          columns={trend.map((w) => ({
            key: String(w.week), label: w.current ? `W${w.week} (now)` : `W${w.week}`, value: w.pct, valueText: `${w.pct} %`,
            tip: `Week ${w.week}${w.current ? ', in progress' : ''}: ${w.pct} % of committed hours`, current: w.current,
          }))}
        />
      </section>

      <section className="card" aria-labelledby="series-h">
        <div className="stack" style={{ gap: 10 }}>
          <h2 id="series-h">Attendance by meeting series, last 8 weeks</h2>
          <div className="inline small muted" style={{ gap: 14 }}>
            {(['present', 'remote', 'excused', 'missed'] as AttendanceStatus[]).map((k) => (
              <span key={k} className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: SERIES_COLORS[k] }} />{k === 'present' ? 'In person' : k[0].toUpperCase() + k.slice(1)}</span>
            ))}
          </div>
        </div>
        <div className="stack" style={{ gap: 14 }}>
          {seriesRows.map(({ s, parts, showed }) => (
            <div key={s.id} className="inline" style={{ position: 'relative', gap: '8px 16px' }} onMouseEnter={() => setHoverSeries(s.id)} onMouseLeave={() => setHoverSeries(null)}>
              <span style={{ flex: '0 0 170px', fontWeight: 600, fontSize: 14 }}>{s.name}</span>
              <div style={{ flex: '1 1 220px', display: 'flex', gap: 2, height: 16 }}>
                {parts.map((p, i) => (
                  <div key={p.k} style={{ width: `${p.pct}%`, background: SERIES_COLORS[p.k], borderRadius: i === 0 ? '4px 0 0 4px' : i === parts.length - 1 ? '0 4px 4px 0' : 0 }} />
                ))}
              </div>
              <span className="small" style={{ flex: '0 0 96px', textAlign: 'right' }}><strong>{showed} %</strong> showed</span>
              {hoverSeries === s.id ? (
                <div className="tip" role="tooltip" style={{ right: 0, bottom: 'calc(100% + 4px)' }}>
                  {s.name} · {parts.map((p) => `${p.k} ${p.pct} %`).join(' · ')}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
