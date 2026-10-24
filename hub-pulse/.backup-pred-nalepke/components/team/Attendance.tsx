'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { attendanceStats, meetingPhase } from '@/lib/rules';
import { CURRENT_WEEK, dayLabel, weekOf } from '@/lib/time';
import type { Meeting } from '@/lib/types';
import { AttendanceRecorder } from '../Meetings';

const WEEKS = Array.from({ length: 6 }, (_, i) => CURRENT_WEEK - 5 + i);

const WEEK_LOOK = {
  none: { bg: '#fff', border: 'var(--field)', label: 'no meetings' },
  ok: { bg: '#184897', border: '#184897', label: 'showed up' },
  excused: { bg: '#f2b253', border: '#f2b253', label: 'missed, excused' },
  missed: { bg: '#c22222', border: '#c22222', label: 'missed without excuse' },
} as const;

export function Attendance() {
  const { state } = useStore();
  const thisWeek = state.meetings
    .filter((m) => weekOf(m.date) === CURRENT_WEEK)
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
  const firstOpen = thisWeek.find((m) => meetingPhase(m) !== 'upcoming' && !m.recorded) ?? thisWeek[0];
  const [selectedId, setSelectedId] = useState(firstOpen?.id);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [seriesFilter, setSeriesFilter] = useState<string>('all');

  const selected = state.meetings.find((m) => m.id === selectedId);
  const seriesOptions = state.series.filter((s) => projectFilter === 'all' || (projectFilter === 'hub' ? s.projectId === null : s.projectId === projectFilter));
  const inScope = (m: Meeting) => seriesOptions.some((s) => s.id === m.seriesId) && (seriesFilter === 'all' || m.seriesId === seriesFilter);
  const scoped = state.meetings.filter(inScope);

  const rows = state.members
    .map((member) => {
      const stats = attendanceStats(member.id, scoped, state.series, state.attendance);
      const weeks = WEEKS.map((w) => {
        const weekStats = attendanceStats(member.id, scoped.filter((m) => weekOf(m.date) === w), state.series, state.attendance);
        if (!weekStats.invited) return WEEK_LOOK.none;
        if (weekStats.missed) return WEEK_LOOK.missed;
        if (weekStats.excused) return WEEK_LOOK.excused;
        return WEEK_LOOK.ok;
      });
      return { member, stats, weeks };
    })
    .sort((a, b) => (a.stats.rate ?? 999) - (b.stats.rate ?? 999));

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="row">
        <section className="card" aria-labelledby="ml-h" style={{ flex: '1 1 280px', minWidth: 0, padding: 20, gap: 8 }}>
          <h2 id="ml-h" style={{ fontSize: 18 }}>This week</h2>
          {thisWeek.map((m) => {
            const series = state.series.find((s) => s.id === m.seriesId);
            const phase = meetingPhase(m);
            const marked = state.attendance.filter((r) => r.meetingId === m.id).length;
            const status = phase === 'upcoming'
              ? { text: 'Not started', color: 'var(--muted)' }
              : m.recorded ? { text: 'Recorded', color: 'var(--good)' }
              : { text: `${marked} of ${series?.invited.length} marked`, color: 'var(--warn)' };
            const on = m.id === selectedId;
            return (
              <button
                key={m.id} type="button" aria-pressed={on} onClick={() => setSelectedId(m.id)}
                className="stack" style={{ gap: 4, width: '100%', textAlign: 'left', padding: 12, borderRadius: 12, border: `1px solid ${on ? 'var(--blue)' : 'var(--line-soft)'}`, background: on ? '#f5f8fd' : '#fff' }}
              >
                <span className="between" style={{ width: '100%', flexWrap: 'nowrap' }}>
                  <span style={{ fontWeight: 600 }}>{series?.name}</span>
                  <span className="tiny strong" style={{ color: status.color }}>{status.text}</span>
                </span>
                <span className="tiny muted">{dayLabel(m.date)}, {m.start} · {series?.invited.length} invited</span>
              </button>
            );
          })}
        </section>
        <div style={{ flex: '2 1 500px', minWidth: 0 }}>
          {selected ? <AttendanceRecorder meeting={selected} /> : null}
        </div>
      </div>

      <section className="card" aria-labelledby="att-h">
        <div className="between" style={{ alignItems: 'flex-end' }}>
          <div className="stack" style={{ gap: 4 }}>
            <h2 id="att-h">Attendance by person, last 6 weeks</h2>
            <span className="small muted">Rate = showed up (in person or remote) ÷ meetings they were invited to, minus excused ones. Excused absences never count against anyone.</span>
          </div>
          <div className="inline">
            <label className="label" htmlFor="attproj" style={{ fontSize: 13 }}>Project</label>
            <select id="attproj" className="field" value={projectFilter} onChange={(e) => { setProjectFilter(e.target.value); setSeriesFilter('all'); }}>
              <option value="all">All projects</option>
              <option value="hub">Hub-wide</option>
              {state.projects.filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <label className="label" htmlFor="attseries" style={{ fontSize: 13 }}>Meeting</label>
            <select id="attseries" className="field" value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}>
              <option value="all">All meetings</option>
              {seriesOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div className="scroll-x">
          <table className="table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Member</th>
                <th className="num">Invited</th>
                <th className="num">In person</th>
                <th className="num">Remote</th>
                <th className="num">Excused</th>
                <th className="num">Missed</th>
                <th style={{ width: 170 }}>Rate</th>
                <th>Week by week</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, stats, weeks }) => {
                const low = stats.rate !== null && stats.rate < 70;
                return (
                  <tr key={member.id}>
                    <th scope="row" style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{member.name}</th>
                    <td className="num">{stats.invited || '—'}</td>
                    <td className="num">{stats.present}</td>
                    <td className="num">{stats.remote}</td>
                    <td className="num">{stats.excused}</td>
                    <td className="num" style={{ color: stats.missed > 2 ? 'var(--bad)' : undefined, fontWeight: stats.missed > 2 ? 700 : 400 }}>{stats.missed}</td>
                    <td>
                      <div className="inline" style={{ flexWrap: 'nowrap' }}>
                        <span style={{ width: 42, fontWeight: 700, color: low ? 'var(--bad)' : undefined }}>{stats.rate === null ? '—' : `${stats.rate}%`}</span>
                        <div className="bar" style={{ flex: '1 1 auto' }}><span style={{ width: `${stats.rate ?? 0}%`, background: low ? 'var(--red)' : undefined }} /></div>
                      </div>
                    </td>
                    <td>
                      <div className="inline" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        {weeks.map((w, i) => (
                          <span key={i} title={`W${WEEKS[i]}: ${w.label}`} style={{ width: 14, height: 14, borderRadius: 4, background: w.bg, border: `1px solid ${w.border}` }} />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="inline tiny muted" style={{ gap: 16 }}>
          {Object.values(WEEK_LOOK).map((w) => (
            <span key={w.label} className="inline" style={{ gap: 6 }}><span className="swatch" style={{ width: 12, height: 12, background: w.bg, border: `1px solid ${w.border}` }} />{w.label}</span>
          ))}
          <span>Lowest rate first. Works the same with 6 meeting series or 60.</span>
        </div>
      </section>
    </div>
  );
}
