'use client';

import { Fragment, type DragEvent } from 'react';
import { useStore } from '@/lib/store';
import type { Project, Task, TaskStatus } from '@/lib/types';
import { DEMO_TODAY, shortDate } from '@/lib/time';
import { Avatar } from '../ui';
import { BOARD_COLUMNS, STATUS_NAME, isMine, type ChangeTask, type DragState } from './shared';

interface Props {
  /** One project, or several when "All projects" is picked. */
  projects: Project[];
  tasks: Task[];
  mineOnly: boolean;
  drag: DragState | null;
  over: string | null;
  setOver: (key: string | null) => void;
  startDrag: (e: DragEvent, task: Task) => void;
  endDrag: () => void;
  open: (task: Task) => void;
  change: ChangeTask;
}

export function Board({ projects, tasks, mineOnly, drag, over, setOver, startDrag, endDrag, open, change }: Props) {
  const { state, me, memberName } = useStore();
  const many = projects.length > 1;

  const drop = (e: DragEvent, project: Project, workstream: string, status: TaskStatus) => {
    e.preventDefault();
    const task = state.tasks.find((t) => t.id === drag?.taskId);
    endDrag();
    if (!task) return;
    const patch: Partial<Task> = {};
    const bits: string[] = [];
    if (task.status !== status) { patch.status = status; bits.push(`moved it to ${STATUS_NAME[status]}`); }
    if (task.projectId !== project.id) { patch.projectId = project.id; bits.push(`moved it to ${project.name}`); }
    if (task.workstream !== workstream) { patch.workstream = workstream; bits.push(`moved it to the ${workstream} workstream`); }
    if (bits.length) change(task, patch, bits.join(' and '));
  };

  return (
    <div className="board-wrap">
      <table className="board">
        <thead>
          <tr>
            <th style={{ width: 160, color: 'var(--muted)' }}>Area</th>
            {BOARD_COLUMNS.map((s) => (
              <th key={s} style={{ width: s === 'idea' ? 150 : undefined, background: s === 'idea' ? '#f4f5f8' : s === 'done' ? '#d2ece3' : '#e3f1ec', color: s === 'idea' ? 'var(--muted)' : '#1e5a4c' }}>
                {STATUS_NAME[s]} <span style={{ opacity: 0.75 }}>{tasks.filter((t) => t.status === s).length}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <Fragment key={project.id}>
              {many ? (
                <tr>
                  <th colSpan={BOARD_COLUMNS.length + 1} style={{ background: 'var(--surface-2)', padding: '10px 12px', borderTop: '2px solid var(--line)' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{project.name}</span>
                    <span className="tiny muted" style={{ marginLeft: 8, fontWeight: 500 }}>
                      {tasks.filter((t) => t.projectId === project.id && t.status !== 'done' && t.status !== 'idea').length} open
                    </span>
                  </th>
                </tr>
              ) : null}
              {project.workstreams.map((w) => {
                const openCount = state.tasks.filter((t) => t.projectId === project.id && t.workstream === w.name && t.status !== 'done' && t.status !== 'idea').length;
                return (
                  <tr key={w.name}>
                    <th scope="row">
                      <div className="stack" style={{ gap: 6 }}>
                        <span className="inline" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 8 }}>
                          <span className="swatch" style={{ width: 14, height: 14, background: w.color, marginTop: 1 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{w.name}</span>
                        </span>
                        <span className="tiny muted" style={{ fontWeight: 500 }}>Lead: {memberName(w.lead)} · {openCount} open</span>
                      </div>
                    </th>
                    {BOARD_COLUMNS.map((s) => {
                      const key = `${project.id}|${w.name}|${s}`;
                      const cards = tasks.filter((t) => t.projectId === project.id && t.workstream === w.name && t.status === s);
                      return (
                        <td
                          key={s}
                          className={drag && over === key ? 'drop-hot' : undefined}
                          style={{ background: s === 'idea' ? '#fafbfc' : s === 'done' ? '#f6fbf9' : '#fff' }}
                          onDragOver={(e) => { e.preventDefault(); if (over !== key) setOver(key); }}
                          onDrop={(e) => drop(e, project, w.name, s)}
                        >
                          <div className="stack" style={{ gap: 6, minHeight: 40 }}>
                            {cards.map((t) => {
                              const late = t.due !== null && t.due < DEMO_TODAY && t.status !== 'done';
                              const faces = [t.owner, ...t.helpers].filter((x): x is string => !!x).slice(0, 3);
                              return (
                                <div
                                  key={t.id}
                                  className="sticky"
                                  draggable
                                  onDragStart={(e) => startDrag(e, t)}
                                  onDragEnd={endDrag}
                                  style={{
                                    background: w.color,
                                    color: w.color,
                                    outline: !mineOnly && isMine(t, me.id) ? '2px solid var(--blue)' : 'none',
                                    outlineOffset: 1,
                                    opacity: drag?.taskId === t.id ? 0.4 : 1,
                                  }}
                                >
                                  <button type="button" onClick={() => open(t)} aria-label={`${t.title}, owner ${memberName(t.owner)}`}>
                                    <span className="t">{t.title}</span>
                                    <span className="between" style={{ width: '100%', alignItems: 'center', flexWrap: 'nowrap' }}>
                                      <span className="faces">
                                        {faces.length ? faces.map((id, i) => {
                                          const m = state.members.find((x) => x.id === id);
                                          return <Avatar key={id} small initials={m?.initials ?? '?'} style={{ background: i === 0 ? 'var(--navy)' : '#fff', color: i === 0 ? '#fff' : 'var(--navy)' }} />;
                                        }) : <Avatar small initials="?" style={{ background: '#fff', color: 'var(--bad)' }} />}
                                      </span>
                                      {t.due ? <span style={{ fontSize: 11, fontWeight: 700, color: late ? 'var(--bad)' : 'var(--ink-2)' }}>{late ? 'Late · ' : ''}{shortDate(t.due)}</span> : null}
                                    </span>
                                  </button>
                                </div>
                              );
                            })}
                            {s === 'done' && w.doneEarlier && !mineOnly ? <span className="tiny muted">+ {w.doneEarlier} done earlier</span> : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
