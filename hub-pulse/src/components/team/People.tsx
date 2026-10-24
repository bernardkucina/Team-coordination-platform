'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { TIER_HOURS, type Tier } from '@/lib/types';
import { attendanceStats, isSuperstar, paceStatus, weekHours } from '@/lib/rules';
import { CURRENT_WEEK, WEEK_PACE, dayLabel, hoursText } from '@/lib/time';
import { Avatar, ColumnChart, Icon, Progress, Segmented } from '../ui';
import { STATUS_LOOK } from '../Meetings';

type Show = 'all' | 'behind' | 'stars';

const PACE_LOOK = {
  met: { label: 'Commitment met', cls: 'good' },
  'on-track': { label: 'On track', cls: 'info' },
  behind: { label: 'Behind', cls: 'bad' },
} as const;

export function People() {
  const { state } = useStore();
  const [tier, setTier] = useState<Tier | 'all'>('all');
  const [show, setShow] = useState<Show>('all');
  const [selectedId, setSelectedId] = useState('zala.turk');

  const rows = state.members
    .map((m) => ({ m, hours: weekHours(state.timeEntries, m.id) }))
    .filter(({ m }) => tier === 'all' || m.tier === tier)
    .filter(({ m, hours }) => show !== 'behind' || paceStatus(hours, m) === 'behind')
    .filter(({ m, hours }) => show !== 'stars' || isSuperstar(hours, m))
    .sort((a, b) => a.hours / TIER_HOURS[a.m.tier] - b.hours / TIER_HOURS[b.m.tier]);

  const sel = state.members.find((m) => m.id === selectedId) ?? state.members[0];
  const selHours = weekHours(state.timeEntries, sel.id);
  const commitment = TIER_HOURS[sel.tier];
  const stats = attendanceStats(sel.id, state.meetings, state.series, state.attendance);
  const weeks = [...sel.pastWeeks, selHours];
  const recent = state.attendance
    .filter((r) => r.memberId === sel.id)
    .map((r) => ({ r, m: state.meetings.find((x) => x.id === r.meetingId) }))
    .filter((x): x is { r: typeof x.r; m: NonNullable<typeof x.m> } => !!x.m)
    .sort((a, b) => (b.m.date + b.m.start).localeCompare(a.m.date + a.m.start))
    .slice(0, 5);
  const tasksDone = state.tasks.filter((t) => t.owner === sel.id && t.status === 'done').length;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="inline">
        <span className="small muted" style={{ marginRight: 'auto' }}>Week {CURRENT_WEEK} · {Math.round(WEEK_PACE * 100)} % of the commitment is expected by today</span>
        <label className="label" htmlFor="tiersel" style={{ fontSize: 13 }}>Tier</label>
        <select id="tiersel" className="field" value={tier} onChange={(e) => setTier(e.target.value as Tier | 'all')}>
          <option value="all">All tiers</option>
          {(Object.keys(TIER_HOURS) as Tier[]).map((t) => <option key={t} value={t}>{t} · {TIER_HOURS[t]} h</option>)}
        </select>
        <Segmented label="Show" value={show} onChange={setShow} options={[{ value: 'all', label: 'Everyone' }, { value: 'behind', label: 'Behind' }, { value: 'stars', label: 'Superstars' }]} />
      </div>

      <div className="row">
        <section className="card" aria-labelledby="list-h" style={{ flex: '3 1 500px', minWidth: 0, padding: 20, gap: 8 }}>
          <h2 id="list-h" style={{ fontSize: 18 }}>Members <span className="muted" style={{ fontWeight: 500, fontSize: 15 }}>{rows.length}</span></h2>
          {show === 'stars' ? (
            <p className="small muted">Superstars are on pace or ahead and took initiative this month: picked up at least 2 open tasks, or added at least 2 ideas.</p>
          ) : null}
          {rows.map(({ m, hours }) => {
            const pace = PACE_LOOK[paceStatus(hours, m)];
            const on = m.id === sel.id;
            return (
              <button
                key={m.id} type="button" aria-pressed={on} onClick={() => setSelectedId(m.id)}
                className="inline" style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 12, border: `1px solid ${on ? 'var(--blue)' : 'var(--line-soft)'}`, background: on ? 'var(--surface-2)' : '#fff', gap: 12 }}
              >
                <Avatar initials={m.initials} />
                <span className="stack" style={{ gap: 2, flex: '1 1 120px', minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</span>
                  <span className="tiny muted">{m.tier}</span>
                </span>
                <span className="stack" style={{ gap: 6, flex: '1 1 150px' }}>
                  <span className="small"><strong>{hoursText(hours)}</strong> of {TIER_HOURS[m.tier]} h</span>
                  <Progress value={hours} max={TIER_HOURS[m.tier]} />
                </span>
                <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <span className={`pill ${pace.cls}`}>{pace.label}</span>
                  {isSuperstar(hours, m) ? <span className="pill warn" style={{ fontWeight: 700 }}>{Icon.star}Superstar</span> : null}
                </span>
              </button>
            );
          })}
        </section>

        <section className="card" aria-labelledby="det-h" style={{ flex: '2 1 340px', minWidth: 0, gap: 18 }}>
          <div className="inline" style={{ gap: 12, flexWrap: 'nowrap' }}>
            <Avatar initials={sel.initials} style={{ width: 48, height: 48, fontSize: 16, background: 'var(--blue)', color: '#fff' }} />
            <div className="stack" style={{ gap: 2 }}>
              <h2 id="det-h">{sel.name}</h2>
              <span className="small muted">{sel.tier} · {commitment} h a week · since {sel.since}</span>
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
          <div className="stack" style={{ gap: 8 }}>
            <h3>Recent meetings</h3>
            {recent.map(({ r, m }) => (
              <div key={m.id} className="inline small" style={{ flexWrap: 'nowrap', gap: 10 }}>
                <span className="muted" style={{ width: 92 }}>{dayLabel(m.date)}</span>
                <span style={{ flex: '1 1 auto', fontWeight: 600 }}>{state.series.find((s) => s.id === m.seriesId)?.name}</span>
                <span className={`pill ${STATUS_LOOK[r.status].cls}`}>{STATUS_LOOK[r.status].label}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
