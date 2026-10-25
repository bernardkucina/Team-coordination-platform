'use client';

import { useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { GENERAL_PROJECT, type MakeupDuty, type Task } from '@/lib/types';
import { DEMO_TODAY, shortDate } from '@/lib/time';
import { Avatar, Icon } from './ui';

/*
 * General tasks: small jobs for the hub anyone can pick. Whoever misses a meeting owes one (a make-up duty,
 * started by the server when an admin records a no-show or you answer "I didn't attend"), picked within 14 days.
 */

const openGeneral = (tasks: Task[]): Task[] => tasks.filter((t) => t.projectId === GENERAL_PROJECT && t.status !== 'done' && t.status !== 'idea');

/** The meeting a duty is for, as "Community (22 Oct)". */
function useDutyLabel() {
  const { state } = useStore();
  return (d: MakeupDuty): string => {
    const meeting = state.meetings.find((m) => m.id === d.meetingId);
    const series = meeting ? state.series.find((s) => s.id === meeting.seriesId) : undefined;
    return `${series?.name ?? 'a meeting'}${meeting ? ` (${shortDate(meeting.date)})` : ''}`;
  };
}

/** Today: you missed a meeting and still owe a General task. */
export function MakeupCard() {
  const { state, dispatch, me } = useStore();
  const label = useDutyLabel();
  const owed = state.makeups.filter((d) => d.memberId === me.id && d.taskId === null);
  if (!owed.length) return null;
  const duty = owed[0];
  const open = openGeneral(state.tasks).filter((t) => !t.owner);
  const late = duty.dueOn < DEMO_TODAY;

  return (
    <section className="card" aria-labelledby="makeup-h" style={{ borderColor: 'var(--warn)', background: 'var(--warn-bg)' }}>
      <div className="between" style={{ alignItems: 'center' }}>
        <h2 id="makeup-h">Make up for a missed meeting</h2>
        <span className={late ? 'pill bad' : 'pill warn'}>{late ? 'Overdue' : `By ${shortDate(duty.dueOn)}`}</span>
      </div>
      <p className="small" style={{ margin: 0 }}>
        You missed <strong>{label(duty)}</strong>. Pick one General task by <strong>{shortDate(duty.dueOn)}</strong>.
        {owed.length > 1 ? ` You owe ${owed.length} in all.` : ''}
      </p>
      {open.length ? (
        <ul className="stack" style={{ gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
          {open.slice(0, 5).map((t) => (
            <li key={t.id} className="between" style={{ alignItems: 'center', gap: 12 }}>
              <span className="small">{t.title}</span>
              <button
                type="button" className="btn btn-outline btn-sm"
                onClick={() => dispatch({ type: 'takeMakeup', meetingId: duty.meetingId, taskId: t.id, who: me.name })}
              >Take it</button>
            </li>
          ))}
        </ul>
      ) : (
        <span className="small muted">No open General tasks right now. Ask an admin to add one.</span>
      )}
    </section>
  );
}

/** The General tasks page: the list of General tasks, who took them, and (for admins) who still owes one. */
export function GeneralTasksList({ asPage = false }: { asPage?: boolean }) {
  const { state, dispatch, me, isAdmin, flash } = useStore();
  const label = useDutyLabel();
  const [title, setTitle] = useState('');
  const general = state.projects.find((p) => p.id === GENERAL_PROJECT);
  if (!general) return null;
  const tasks = openGeneral(state.tasks);
  const myOwed = state.makeups.find((d) => d.memberId === me.id && d.taskId === null);
  const owing = state.makeups.filter((d) => d.taskId === null);
  const nameOf = (id: string) => state.members.find((m) => m.id === id)?.name ?? id;

  const take = (t: Task) => {
    if (myOwed) dispatch({ type: 'takeMakeup', meetingId: myOwed.meetingId, taskId: t.id, who: me.name });
    else dispatch({ type: 'updateTask', taskId: t.id, patch: { owner: me.id }, who: me.name, text: `set the owner to ${me.name}` });
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !general.workstreams[0]) return;
    try {
      const task = await api.createTask({ projectId: GENERAL_PROJECT, title: title.trim(), workstream: general.workstreams[0].name, status: 'priority', priority: 'Low' });
      dispatch({ type: 'taskCreated', task });
      setTitle('');
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Could not add the task.');
    }
  };

  const tasksCard = (
      <section className="card gt-card" aria-labelledby="gt-list-h">
        <div className="between" style={{ alignItems: 'baseline' }}>
          <h2 id="gt-list-h" style={{ fontSize: 18 }}>Tasks</h2>
          <span className="small muted">
            <strong style={{ color: 'var(--ink)' }}>{tasks.filter((t) => !t.owner).length}</strong> open · {tasks.filter((t) => t.owner).length} taken
          </span>
        </div>
        {tasks.length ? (
          <ul className="gt-list">
            {[...tasks].sort((x, y) => Number(!!x.owner) - Number(!!y.owner)).map((t) => {
              const owner = t.owner ? state.members.find((m) => m.id === t.owner) : undefined;
              const mine = t.owner === me.id;
              return (
                <li key={t.id} className={t.owner ? 'gt-row taken' : 'gt-row'}>
                  <span className="gt-icon" aria-hidden="true">{t.owner ? '✓' : Icon.checklist}</span>
                  <span className="stack" style={{ gap: 4, minWidth: 0, flex: '1 1 auto' }}>
                    <span className="gt-title">{t.title}</span>
                    <span className="inline tiny muted" style={{ gap: 6 }}>
                      {owner ? (
                        <>
                          <Avatar small initials={owner.initials} style={{ width: 20, height: 20, fontSize: 9 }} />
                          {mine ? 'You' : owner.name}{t.due ? ` · due ${shortDate(t.due)}` : ''}
                        </>
                      ) : <span className="pill good" style={{ fontSize: 11 }}>Open</span>}
                    </span>
                  </span>
                  {t.owner ? (
                    <span className={mine ? 'pill info' : 'pill neutral'}>{mine ? 'Yours' : 'Taken'}</span>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => take(t)}>Take it</button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <span className="small muted">No open General tasks.</span>}
        {isAdmin ? (
          <form className="gt-add" onSubmit={(e) => void add(e)}>
            <label className="sr-only" htmlFor="general-new">New General task</label>
            <input id="general-new" className="field" style={{ flex: '1 1 auto', minHeight: 42 }} placeholder="Add a General task" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm" style={{ minHeight: 42 }} disabled={!title.trim()}>Add</button>
          </form>
        ) : null}
      </section>
  );
  const owingCard = isAdmin && owing.length ? (
        <section className="card" aria-labelledby="owing-h" style={{ gap: 12 }}>
          <div className="between" style={{ alignItems: 'baseline' }}>
            <h2 id="owing-h" style={{ fontSize: 18 }}>Still owe a General task <span className="muted" style={{ fontWeight: 500, fontSize: 15 }}>{owing.length}</span></h2>
            <span className="small muted">Missed a meeting · soonest deadline first</span>
          </div>
          <div className="scroll-x">
            <table className="table" style={{ minWidth: 560 }}>
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Missed meeting</th>
                  <th style={{ textAlign: 'center' }}>Pick one by</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[...owing].sort((x, y) => x.dueOn.localeCompare(y.dueOn)).map((d) => {
                  const m = state.members.find((x) => x.id === d.memberId);
                  const days = Math.round((Date.parse(d.dueOn) - Date.parse(DEMO_TODAY)) / 86_400_000);
                  const look = days < 0 ? { cls: 'bad', text: 'Overdue' } : days <= 3 ? { cls: 'warn', text: days === 0 ? 'Due today' : `${days} ${days === 1 ? 'day' : 'days'} left` } : { cls: 'neutral', text: `${days} days left` };
                  return (
                    <tr key={`${d.meetingId}-${d.memberId}`}>
                      <th scope="row" style={{ whiteSpace: 'nowrap' }}>
                        <span className="inline" style={{ gap: 8, flexWrap: 'nowrap' }}><Avatar small initials={m?.initials ?? '?'} />{m?.name ?? nameOf(d.memberId)}</span>
                      </th>
                      <td>{label(d)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600, whiteSpace: 'nowrap' }}>{shortDate(d.dueOn)}</td>
                      <td style={{ textAlign: 'center' }}><span className={`pill ${look.cls}`}>{look.text}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null;

  return (
    <section className="stack" style={{ gap: 'var(--gap)', width: '100%' }} aria-labelledby={asPage ? 'general-page-h' : 'general-h'}>
      {asPage ? null : (
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="general-h">General tasks</h2>
          <span className="small muted">Small jobs for the hub anyone can take. Missed a meeting? Pick one within 14 days.</span>
        </div>
      )}
      {asPage && isAdmin ? (
        // Admin page: left the tasks and who still owes one; right how many missed meetings were made up and the top helpers.
        <div className="gt-pair" style={{ gap: 'var(--gap)' }}>
          <div className="stack" style={{ gap: 'var(--gap)' }}>{tasksCard}{owingCard}</div>
          <div className="stack" style={{ gap: 'var(--gap)' }}><MadeUpCard /><HelpersCard /></div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 'var(--gap)' }}>{tasksCard}{owingCard}</div>
      )}
    </section>
  );
}

/** Admin: how many missed meetings were made up with a General task. */
export function MadeUpCard() {
  const { state, isAdmin } = useStore();
  // Make-ups: picked and finished, picked and in progress, still owed (on time), overdue.
  const duties = state.makeups;
  const statusOf = (taskId: number | null) => state.tasks.find((t) => t.id === taskId)?.status;
  const made = duties.filter((d) => d.taskId !== null && statusOf(d.taskId) === 'done').length;
  const picked = duties.filter((d) => d.taskId !== null && statusOf(d.taskId) !== 'done').length;
  const overdue = duties.filter((d) => d.taskId === null && d.dueOn < DEMO_TODAY).length;
  const owed = duties.filter((d) => d.taskId === null && d.dueOn >= DEMO_TODAY).length;
  const dutyTotal = made + picked + owed + overdue;
  if (!isAdmin || !dutyTotal) return null;
  const DUTY_PARTS = [
    { key: 'made', label: 'Made up', n: made, color: 'var(--good-dot)' },
    { key: 'picked', label: 'Picked, in progress', n: picked, color: '#7fa6e8' },
    { key: 'owed', label: 'Still owed', n: owed, color: '#e3a93b' },
    { key: 'overdue', label: 'Overdue', n: overdue, color: '#c93a3a' },
  ];
  return (
    <section className="card" aria-labelledby="gt-duty-h" style={{ gap: 10 }}>
      <div className="between" style={{ alignItems: 'baseline' }}>
        <h3 id="gt-duty-h">Missed meetings made up</h3>
        <span className="small"><strong>{Math.round((made / dutyTotal) * 100)} %</strong> <span className="muted">of {dutyTotal}</span></span>
      </div>
      <div className="gt-stack" role="img" aria-label={DUTY_PARTS.map((p) => `${p.label} ${p.n}`).join(', ')}>
        {DUTY_PARTS.filter((p) => p.n).map((p) => <span key={p.key} style={{ flex: `${p.n} 1 0`, background: p.color }} title={`${p.label}: ${p.n}`} />)}
      </div>
      <ul className="gt-legend">
        {DUTY_PARTS.map((p) => (
          <li key={p.key}><span className="swatch" style={{ background: p.color }} />{p.label}<strong>{p.n}</strong></li>
        ))}
      </ul>
    </section>
  );
}

/** Who finished the most General tasks. */
export function HelpersCard() {
  const { state } = useStore();
  const done = state.tasks.filter((t) => t.projectId === GENERAL_PROJECT && t.status === 'done' && t.doneAt && t.owner);
  const helpers = [...done.reduce((m, t) => m.set(t.owner!, (m.get(t.owner!) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return (
    <section className="card" aria-labelledby="gt-help-h" style={{ gap: 10 }}>
      <h3 id="gt-help-h">Most helpful 🙌</h3>
      {helpers.length ? (
        <ol className="gt-helpers">
          {helpers.map(([id, n], i) => {
            const m = state.members.find((x) => x.id === id);
            return (
              <li key={id}>
                <span className="lb-rank">{i + 1}</span>
                <Avatar small initials={m?.initials ?? '?'} />
                <span style={{ flex: '1 1 auto', fontWeight: 600, fontSize: 14 }}>{m?.name ?? id}</span>
                <span className="small"><strong>{n}</strong> done</span>
              </li>
            );
          })}
        </ol>
      ) : <span className="small muted">Nobody has finished a General task yet.</span>}
    </section>
  );
}

/** Members' General tasks page, right column. */
export function GeneralStats() {
  return (
    <aside className="stack" style={{ gap: 'var(--gap)' }} aria-label="General tasks analytics">
      <MadeUpCard />
      <HelpersCard />
    </aside>
  );
}
