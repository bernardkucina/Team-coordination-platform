'use client';

import { useState, type DragEvent } from 'react';
import { useStore } from '@/lib/store';
import type { Project, Task, TaskStatus } from '@/lib/types';
import { DEMO_TODAY, shortDate } from '@/lib/time';
import { Avatar, Icon, Progress } from '../ui';
import { STATUS_NAME, type ChangeTask } from './shared';

const ORDER: TaskStatus[] = ['progress', 'priority', 'validation', 'idea', 'done'];
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 } as const;

/** Open tasks in the order people dragged them into; tasks nobody has placed yet follow by status, priority and due date. */
const byListOrder = (a: Task, b: Task) =>
  (a.rank ?? Infinity) - (b.rank ?? Infinity)
  || ORDER.indexOf(a.status) - ORDER.indexOf(b.status)
  || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  || (a.due ?? '9').localeCompare(b.due ?? '9');

/** A project opened beside the board: every task as one to-do list you can reorder and add to. */
export function ProjectPanel({ project, onClose, openTask, change }: {
  project: Project; onClose: () => void; openTask: (task: Task) => void; change: ChangeTask;
}) {
  const { state, dispatch, me, flash } = useStore();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState(project.workstreams[0]?.name ?? '');

  const all = state.tasks.filter((t) => t.projectId === project.id);
  const openTasks = all.filter((t) => t.status !== 'done').sort(byListOrder);
  const doneTasks = all.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const real = all.filter((t) => t.status !== 'idea').length;
  const color = (t: Task) => project.workstreams.find((w) => w.name === t.workstream)?.color ?? 'var(--line-soft)';
  const areaName = project.workstreams.some((w) => w.name === area) ? area : project.workstreams[0]?.name ?? '';

  const move = (ids: number[]) => dispatch({ type: 'reorderTasks', ids });
  const dropOn = (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const ids = openTasks.map((t) => t.id).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    move(ids);
  };
  const nudge = (id: number, by: -1 | 1) => {
    const ids = openTasks.map((t) => t.id);
    const i = ids.indexOf(id);
    const j = i + by;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    move(ids);
  };

  const add = () => {
    const text = title.trim();
    if (!text || !areaName) return;
    const rank = openTasks.length;
    dispatch({ type: 'reorderTasks', ids: openTasks.map((t) => t.id) });
    dispatch({
      type: 'addTask',
      task: {
        projectId: project.id, title: text, workstream: areaName, status: 'priority', owner: null, helpers: [], priority: 'Medium',
        startWeek: null, endWeek: null, due: null, doneAt: null, notes: '', links: [], rank,
        history: [{ id: `new-${Date.now()}`, who: me.name.split(' ')[0], text: 'created this task', when: 'just now' }],
      },
    });
    flash(`Added to ${project.name}`);
    setTitle('');
  };

  const row = (t: Task, i: number, sortable: boolean) => {
    const isDone = t.status === 'done';
    const late = !isDone && t.due !== null && t.due < DEMO_TODAY;
    const owner = state.members.find((m) => m.id === t.owner);
    return (
      <li
        key={t.id}
        className={[isDone ? 'done' : '', t.priority === 'High' && !isDone ? 'high' : '', sortable && overId === t.id && dragId !== t.id ? 'drop-above' : '', dragId === t.id ? 'dragging' : ''].join(' ')}
        draggable={sortable}
        onDragStart={sortable ? (e: DragEvent) => { e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; setDragId(t.id); } : undefined}
        onDragOver={sortable ? (e: DragEvent) => { e.preventDefault(); if (overId !== t.id) setOverId(t.id); } : undefined}
        onDrop={sortable ? (e: DragEvent) => { e.preventDefault(); dropOn(t.id); setDragId(null); setOverId(null); } : undefined}
        onDragEnd={sortable ? () => { setDragId(null); setOverId(null); } : undefined}
      >
        {sortable ? (
          <span className="todo-grip" aria-hidden="true" title="Drag to reorder">⋮⋮</span>
        ) : <span className="todo-grip" aria-hidden="true" />}
        <button
          type="button" className="todo-check" aria-pressed={isDone}
          aria-label={isDone ? `Reopen ${t.title}` : `Finish ${t.title}`}
          onClick={() => change(t, { status: isDone ? 'progress' : 'done', doneAt: isDone ? null : DEMO_TODAY }, isDone ? 'reopened it' : 'moved it to Done')}
        >{isDone ? '✓' : ''}</button>
        <button type="button" className="todo-main" onClick={() => openTask(t)}>
          <span className="todo-title">
            {t.priority === 'High' && !isDone ? <span className="sr-only">High priority: </span> : null}
            {t.title}
          </span>
          <span className="inline tiny muted" style={{ gap: 6 }}>
            <span className="swatch" style={{ background: color(t) }} />
            {STATUS_NAME[t.status]}
            {t.due ? <span style={{ color: late ? 'var(--bad)' : undefined, fontWeight: late ? 700 : undefined }}>· {late ? 'Late · ' : ''}{shortDate(t.due)}</span> : null}
          </span>
        </button>
        {sortable ? (
          <span className="todo-move">
            <button type="button" aria-label={`Move ${t.title} up`} disabled={i === 0} onClick={() => nudge(t.id, -1)}>↑</button>
            <button type="button" aria-label={`Move ${t.title} down`} disabled={i === openTasks.length - 1} onClick={() => nudge(t.id, 1)}>↓</button>
          </span>
        ) : null}
        {owner ? <span title={owner.name}><Avatar small initials={owner.initials} /></span> : <span className="avatar sm" title="No owner yet" style={{ background: 'var(--line-soft)', color: 'var(--muted)' }}>?</span>}
      </li>
    );
  };

  return (
    <aside className="panel" aria-label={`${project.name} tasks`}>
      <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div className="stack" style={{ gap: 4 }}>
          <span className="tiny muted" style={{ fontWeight: 600 }}>Project</span>
          <h3 style={{ fontSize: 19, lineHeight: 1.3 }}>{project.number ? `${project.number} ` : ''}{project.name}</h3>
        </div>
        <button type="button" className="icon-btn" style={{ background: 'var(--line-soft)', color: 'var(--ink)', width: 36, height: 36, flex: 'none' }} aria-label="Close project" onClick={onClose}>{Icon.close}</button>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        <div className="between tiny muted"><span>{real - doneTasks.length} open</span><span>{doneTasks.length} done</span></div>
        <Progress value={doneTasks.length} max={real || 1} />
      </div>

      <ul className="todo" onDragLeave={(e) => { if (e.currentTarget === e.target) setOverId(null); }}>
        {openTasks.map((t, i) => row(t, i, true))}
      </ul>

      <form className="todo-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <label className="sr-only" htmlFor={`add-${project.id}`}>New task in {project.name}</label>
        <input id={`add-${project.id}`} className="field" placeholder="Add a task…" value={title} onChange={(e) => setTitle(e.target.value)} />
        {project.workstreams.length > 1 ? (
          <>
            <label className="sr-only" htmlFor={`add-area-${project.id}`}>Area</label>
            <select id={`add-area-${project.id}`} className="field select-plain" style={{ textAlign: 'left', textAlignLast: 'left', maxWidth: 150, textOverflow: 'ellipsis' }} value={areaName} onChange={(e) => setArea(e.target.value)}>
              {project.workstreams.map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
            </select>
          </>
        ) : null}
        <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim()}>Add</button>
      </form>

      {doneTasks.length ? (
        <div className="stack" style={{ gap: 0 }}>
          <span className="label" style={{ paddingBottom: 4 }}>Done</span>
          <ul className="todo">{doneTasks.map((t, i) => row(t, i, false))}</ul>
        </div>
      ) : null}
    </aside>
  );
}
