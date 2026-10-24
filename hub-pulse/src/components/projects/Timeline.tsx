'use client';

import type { DragEvent } from 'react';
import { useStore } from '@/lib/store';
import type { Project, Task } from '@/lib/types';
import { CURRENT_WEEK, dateInWeek, fridayOf, monthOfWeek, shortDate } from '@/lib/time';
import { isMine, type ChangeTask, type DragState } from './shared';

const FIRST_WEEK = 41;
const SPAN = 12;
const WEEKS = Array.from({ length: SPAN }, (_, i) => FIRST_WEEK + i);
const TODAY_FRAC = (CURRENT_WEEK - FIRST_WEEK + 4.5 / 7) / SPAN;

interface Lane {
  key: string;
  project: Project;
  workstream: string;
  color: string;
}

interface Props {
  /** One project, or several when "All projects" is picked. */
  projects: Project[];
  tasks: Task[];
  mineOnly: boolean;
  drag: DragState | null;
  over: string | null;
  setOver: (key: string | null) => void;
  startDrag: (e: DragEvent, task: Task, mode: 'move' | 'resize') => void;
  endDrag: () => void;
  open: (task: Task) => void;
  change: ChangeTask;
}

export function Timeline({ projects, tasks, mineOnly, drag, over, setOver, startDrag, endDrag, open, change }: Props) {
  const { state, me, memberName } = useStore();
  const many = projects.length > 1;

  const lanes: Lane[] = projects.flatMap((p) => p.workstreams.map((w) => ({ key: `${p.id}|${w.name}`, project: p, workstream: w.name, color: w.color })));

  const drop = (e: DragEvent, lane: Lane, week: number) => {
    e.preventDefault();
    const task = state.tasks.find((t) => t.id === drag?.taskId);
    const mode = drag?.mode;
    endDrag();
    if (!task || task.startWeek === null || task.endWeek === null) return;
    const patch: Partial<Task> = {};
    const bits: string[] = [];
    if (mode === 'resize') {
      const end = Math.max(task.startWeek, week);
      if (end !== task.endWeek) { patch.endWeek = end; patch.due = fridayOf(end); bits.push(`changed the deadline to ${shortDate(fridayOf(end))}`); }
    } else {
      const length = task.endWeek - task.startWeek;
      if (week !== task.startWeek) {
        patch.startWeek = week; patch.endWeek = week + length; patch.due = fridayOf(week + length);
        bits.push(`moved the dates, deadline now ${shortDate(fridayOf(week + length))}`);
      }
      if (lane.project.id !== task.projectId) { patch.projectId = lane.project.id; bits.push(`moved it to ${lane.project.name}`); }
      if (lane.workstream !== task.workstream) { patch.workstream = lane.workstream; bits.push(`moved it to the ${lane.workstream} workstream`); }
    }
    if (bits.length) change(task, patch, bits.join(' and '));
  };

  const cells = (lane: Lane, rowKey: string) => WEEKS.map((w) => {
    const key = `tl|${rowKey}|${w}`;
    const hot = !!drag && over === key;
    return (
      <div
        key={w}
        className={hot ? 'tl-cell hot' : 'tl-cell'}
        style={{ background: hot ? undefined : w === CURRENT_WEEK ? '#fbfcfe' : undefined }}
        onDragOver={(e) => { e.preventDefault(); if (over !== key) setOver(key); }}
        onDrop={(e) => drop(e, lane, w)}
      />
    );
  });

  const rendered = lanes
    .map((lane) => ({
      lane,
      items: tasks.filter((t) => t.projectId === lane.project.id && t.workstream === lane.workstream && t.startWeek !== null && t.endWeek !== null),
    }))
    .filter(({ items }) => items.length > 0);

  return (
    <div className="tl-wrap">
      <div className="tl">
        <div className="tl-row" style={{ alignItems: 'flex-end', paddingBottom: 8, borderBottom: '1px solid var(--line)' }}>
          <span className="tl-label tiny strong muted">Task</span>
          <div className="tl-track">
            {WEEKS.map((w, i) => (
              <span key={w} style={{ flex: '1 1 0', fontSize: 11, color: 'var(--muted)', paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)', minHeight: 14 }}>{i === 0 || monthOfWeek(w) !== monthOfWeek(w - 1) ? monthOfWeek(w) : ''}</span>
                W{w}
              </span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(240px + (100% - 240px) * ${TODAY_FRAC})`, borderLeft: '2px solid var(--red)', zIndex: 1, pointerEvents: 'none' }} />
          {rendered.length === 0 ? <p className="small muted" style={{ padding: '16px 0' }}>No dated tasks here.</p> : null}
          {rendered.map(({ lane, items }) => (
            <div key={lane.key}>
              <div className="tl-row" style={{ borderTop: '1px solid var(--line-soft)', minHeight: 34 }}>
                <span className="tl-label strong" style={{ gap: 8 }}>
                  <span className="swatch" style={{ width: 12, height: 12, background: lane.color }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {many ? <span className="muted" style={{ fontWeight: 500 }}>{lane.project.name} · </span> : null}{lane.workstream}
                  </span>
                </span>
                <div className="tl-track">{cells(lane, `${lane.key}|head`)}</div>
              </div>
              {items.map((t) => {
                const start = Math.max(t.startWeek ?? FIRST_WEEK, FIRST_WEEK);
                const end = Math.min(t.endWeek ?? FIRST_WEEK, FIRST_WEEK + SPAN - 1);
                return (
                  <div key={t.id} className="tl-row">
                    <button
                      type="button" className="tl-label" onClick={() => open(t)}
                      style={{ border: 0, background: 'transparent', padding: '0 12px 0 20px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', color: 'var(--ink)' }}
                    >{t.title}</button>
                    <div className="tl-track">
                      {cells(lane, `${lane.key}|${t.id}`)}
                      <div
                        className="tl-bar"
                        draggable
                        onDragStart={(e) => startDrag(e, t, 'move')}
                        onDragEnd={endDrag}
                        onClick={() => open(t)}
                        title={`${t.title} · ${shortDate(dateInWeek(t.startWeek ?? CURRENT_WEEK, 0))} to ${shortDate(t.due)}`}
                        style={{
                          left: `${((start - FIRST_WEEK) / SPAN) * 100}%`,
                          width: `${(Math.max(1, end - start + 1) / SPAN) * 100}%`,
                          background: lane.color,
                          outline: !mineOnly && isMine(t, me.id) ? '2px solid var(--blue)' : 'none',
                          outlineOffset: 1,
                          pointerEvents: drag ? 'none' : 'auto',
                          opacity: drag?.taskId === t.id ? 0.4 : 1,
                        }}
                      >
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{memberName(t.owner)}</span>
                        <span
                          className="grip" draggable aria-hidden="true"
                          onDragStart={(e) => { e.stopPropagation(); startDrag(e, t, 'resize'); }}
                          onDragEnd={endDrag}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="inline tiny muted" style={{ gap: 16, marginTop: 12 }}>
          <span className="inline" style={{ gap: 6 }}><span style={{ width: 14, borderTop: '2px solid var(--red)' }} />Today</span>
          <span>Drag a bar sideways to move the dates, or to another workstream. Drag its right edge to change the deadline.</span>
          <span>Ideas without dates are not shown here.</span>
        </div>
      </div>
    </div>
  );
}
