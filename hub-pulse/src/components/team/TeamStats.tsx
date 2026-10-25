'use client';

import { useStore } from '@/lib/store';
import { attendanceStats, paceStatus, weekHours } from '@/lib/rules';
import { hoursText } from '@/lib/time';

/** Three headline numbers for the whole hub: on track this week, hours this week, meeting attendance. */
export function TeamStats() {
  const { state } = useStore();
  const withHours = state.members.map((m) => ({ m, hours: weekHours(state.timeEntries, m.id) }));
  const onTrack = withHours.filter(({ m, hours }) => paceStatus(hours, m) !== 'behind').length;
  const logged = withHours.reduce((a, x) => a + x.hours, 0);
  const all = state.members.map((m) => attendanceStats(m.id, state.meetings, state.series, state.attendance));
  const showed = all.reduce((a, s) => a + s.present + s.remote, 0);
  const base = all.reduce((a, s) => a + s.invited - s.excused, 0);
  const rate = base ? Math.round((showed / base) * 100) : 0;
  return (
    <dl className="stat-strip" aria-label="Hub summary" style={{ margin: "4px 0 12px" }}>
      <div><dt>On track this week</dt><dd>{onTrack} of {state.members.length}</dd></div>
      <div><dt>Hours logged this week</dt><dd>{hoursText(logged)}</dd></div>
      <div><dt>Meetings, last 6 weeks</dt><dd>{rate} %</dd></div>
    </dl>
  );
}
