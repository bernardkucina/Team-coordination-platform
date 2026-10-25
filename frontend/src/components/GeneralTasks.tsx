'use client';

import { useState, type FormEvent } from 'react';
import { useStore } from '@/lib/store';
import { api } from '@/lib/api';
import { GENERAL_PROJECT, type MakeupDuty, type Task } from '@/lib/types';
import { DEMO_TODAY, shortDate } from '@/lib/time';
import { Avatar } from './ui';

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

  return (
    <section className="stack" style={{ gap: 'var(--gap)' }} aria-labelledby={asPage ? 'general-page-h' : 'general-h'}>
      {asPage ? null : (
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="general-h">General tasks</h2>
          <span className="small muted">Small jobs for the hub anyone can take. Missed a meeting? Pick one within 14 days.</span>
        </div>
      )}
      <div className="card" style={{ gap: 10 }}>
        {tasks.length ? (
          <ul className="stack" style={{ gap: 10, listStyle: 'none', margin: 0, padding: 0 }}>
            {tasks.map((t) => (
              <li key={t.id} className="between" style={{ alignItems: 'center', gap: 12 }}>
                <span className="stack" style={{ gap: 2 }}>
                  <span className="small strong">{t.title}</span>
                  <span className="tiny muted">{t.owner ? `${nameOf(t.owner)}${t.due ? ` · due ${shortDate(t.due)}` : ''}` : 'Open'}</span>
                </span>
                {t.owner ? (
                  <span className={t.owner === me.id ? 'pill info' : 'pill neutral'}>{t.owner === me.id ? 'Yours' : 'Taken'}</span>
                ) : (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => take(t)}>Take it</button>
                )}
              </li>
            ))}
          </ul>
        ) : <span className="small muted">No open General tasks.</span>}
        {isAdmin ? (
          <form className="inline" style={{ flexWrap: 'nowrap', gap: 8 }} onSubmit={(e) => void add(e)}>
            <label className="sr-only" htmlFor="general-new">New General task</label>
            <input id="general-new" className="field" style={{ flex: '1 1 auto', minHeight: 40 }} placeholder="Add a General task" value={title} onChange={(e) => setTitle(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim()}>Add</button>
          </form>
        ) : null}
      </div>
      {isAdmin && owing.length ? (
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
      ) : null}
    </section>
  );
}
