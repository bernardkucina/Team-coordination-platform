'use client';

import { useEffect, useState } from 'react';
import type { MemberAnalyticsRow } from '@hub-pulse/shared';
import { api } from '@/lib/api';
import type { Tier } from '@/lib/types';
import { hoursText } from '@/lib/time';

/**
 * Who needs a call and who deserves a thank-you, computed by the backend (GET /api/analytics/members):
 * drifting = under half the commitment in both of the last two finished weeks and missed a meeting;
 * superstar = on pace and took initiative this month.
 */
function useMemberAnalytics(tier: Tier | 'all') {
  const [rows, setRows] = useState<MemberAnalyticsRow[] | null>(null);
  useEffect(() => {
    api.memberAnalytics().then(setRows).catch(() => setRows([]));
  }, []);
  return rows?.filter((r) => r.active && (tier === 'all' || r.tier === tier)) ?? null;
}

/** Shown on Team → Attendance. */
export function DriftingAway({ tier = 'all' }: { tier?: Tier | 'all' }) {
  const rows = useMemberAnalytics(tier);
  if (!rows) return null;
  const drifting = rows.filter((r) => r.drifting);
  return (
    <section className="card fixed" aria-labelledby="drift-h">
      <div className="between">
        <h2 id="drift-h">Drifting away</h2>
        <span className="small muted">under half the commitment two weeks running, and missed meetings</span>
      </div>
      <div className="card-body">
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
      </div>
    </section>
  );
}
