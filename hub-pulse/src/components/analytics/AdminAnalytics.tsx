'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS, type AttendanceStatus, type Tier } from '@/lib/types';
import { attendanceStats, currentMonthDays, dailyHours, entryMinutes, memberWeeks, paceStatus, sumDays, weekHours } from '@/lib/rules';
import { CURRENT_WEEK, DEMO_TODAY, WEEK_PACE, dayLabel, hoursText, longDate, weekOf, weekdayOf } from '@/lib/time';
import { Avatar, ColumnChart, Kpi, Progress, Segmented } from '../ui';
import { Leaderboards } from './Leaderboards';

const SERIES_COLORS: Record<AttendanceStatus, string> = { present: 'var(--hub)', remote: '#7fa6e8', excused: '#e3a93b', missed: '#c93a3a' };

export function AdminAnalytics() {
  const { state } = useStore();
  const [tier, setTier] = useState<Tier | 'all'>('all');
  const [hoverSeries, setHoverSeries] = useState<string | null>(null);
  const [period, setPeriod] = useState<'week' | 'month'>('month');

  const members = state.members.filter((m) => tier === 'all' || m.tier === tier);
  const perDay = sumDays(members.map((m) => dailyHours(m, state.timeEntries, state.tasks)));
  const monthDays = currentMonthDays();
  const monthName = longDate(DEMO_TODAY).split(' ').slice(-1)[0];
  const monthTotal = monthDays.reduce((a, d) => a + (perDay.get(d)?.hub ?? 0) + (perDay.get(d)?.remote ?? 0), 0);
  const r1 = (n: number) => String(Math.round(n * 2) / 2).replace('.', ',');
  const withHours = members.map((m) => ({ m, hours: weekHours(state.timeEntries, m.id) }));
  const behind = withHours.filter(({ m, hours }) => paceStatus(hours, m) === 'behind')
    .sort((a, b) => a.hours / TIER_HOURS[a.m.tier] - b.hours / TIER_HOURS[b.m.tier]);
  const logged = withHours.reduce((a, x) => a + x.hours, 0);
  const committed = members.reduce((a, m) => a + TIER_HOURS[m.tier], 0);
  // Member of the week: furthest along their own tier's commitment this week; picking up tasks breaks a tie.
  const star = [...withHours]
    .map((x) => ({ ...x, ratio: x.hours / TIER_HOURS[x.m.tier] }))
    .sort((a, b) => b.ratio - a.ratio || b.m.picked - a.m.picked)[0];

  // Per member, per week: hours (hub / remote) and tasks finished. Follows the tier filter.
  const perMember = members.map((m) => ({ m, weeks: memberWeeks(m, state.timeEntries, state.tasks) }));
  const weekNumbers = perMember[0]?.weeks.map((w) => w.week) ?? [];
  const trend = weekNumbers.map((week, i) => {
    const hub = perMember.reduce((a, x) => a + (x.weeks[i]?.hub ?? 0), 0);
    const remote = perMember.reduce((a, x) => a + (x.weeks[i]?.remote ?? 0), 0);
    const tasks = perMember.reduce((a, x) => a + (x.weeks[i]?.tasksDone ?? 0), 0);
    const toPct = (h: number) => (committed ? Math.round((h / committed) * 100) : 0);
    return { week, hubPct: toPct(hub), remotePct: toPct(remote), pct: toPct(hub + remote), hub, remote, tasks, current: week === CURRENT_WEEK };
  });
  const totalHub = trend.reduce((a, w) => a + w.hub, 0);
  const totalAll = trend.reduce((a, w) => a + w.hub + w.remote, 0);
  const tasksSixWeeks = trend.reduce((a, w) => a + w.tasks, 0);

  const byProject = state.projects.filter((p) => p.status === 'active').map((p) => ({
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

  const doneThisWeek = trend[trend.length - 1]?.tasks ?? 0;
  const inValidation = state.tasks.filter((t) => t.status === 'validation').length;

  return (
    <>
      <header className="page-head">
        <div>
          <span className="kicker">Week {CURRENT_WEEK} · {longDate(DEMO_TODAY)}</span>
          <h1>How the hub is doing</h1>
        </div>
        <Segmented
          label="Tier" value={tier} onChange={setTier}
          options={[{ value: 'all', label: 'All tiers' }, ...(Object.keys(TIER_HOURS) as Tier[]).map((t) => ({ value: t, label: t }))]}
        />
      </header>

      <div className="inline" style={{ justifyContent: 'flex-end' }}>
        {star ? (
          <div className="streak-box" aria-label="Member of the week">
            <span style={{ fontSize: 34, lineHeight: 1 }} aria-hidden="true">🏆</span>
            <div className="stack" style={{ gap: 2 }}>
              <span className="tiny muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Member of the week</span>
              <span className="streak-count inline" style={{ gap: 8 }}><Avatar small initials={star.m.initials} />{star.m.name} ⭐</span>
              <span className="tiny muted">{Math.round(star.ratio * 100)} % of their {TIER_HOURS[star.m.tier]} h already{star.m.picked ? ` · picked up ${star.m.picked} ${star.m.picked === 1 ? 'task' : 'tasks'} themselves` : ''}</span>
            </div>
          </div>
        ) : null}
      </div>

      <Leaderboards />

      <div className="row">

          <section className="card" aria-labelledby="proj-h" style={{ flex: '1 1 360px', minWidth: 0 }}>
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
          <section className="card" aria-labelledby="series-h" style={{ flex: '1 1 360px', minWidth: 0 }}>
            <div className="stack" style={{ gap: 10 }}>
              <h2 id="series-h">Attendance by series, last 8 weeks</h2>
              <div className="inline tiny muted" style={{ gap: 10 }}>
                {(['present', 'remote', 'excused', 'missed'] as AttendanceStatus[]).map((k) => (
                  <span key={k} className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: SERIES_COLORS[k] }} />{k === 'present' ? 'In person' : k[0].toUpperCase() + k.slice(1)}</span>
                ))}
              </div>
            </div>
            <div className="stack" style={{ gap: 14 }}>
              {seriesRows.map(({ s, parts, showed }) => (
                <div key={s.id} className="inline" style={{ position: 'relative', gap: '4px 12px' }} onMouseEnter={() => setHoverSeries(s.id)} onMouseLeave={() => setHoverSeries(null)}>
                  <span style={{ flex: '1 1 100%', fontWeight: 600, fontSize: 14 }}>{s.name}</span>
                  <div style={{ flex: '1 1 120px', display: 'flex', gap: 2, height: 14 }}>
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

      </div>

      <section className="card" aria-labelledby="trend-h">
        <div className="between">
          <div className="inline" style={{ gap: 14 }}>
            <h2 id="trend-h">{period === 'week' ? 'Committed hours delivered, in the hub and remote' : `Hours per day in ${monthName}: ${hoursText(Math.round(monthTotal))}`}</h2>
            <Segmented label="Group hours by" value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Weeks' }, { value: 'month', label: 'Month' }]} />
          </div>
          <span className="inline small muted" style={{ gap: 14 }}>
            <span className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--hub)' }} />In the hub</span>
            <span className="inline" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--remote)' }} />Remote</span>
            {period === 'week' ? <span className="legend"><span className="dash" />100 % of commitment</span> : null}
          </span>
        </div>
        {period === 'week' ? (
          <ColumnChart
          refValue={100} max={115}
          columns={trend.map((w) => ({
            key: String(w.week), label: w.current ? `W${w.week} (now)` : `W${w.week}`, value: w.pct, valueText: `${w.pct} %`,
            tip: `Week ${w.week}${w.current ? ', in progress' : ''}: ${w.pct} % of committed hours (${w.hubPct} % hub, ${w.remotePct} % remote)`, current: w.current,
            parts: [{ value: w.hubPct, color: 'var(--hub)' }, { value: w.remotePct, color: 'var(--remote)' }],
          }))}
        />
        ) : (
          <ColumnChart
            columns={monthDays.map((d) => {
              const v = perDay.get(d) ?? { hub: 0, remote: 0 };
              const total = v.hub + v.remote;
              return {
                key: d, label: String(Number(d.slice(8))), value: total, valueText: total ? r1(total) : '', current: d === DEMO_TODAY,
                parts: [{ value: v.hub, color: 'var(--hub)' }, { value: v.remote, color: 'var(--remote)' }],
                tip: `${dayLabel(d)}${weekdayOf(d) > 4 ? ' (weekend)' : ''}: ${d > DEMO_TODAY ? 'not yet' : total ? `${r1(total)} h (${r1(v.hub)} h hub, ${r1(v.remote)} h remote)` : 'no hours'}`,
              };
            })}
          />
        )}
      </section>
    </>
  );
}
