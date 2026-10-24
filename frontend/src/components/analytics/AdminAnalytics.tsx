'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { MemberAnalyticsRow } from '@hub-pulse/shared';
import { api } from '@/lib/api';
import { useStore } from '@/lib/store';
import { TIER_HOURS, type AttendanceStatus, type Tier } from '@/lib/types';
import { attendanceStats, entryMinutes, paceStatus, weekHours } from '@/lib/rules';
import { CURRENT_WEEK, DEMO_TODAY, WEEK_PACE, addDays, hoursText, longDate, weekOf, weekdayOf } from '@/lib/time';
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

  const doneThisWeek = state.tasks.filter((t) => t.status === 'done' && !!t.doneAt && weekOf(t.doneAt.slice(0, 10)) === CURRENT_WEEK).length;
  const monday = addDays(DEMO_TODAY, -weekdayOf(DEMO_TODAY));
  const daysLeft = 6 - weekdayOf(DEMO_TODAY);
  const inValidation = state.tasks.filter((t) => t.status === 'validation').length;

  // This week's hours by where they were worked, for the members in view.
  const inView = new Set(members.map((m) => m.id));
  const thisWeek = state.timeEntries.filter((e) => inView.has(e.memberId) && weekOf(e.date) === CURRENT_WEEK && e.location);
  const hubHours = thisWeek.filter((e) => e.location === 'hub').reduce((a, e) => a + entryMinutes(e), 0) / 60;
  const remoteHours = thisWeek.filter((e) => e.location === 'remote').reduce((a, e) => a + entryMinutes(e), 0) / 60;
  const hubShare = hubHours + remoteHours ? Math.round((hubHours / (hubHours + remoteHours)) * 100) : null;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="kicker">Week {CURRENT_WEEK} · {longDate(monday)} to {longDate(addDays(monday, 6))} · {daysLeft === 0 ? 'last day' : `${daysLeft} day${daysLeft > 1 ? 's' : ''} left`}</span>
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
        <Kpi
          label="In the hub vs remote" value={hubShare === null ? '—' : `${hubShare} % hub`}
          note={hubShare === null ? 'no locations logged this week' : `${hoursText(hubHours)} in the hub · ${hoursText(remoteHours)} remote`}
        />
      </section>

      <WatchList tier={tier} />

      <div className="row">
        <section className="card" aria-labelledby="behind-h" style={{ flex: '3 1 520px', minWidth: 0 }}>
          <div className="between">
            <h2 id="behind-h">Behind this week</h2>
            <span className="small muted">Below {Math.round(WEEK_PACE * 100)} % of commitment, the pace for today</span>
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

/**
 * Who needs a call and who deserves a thank-you, computed by the backend (GET /api/analytics/members):
 * drifting = under half the commitment in both of the last two finished weeks and missed a meeting;
 * superstar = on pace and took initiative this month.
 */
function WatchList({ tier }: { tier: Tier | 'all' }) {
  const [rows, setRows] = useState<MemberAnalyticsRow[] | null>(null);
  useEffect(() => {
    api.memberAnalytics().then(setRows).catch(() => setRows([]));
  }, []);
  if (!rows) return null;
  const inTier = rows.filter((r) => r.active && (tier === 'all' || r.tier === tier));
  const drifting = inTier.filter((r) => r.drifting);
  const stars = inTier.filter((r) => r.superstar);

  return (
    <div className="row">
      <section className="card" aria-labelledby="drift-h" style={{ flex: '1 1 420px', minWidth: 0 }}>
        <div className="between">
          <h2 id="drift-h">Drifting away</h2>
          <span className="small muted">under half the commitment two weeks running, and missed meetings</span>
        </div>
        {drifting.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Nobody right now.</p> : (
          <ul className="list">
            {drifting.map((r) => (
              <li key={r.memberId} className="inline" style={{ gap: 12 }}>
                <span className="stack" style={{ gap: 2, flex: '1 1 160px' }}>
                  <span style={{ fontWeight: 600 }}>{r.name}</span>
                  <span className="tiny muted">{r.tier} · {r.commitment} h a week</span>
                </span>
                <span className="small">{hoursText(r.avgHours6w)} avg / week · {r.attendance.missed} missed · {r.tasksOpen} open tasks</span>
                <span className="pill bad">Drifting</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-labelledby="star-h" style={{ flex: '1 1 320px', minWidth: 0 }}>
        <div className="between">
          <h2 id="star-h">Superstars this month</h2>
          <span className="small muted">on pace and took initiative</span>
        </div>
        {stars.length === 0 ? <p className="small muted" style={{ margin: 0 }}>Nobody yet this month.</p> : (
          <ul className="list">
            {stars.map((r) => (
              <li key={r.memberId} className="inline" style={{ gap: 12 }}>
                <span style={{ fontWeight: 600, flex: '1 1 140px' }}>{r.name}</span>
                <span className="small">{hoursText(r.weekHours)} this week · {r.tasksDoneThisWeek} done</span>
                <span className="pill good">Superstar</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
