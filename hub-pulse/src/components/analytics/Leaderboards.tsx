'use client';

import { useStore } from '@/lib/store';
import { TEAMBUILDING_SERIES } from '@/lib/data';
import { meetingPhase } from '@/lib/rules';
import { Avatar } from '../ui';

interface Row { id: string; value: number; label: string; detail: string }

/** Rough hub visits for a finished week: about one visit per three hub hours, at most five. */
const visitsFrom = (hubHours: number) => (hubHours > 0 ? Math.min(5, Math.max(1, Math.round(hubHours / 3))) : 0);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Three small leaderboards: hub visits, teambuildings and meetings attended in person. */
export function Leaderboards() {
  const { state, me } = useStore();
  const past = state.meetings.filter((m) => meetingPhase(m) === 'past');

  const office: Row[] = state.members.map((m) => {
    const hubDates = new Set(state.timeEntries.filter((e) => e.memberId === m.id && e.place === 'hub').map((e) => e.date));
    const visits = m.pastWeeksHub.reduce((a, h) => a + visitsFrom(h), 0) + hubDates.size;
    const thisWeek = state.timeEntries.filter((e) => e.memberId === m.id);
    const minutes = (place?: string) => thisWeek.filter((e) => !place || e.place === place)
      .reduce((a, e) => a + (Number(e.end.slice(0, 2)) * 60 + Number(e.end.slice(3))) - (Number(e.start.slice(0, 2)) * 60 + Number(e.start.slice(3))), 0) / 60;
    const total = m.pastWeeks.reduce((a, h) => a + h, 0) + minutes();
    const hub = m.pastWeeksHub.reduce((a, h) => a + h, 0) + minutes('hub');
    return { id: m.id, value: visits, label: `${visits}×`, detail: `${pct(hub, total)} % in the hub` };
  });

  const share = (filter: (seriesId: string) => boolean): Row[] =>
    state.members.map((m) => {
      const mine = past.filter((mt) => filter(mt.seriesId) && state.series.find((s) => s.id === mt.seriesId)?.invited.includes(m.id));
      const recs = mine.map((mt) => state.attendance.find((r) => r.meetingId === mt.id && r.memberId === m.id));
      const counted = recs.filter((r) => r?.status !== 'excused').length;
      const live = recs.filter((r) => r?.status === 'present').length;
      return { id: m.id, value: pct(live, counted), label: `${pct(live, counted)} %`, detail: `${live} of ${counted}` };
    }).filter((r) => r.detail !== '0 of 0');

  return (
    <section className="stack" style={{ gap: 14 }} aria-labelledby="lb-h">
      <h2 id="lb-h">Leaderboards</h2>
      <div className="lb-grid">
        <Board title="🏢 In the hub" note="Visits in the last 6 weeks" rows={office} me={me.id} />
        <Board title="🎉 Teambuildings" note="Share of teambuildings joined" rows={share((id) => id === TEAMBUILDING_SERIES)} me={me.id} />
        <Board title="🤝 Meetings in person" note="Share of meetings attended live" rows={share((id) => id !== TEAMBUILDING_SERIES)} me={me.id} />
      </div>
    </section>
  );
}

function Board({ title, note, rows, me }: { title: string; note: string; rows: Row[]; me: string }) {
  const { state } = useStore();
  const ranked = [...rows].sort((a, b) => b.value - a.value);
  const top = ranked.slice(0, 5);
  const myIndex = ranked.findIndex((r) => r.id === me);
  const shown = myIndex >= 5 ? [...top, ranked[myIndex]] : top;
  return (
    <article className="card lb" aria-label={title}>
      <div className="stack" style={{ gap: 2 }}>
        <h3>{title}</h3>
        <span className="tiny muted">{note}</span>
      </div>
      <ol>
        {shown.map((r) => {
          const m = state.members.find((x) => x.id === r.id);
          const rank = ranked.indexOf(r) + 1;
          return (
            <li key={r.id} className={r.id === me ? 'me' : undefined}>
              <span className="lb-rank">{rank}</span>
              <Avatar small initials={m?.initials ?? '?'} />
              <span className="lb-name"><span>{m?.name}{r.id === me ? ' (you)' : ''}{rank === 1 ? <span className="lb-fire" aria-label="top of the board"> 🔥</span> : null}</span><small>{r.detail}</small></span>
              <span className="lb-value">{r.label}</span>
            </li>
          );
        })}
      </ol>
    </article>
  );
}
