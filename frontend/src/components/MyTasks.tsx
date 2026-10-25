'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useStore } from '@/lib/store';
import type { Priority, Task } from '@/lib/types';
import { CURRENT_WEEK, DEMO_TODAY, shortDate, weekOf } from '@/lib/time';
import { Icon } from './ui';

const PRIORITY_LOOK: Record<Priority, { bg: string; fg: string; border: string }> = {
  High: { bg: 'var(--bad-bg)', fg: 'var(--ink)', border: 'var(--ink)' },
  Medium: { bg: 'var(--warn-bg)', fg: 'var(--ink)', border: 'var(--ink)' },
  Low: { bg: 'var(--line-soft)', fg: 'var(--muted)', border: 'var(--field)' },
};

/** Open tasks the current user owns that are due this week (or earlier), or in progress. */
export function MyTasks() {
  const { state, dispatch, me, memberName, flash } = useStore();
  const [moreOpen, setMoreOpen] = useState<number | null>(null);

  const tasks = state.tasks
    .filter((t) => t.owner === me.id && t.status !== 'done' && t.status !== 'idea')
    .filter((t) => t.status === 'progress' || t.workstream === 'General task' || (t.due !== null && weekOf(t.due) <= CURRENT_WEEK + 1))
    .sort((a, b) => (a.due ?? '9').localeCompare(b.due ?? '9'));
  const projectCount = new Set(tasks.map((t) => t.projectId)).size;
  const finishedThisWeek = state.tasks.filter((t) => t.owner === me.id && t.status === 'done' && !!t.doneAt && weekOf(t.doneAt) === CURRENT_WEEK).length;

  const update = (id: number, patch: Partial<Task>, text: string) =>
    dispatch({ type: 'updateTask', taskId: id, patch, who: me.name, text });

  return (
    <section className="card" aria-labelledby="tasks-h">
      <div className="between">
        <h2 id="tasks-h">My tasks this week</h2>
        <Link href="/projects" className="small strong">See all projects</Link>
      </div>
      <span className="small muted">{tasks.length} open across {projectCount} projects · {finishedThisWeek} finished this week</span>
      <div className="scroll-x">
        <table className="table" style={{ minWidth: 620 }}>
          <thead>
            <tr>
              <th style={{ width: 44 }}><span className="sr-only">Finish</span></th>
              <th>Task</th>
              <th>Priority</th>
              <th>Due</th>
              <th style={{ width: 44 }}><span className="sr-only">More</span></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const project = state.projects.find((p) => p.id === t.projectId);
              const ws = project?.workstreams.find((w) => w.name === t.workstream);
              const look = PRIORITY_LOOK[t.priority];
              const late = t.due !== null && t.due < DEMO_TODAY;
              const today = t.due === DEMO_TODAY;
              return (
                <tr key={t.id} id={`task-${t.id}`}>
                  <td style={{ padding: '6px 0' }}>
                    <button
                      type="button" className="icon-btn" aria-label={`Finish ${t.title}`}
                      onClick={() => { update(t.id, { status: 'done' }, 'moved it to Done'); flash(`Finished: ${t.title}`); }}
                    >
                      <span style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #a3b6d5' }} />
                    </button>
                  </td>
                  <td>
                    <div className="stack" style={{ gap: 4 }}>
                      <span style={{ fontWeight: 600 }}>{t.title}</span>
                      <span className="inline tiny muted" style={{ gap: 6 }}>
                        <span className="swatch" style={{ background: ws?.color ?? 'var(--butter)' }} />{project?.name ?? 'Community'} · {t.workstream}
                      </span>
                      {moreOpen === t.id ? (
                        <div className="inline" style={{ marginTop: 6, padding: 10, borderRadius: 8, background: 'var(--surface-2)' }}>
                          <label className="label" htmlFor={`hand-${t.id}`}>Hand to</label>
                          <select
                            id={`hand-${t.id}`} className="field" style={{ minHeight: 36 }} value=""
                            onChange={(e) => {
                              const to = e.target.value;
                              if (!to) return;
                              update(t.id, { owner: to, helpers: t.helpers.filter((h) => h !== to) }, `handed it from ${me.name} to ${memberName(to)}`);
                              flash(`Handed to ${memberName(to)}`);
                              setMoreOpen(null);
                            }}
                          >
                            <option value="">Choose person</option>
                            {state.members.filter((m) => m.id !== me.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                          </select>
                          <Link href="/projects" className="tiny strong">Open task in Projects</Link>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`prio-${t.id}`}>Priority for {t.title}</label>
                    <select
                      id={`prio-${t.id}`} className="field select-plain" value={t.priority}
                      style={{ minHeight: 36, background: look.bg, color: look.fg, borderColor: look.border, fontWeight: 600, fontSize: 13 }}
                      onChange={(e) => update(t.id, { priority: e.target.value as Priority }, `changed priority from ${t.priority} to ${e.target.value}`)}
                    >
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </td>
                  <td>
                    <div className="inline" style={{ flexWrap: 'nowrap' }}>
                      <label className="sr-only" htmlFor={`due-${t.id}`}>Due date for {t.title}</label>
                      <input
                        id={`due-${t.id}`} type="date" className="date-plain" value={t.due ?? ''}
                        onClick={(e) => { try { e.currentTarget.showPicker(); } catch { /* older browsers: native input still editable */ } }}
                        onChange={(e) => e.target.value && update(t.id, { due: e.target.value, endWeek: weekOf(e.target.value) }, `changed the deadline to ${shortDate(e.target.value)}`)}
                      />
                      {late ? <span className="tiny strong" style={{ color: 'var(--red)' }}>Overdue</span> : null}
                      {today ? <span className="tiny strong" style={{ color: 'var(--warn)' }}>Today</span> : null}
                    </div>
                  </td>
                  <td>
                    <button
                      type="button" className="icon-btn" aria-expanded={moreOpen === t.id} aria-label={`More options for ${t.title}`}
                      onClick={() => setMoreOpen(moreOpen === t.id ? null : t.id)}
                    >{Icon.more}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tasks.length === 0 ? <p className="muted small">Nothing due this week.</p> : null}
    </section>
  );
}
