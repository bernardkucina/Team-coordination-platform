'use client';

import { useStore } from '@/lib/store';
import { TIER_HOURS } from '@/lib/types';
import { attendanceStats, memberWeeks, paceStatus } from '@/lib/rules';
import { hoursText } from '@/lib/time';
import { Avatar, Progress } from '../ui';

const CENTER = { textAlign: 'center' } as const;

/** Every member's hours, tasks done, attendance and hub share over the last weeks. */
export function MembersTable() {
  const { state } = useStore();
  const perMember = state.members.map((m) => ({ m, weeks: memberWeeks(m, state.timeEntries, state.tasks) }));
  const weeksCount = perMember[0]?.weeks.length ?? 0;
  return (
    <section className="card" aria-labelledby="mem-h" >
    <div className="between">
      <h2 id="mem-h">Members</h2>
      <span className="small muted">Last {weeksCount} weeks · lowest commitment first</span>
    </div>
    <div className="scroll-x">
      <table className="table" style={{ minWidth: 700 }}>
        <thead>
          <tr>
            <th>Member</th>
            <th>This week</th>
            <th style={CENTER}>Tasks done</th>
            <th style={CENTER}>Hours</th>
            <th style={CENTER}>Attendance</th>
            <th style={{ ...CENTER, width: 200, paddingLeft: 40 }}>Hub / remote</th>
          </tr>
        </thead>
        <tbody>
          {perMember
            .map(({ m, weeks }) => {
              const c = TIER_HOURS[m.tier];
              const done = weeks.filter((w) => !w.current);
              const met = done.filter((w) => w.hours >= c).length;
              const hours = weeks.reduce((a, w) => a + w.hours, 0);
              const hub = weeks.reduce((a, w) => a + w.hub, 0);
              const tasks = weeks.reduce((a, w) => a + w.tasksDone, 0);
              const st = attendanceStats(m.id, state.meetings, state.series, state.attendance);
              const now = weeks[weeks.length - 1];
              return { m, c, done, met, hours, hub, tasks, st, now };
            })
            .sort((a, b) => a.met / Math.max(1, a.done.length) - b.met / Math.max(1, b.done.length) || a.now.hours / a.c - b.now.hours / b.c)
            .map(({ m, c, hours, hub, tasks, st, now }) => {
              const behindNow = paceStatus(now.hours, m) === 'behind';
              return (
                <tr key={m.id}>
                  <th scope="row" style={{ whiteSpace: 'nowrap' }}>
                    <span className="inline" style={{ gap: 8, flexWrap: 'nowrap' }}><Avatar small initials={m.initials} />{m.name}</span>
                  </th>
                  <td>
                    <span className="stack" style={{ gap: 4, minWidth: 120 }}>
                      <span className="small" style={{ color: behindNow ? 'var(--bad)' : undefined, fontWeight: behindNow ? 700 : 400 }}>{hoursText(now.hours)} of {c} h</span>
                      <Progress value={now.hours} max={c} />
                    </span>
                  </td>
                  <td style={CENTER}><strong>{tasks}</strong></td>
                  <td style={CENTER}>{hoursText(hours)}</td>
                  <td style={{ ...CENTER, color: st.rate !== null && st.rate < 70 ? 'var(--bad)' : undefined }}>{st.rate === null ? '—' : `${st.rate} %`}</td>
                  <td style={{ paddingLeft: 40 }}>
                    <span className="inline" style={{ gap: 8, flexWrap: 'nowrap' }}>
                      <span style={{ display: 'flex', gap: 2, height: 10, flex: '1 1 auto' }} aria-hidden="true">
                        <span style={{ flex: `${hub} 1 0`, background: 'var(--hub)', borderRadius: 3 }} />
                        <span style={{ flex: `${Math.max(0, hours - hub)} 1 0`, background: 'var(--remote)', borderRadius: 3 }} />
                      </span>
                      <span className="tiny" style={{ width: 70 }}>{hours ? Math.round((hub / hours) * 100) : 0} % hub</span>
                    </span>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
    </section>
  );
}
