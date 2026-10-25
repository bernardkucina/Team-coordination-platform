'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import type { Priority, Task, TaskStatus } from '@/lib/types';
import { shortDate, weekOf } from '@/lib/time';
import { Avatar, Icon } from '../ui';
import { BOARD_COLUMNS, STATUS_NAME, type ChangeTask } from './shared';

export function TaskPanel({ task, color, onClose, change }: { task: Task; color: string; onClose: () => void; change: ChangeTask }) {
  const { state, dispatch, me, memberName } = useStore();
  const [notes, setNotes] = useState(task.notes);
  const [title, setTitle] = useState(task.title);
  // The title box grows with its text, so long names are never cut off.
  const titleRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');

  // Switching to another task resets the drafts.
  useEffect(() => { setNotes(task.notes); setTitle(task.title); setLink(''); setComment(''); }, [task.id, task.notes, task.title]);

  const addable = state.members.filter((m) => m.id !== task.owner && !task.helpers.includes(m.id));

  const addLink = () => {
    const raw = link.trim();
    if (!raw) return;
    const url = /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
    change(task, { links: [...task.links, { label: raw.replace(/^https?:\/\//, '').slice(0, 48), url }] }, 'added a link');
    setLink('');
  };

  const addComment = () => {
    const text = comment.trim();
    if (!text) return;
    dispatch({ type: 'comment', taskId: task.id, who: me.name, text });
    setComment('');
  };

  return (
    <aside className="panel" aria-label="Task">
      <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <span className="inline tiny muted" style={{ gap: 6, fontWeight: 600 }}><span className="swatch" style={{ background: color }} />{task.workstream}</span>
        <button type="button" className="icon-btn" style={{ background: 'var(--line-soft)', color: 'var(--ink)', width: 36, height: 36 }} aria-label="Close task" onClick={onClose}>{Icon.close}</button>
      </div>
      <label className="sr-only" htmlFor="f-title">Task title</label>
      <textarea
        id="f-title" ref={titleRef} className="title-input" rows={1} placeholder="What needs to happen?" value={title} autoFocus={!task.title}
        onChange={(e) => setTitle(e.target.value.replace(/\n/g, ''))}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        onBlur={() => { const v = title.trim(); if (v && v !== task.title) change(task, { title: v }, task.title ? 'renamed the task' : 'named the task'); }}
      />

      <div className="grid-2">
        <div className="field-group">
          <label className="label" htmlFor="f-project">Project</label>
          <select
            id="f-project" className="field" value={task.projectId}
            onChange={(e) => {
              const p = state.projects.find((x) => x.id === e.target.value);
              if (!p || p.id === task.projectId) return;
              change(task, { projectId: p.id, workstream: p.workstreams[0]?.name ?? task.workstream }, `moved it to ${p.name}`);
            }}
          >
            {state.projects.filter((p) => p.status === 'active').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label className="label" htmlFor="f-area">Area</label>
          <select
            id="f-area" className="field" value={task.workstream}
            onChange={(e) => { if (e.target.value !== task.workstream) change(task, { workstream: e.target.value }, `moved it to ${e.target.value}`); }}
          >
            {(state.projects.find((p) => p.id === task.projectId)?.workstreams ?? []).map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-2">
        <div className="field-group">
          <label className="label" htmlFor="f-status">Status</label>
          <select
            id="f-status" className="field" value={task.status}
            onChange={(e) => {
              const v = e.target.value as TaskStatus;
              if (v !== task.status) change(task, { status: v }, `moved it to ${STATUS_NAME[v]}`);
            }}
          >
            {BOARD_COLUMNS.map((s) => <option key={s} value={s}>{STATUS_NAME[s]}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label className="label" htmlFor="f-prio">Priority</label>
          <select
            id="f-prio" className="field" value={task.priority}
            onChange={(e) => {
              const v = e.target.value as Priority;
              if (v !== task.priority) change(task, { priority: v }, `changed priority from ${task.priority} to ${v}`);
            }}
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
        <div className="field-group">
          <label className="label" htmlFor="f-owner">Owner</label>
          <select
            id="f-owner" className="field" value={task.owner ?? ''} style={{ borderColor: task.owner ? undefined : 'var(--ink)' }}
            onChange={(e) => {
              const v = e.target.value || null;
              if (v === task.owner) return;
              const text = v ? (task.owner ? `handed it from ${memberName(task.owner)} to ${memberName(v)}` : `set the owner to ${memberName(v)}`) : 'removed the owner';
              change(task, { owner: v, helpers: task.helpers.filter((h) => h !== v) }, text);
            }}
          >
            <option value="">No owner yet</option>
            {state.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div className="field-group">
          <label className="label" htmlFor="f-due">Deadline</label>
          <input
            id="f-due" type="date" className="field" value={task.due ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (!v || v === task.due) return;
              const end = weekOf(v);
              const start = task.startWeek === null ? end : Math.min(task.startWeek, end);
              change(task, { due: v, endWeek: end, startWeek: start }, `changed the deadline ${task.due ? `from ${shortDate(task.due)} ` : ''}to ${shortDate(v)}`);
            }}
          />
        </div>
      </div>
      {!task.owner ? (
        <button type="button" className="btn btn-primary" onClick={() => change(task, { owner: me.id, helpers: task.helpers.filter((h) => h !== me.id) }, 'took ownership')}>
          Nobody owns this. I&apos;ll take it
        </button>
      ) : null}

      <div className="field-group" style={{ gap: 8 }}>
        <span className="label">Also working on it</span>
        <div className="inline" style={{ gap: 6 }}>
          {task.helpers.map((h) => (
            <span key={h} className="pill info" style={{ padding: '2px 4px 2px 10px', fontSize: 13 }}>
              {memberName(h)}
              <button
                type="button" aria-label={`Remove ${memberName(h)}`}
                style={{ width: 26, height: 26, border: 0, borderRadius: '50%', background: 'transparent', color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => change(task, { helpers: task.helpers.filter((x) => x !== h) }, `removed ${memberName(h)}`)}
              >{Icon.close}</button>
            </span>
          ))}
          <label className="sr-only" htmlFor="f-help">Add a person</label>
          <select
            id="f-help" className="field" value="" style={{ minHeight: 32, borderRadius: 999, borderStyle: 'dashed', borderColor: 'var(--ink)', color: 'var(--blue)', fontSize: 13 }}
            onChange={(e) => e.target.value && change(task, { helpers: [...task.helpers, e.target.value] }, `added ${memberName(e.target.value)} to the task`)}
          >
            <option value="">+ Add person</option>
            {addable.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <div className="field-group">
        <label className="label" htmlFor="f-notes">Notes</label>
        <textarea
          id="f-notes" className="field" rows={4} placeholder="Context, decisions, next steps" value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== task.notes) change(task, { notes }, 'edited the notes'); }}
        />
      </div>

      <div className="field-group" style={{ gap: 8 }}>
        <span className="label">Links</span>
        {task.links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="inline small strong" style={{ gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', textDecoration: 'none' }}>
            {Icon.link}{l.label}
          </a>
        ))}
        <div className="inline" style={{ flexWrap: 'nowrap', gap: 6 }}>
          <label className="sr-only" htmlFor="f-link">Paste a link</label>
          <input id="f-link" className="field" style={{ flex: '1 1 auto', minWidth: 0 }} placeholder="Paste a link (Drive, Docs, Slack…)" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addLink()} />
          <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 40 }} onClick={addLink}>Add</button>
        </div>
      </div>

      <div className="stack" style={{ gap: 10, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
        <span className="label">Activity</span>
        <div className="inline" style={{ flexWrap: 'nowrap', gap: 6 }}>
          <label className="sr-only" htmlFor="f-comment">Write a comment</label>
          <input id="f-comment" className="field" style={{ flex: '1 1 auto', minWidth: 0 }} placeholder="Write a comment" value={comment} onChange={(e) => setComment(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addComment()} />
          <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 40 }} onClick={addComment}>Post</button>
        </div>
        <ol className="stack" style={{ gap: 10 }}>
          {task.history.map((h) => {
            const who = state.members.find((m) => m.name === h.who);
            return (
              <li key={h.id} className="inline" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10 }}>
                <Avatar small initials={who?.initials ?? h.who.slice(0, 2).toUpperCase()} />
                <span className="stack" style={{ gap: 4, minWidth: 0 }}>
                  <span className="small" style={{ lineHeight: 1.4 }}><strong>{h.who}</strong> {h.text} <span className="muted">· {h.when}</span></span>
                  {h.comment ? <span className="small" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--surface-2)', lineHeight: 1.45 }}>{h.comment}</span> : null}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
