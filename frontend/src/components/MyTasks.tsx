'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
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
  const popRef = useRef<HTMLDivElement>(null);
  const [popAt, setPopAt] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  // The options popup closes on a click outside it or on Escape.
  useEffect(() => {
    if (moreOpen === null) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popRef.current?.contains(target) || target.closest('[aria-haspopup="dialog"]')) return;
      setMoreOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(null);
    const close = () => setMoreOpen(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [moreOpen]);

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
              <th style={{ width: 56, textAlign: 'center' }}>Done</th>
              <th><span className="sr-only">Task</span></th>
              <th style={{ textAlign: 'center' }}>Priority</th>
              <th style={{ textAlign: 'center' }}>Due</th>
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
                  <td style={{ padding: '6px 0', textAlign: 'center' }}>
                    <button
                      type="button" className="done-btn" aria-label={`Mark ${t.title} as done`}
                      data-tip="Mark as done: moves it to Done (not deleted)"
                      onClick={() => { update(t.id, { status: 'done' }, 'moved it to Done'); flash(`Moved to Done: ${t.title}`); }}
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </button>
                  </td>
                  <td>
                    <div className="stack" style={{ gap: 4 }}>
                      <span style={{ fontWeight: 600 }}>{t.title}</span>
                      <span className="inline tiny muted" style={{ gap: 6 }}>
                        <span className="swatch" style={{ background: ws?.color ?? 'var(--butter)' }} />{project?.name ?? 'Community'} · {t.workstream}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
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
                    <div className="inline" style={{ flexWrap: 'nowrap', justifyContent: 'center' }}>
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
                      type="button" className="icon-btn" aria-haspopup="dialog" aria-expanded={moreOpen === t.id} aria-label={`More options for ${t.title}`}
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setPopAt({ top: r.bottom + 6, right: window.innerWidth - r.right });
                        setMoreOpen(moreOpen === t.id ? null : t.id);
                      }}
                    >{Icon.more}</button>
                    {moreOpen === t.id ? (
                      <div ref={popRef} className="task-pop" role="dialog" aria-label={`Options for ${t.title}`} style={{ top: popAt.top, right: popAt.right }}>
                        <label className="label" htmlFor={`hand-${t.id}`}>Hand to</label>
                        <select
                          id={`hand-${t.id}`} className="field" style={{ minHeight: 36, width: '100%' }} value=""
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
                        <Link href="/projects" className="small strong">Open task in Projects</Link>
                      </div>
                    ) : null}
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
