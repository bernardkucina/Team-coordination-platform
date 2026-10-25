'use client';

import { Fragment, useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS, type Tier } from '@/lib/types';
import { attendanceStats, isSuperstar, paceStatus, weekHours } from '@/lib/rules';
import { CURRENT_WEEK, WEEK_PACE, hoursText } from '@/lib/time';
import { Avatar, ColumnChart, Icon, Progress, Segmented } from '../ui';

type Show = 'watch' | 'all' | 'stars';

const PACE_LOOK = {
  met: { label: 'Commitment met', cls: 'good' },
  'on-track': { label: 'On track', cls: 'info' },
  behind: { label: 'Behind', cls: 'bad' },
} as const;

export function People() {
  const { state } = useStore();
  const [tier, setTier] = useState<Tier | 'all'>('all');
  const show = 'all' as Show;
  const tierOrder = Object.keys(TIER_HOURS) as Tier[];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Who needs attention: behind the pace expected by today (so early in the week almost nobody is),
  // or short of their commitment last week, which is worth keeping an eye on even if this week looks fine.
  const rows = state.members
    .map((m) => {
      const hours = weekHours(state.timeEntries, m.id);
      const last = m.pastWeeks[m.pastWeeks.length - 1] ?? 0;
      return { m, hours, last, behindNow: paceStatus(hours, m) === 'behind', shortLast: last < TIER_HOURS[m.tier] };
    })
    .filter(({ m }) => tier === 'all' || m.tier === tier)
    .filter((r) => show !== 'watch' || r.behindNow || r.shortLast)
    .filter(({ m, hours }) => show !== 'stars' || isSuperstar(hours, m))
    // Grouped by tier; inside a tier, the ones furthest behind first.
    .sort((a, b) => tierOrder.indexOf(a.m.tier) - tierOrder.indexOf(b.m.tier) || Number(b.behindNow && b.shortLast) - Number(a.behindNow && a.shortLast) || a.hours / TIER_HOURS[a.m.tier] - b.hours / TIER_HOURS[b.m.tier]);

  const sel = state.members.find((m) => m.id === selectedId) ?? rows[0]?.m ?? state.members[0];
  const selHours = weekHours(state.timeEntries, sel.id);
  const commitment = TIER_HOURS[sel.tier];
  const stats = attendanceStats(sel.id, state.meetings, state.series, state.attendance);
  const weeks = [...sel.pastWeeks, selHours];
  const tasksDone = state.tasks.filter((t) => t.owner === sel.id && t.status === 'done').length;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="inline" style={{ justifyContent: 'flex-end' }}>
        <Segmented<Tier | 'all'> label="Tier" value={tier} onChange={setTier} options={[{ value: 'all', label: 'All tiers' }, ...(Object.keys(TIER_HOURS) as Tier[]).map((t) => ({ value: t, label: t }))]} />
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <section className="card" aria-labelledby="list-h" style={{ flex: '3 1 500px', minWidth: 0, padding: 20, gap: 8 }}>
          <h2 id="list-h" style={{ fontSize: 18 }}>{show === 'watch' ? 'Needs attention' : show === 'stars' ? 'Superstars' : 'People and hours'} <span className="muted" style={{ fontWeight: 500, fontSize: 15 }}>{rows.length}</span></h2>
          {show === 'watch' ? (
            <p className="small muted">Behind the pace expected by today ({Math.round(WEEK_PACE * 100)} % of the week in week {CURRENT_WEEK}), or short of their commitment last week.</p>
          ) : null}
          {show === 'all' ? (
            <p className="small muted">Hours this week against each tier's weekly commitment, by tier. Furthest behind first.</p>
          ) : null}
          {show === 'stars' ? (
            <p className="small muted">Superstars are on pace or ahead and took initiative this month: picked up at least 2 open tasks, or added at least 2 ideas.</p>
          ) : null}
          <div className="people-scroll">
          {rows.length === 0 ? <p className="small muted">Nobody here right now.</p> : null}
          {rows.map(({ m, hours }, i) => {
            const pace = PACE_LOOK[paceStatus(hours, m)];
            const on = m.id === sel.id;
            const tierStart = tier === 'all' && (i === 0 || rows[i - 1].m.tier !== m.tier);
            const inTier = tierStart ? rows.filter((r) => r.m.tier === m.tier).length : 0;
            return (
              <Fragment key={m.id}>
              {tierStart ? (
                <h3 className="tiny muted" style={{ margin: i === 0 ? '4px 0 0' : '10px 0 0', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>
                  {m.tier} · {TIER_HOURS[m.tier]} h a week · {inTier}
                </h3>
              ) : null}
              <button
                type="button" aria-pressed={on} onClick={() => setSelectedId(m.id)}
                className="people-row" style={{ border: `1px solid ${on ? 'var(--ink)' : 'var(--line-soft)'}`, background: on ? 'var(--surface-2)' : 'var(--surface)' }}
              >
                <Avatar initials={m.initials} />
                <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</span>
                  <span className="tiny muted">{m.tier}</span>
                </span>
                <span className="stack" style={{ gap: 6, minWidth: 0 }}>
                  <span className="small"><strong>{hoursText(hours)}</strong> of {TIER_HOURS[m.tier]} h</span>
                  <Progress value={hours} max={TIER_HOURS[m.tier]} />
                </span>
                <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <span className={`pill ${pace.cls}`}>{pace.label}</span>
                  {isSuperstar(hours, m) ? <span className="pill warn" style={{ fontWeight: 700 }}>{Icon.star}Superstar</span> : null}
                </span>
              </button>
              </Fragment>
            );
          })}
          </div>
        </section>

        <section className="card" aria-labelledby="det-h" style={{ flex: '2 1 340px', minWidth: 0, gap: 18 }}>
          <div className="inline" style={{ gap: 12, flexWrap: 'nowrap' }}>
            <Avatar initials={sel.initials} style={{ width: 48, height: 48, fontSize: 16, background: 'var(--blue)', color: '#fff' }} />
            <div className="stack" style={{ gap: 2 }}>
              <h2 id="det-h">{sel.name}</h2>
              <span className="small muted">{sel.tier} · {commitment} h a week{sel.since ? ` · since ${sel.since}` : ''}</span>
            </div>
          </div>
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            {[
              ['Avg / week', hoursText(sel.pastWeeks.reduce((a, x) => a + x, 0) / sel.pastWeeks.length)],
              ['Attendance', stats.rate === null ? '—' : `${stats.rate} %`],
              ['Tasks done', String(tasksDone)],
            ].map(([label, value]) => (
              <div key={label} className="stack" style={{ gap: 2, padding: 12, borderRadius: 10, background: 'var(--surface-2)' }}>
                <span className="tiny muted">{label}</span>
                <span style={{ fontSize: 18, fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>
          <div className="small" style={{ padding: 12, borderRadius: 10, background: 'var(--surface-2)', color: 'var(--ink-2)' }}>
            <strong>Initiative this month</strong> · {sel.picked} tasks picked up · {sel.ideas} ideas added
          </div>
          <div className="stack" style={{ gap: 10 }}>
            <div className="between">
              <h3>Hours, last 8 weeks</h3>
              <span className="legend tiny"><span className="dash" />{commitment} h</span>
            </div>
            <ColumnChart
              height={120}
              refValue={commitment}
              max={Math.max(commitment * 1.25, ...weeks)}
              columns={weeks.map((h, i) => ({
                key: String(i), label: `W${CURRENT_WEEK - weeks.length + 1 + i}`, value: h, valueText: String(Math.round(h * 10) / 10).replace('.', ','),
                tip: `Week ${CURRENT_WEEK - weeks.length + 1 + i}: ${hoursText(h)}`, current: i === weeks.length - 1,
              }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
