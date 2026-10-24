'use client';

import { useEffect, useState, type DragEvent } from 'react';
import { useStore } from '@/lib/store';
import { AREAS, areaById } from '@/lib/data';
import type { AreaId, Task } from '@/lib/types';
import { Avatar, Segmented } from '../ui';
import { Board } from './Board';
import { NewProjectDialog } from './NewProjectDialog';
import { TaskPanel } from './TaskPanel';
import { Timeline } from './Timeline';
import { STATUS_NAME, isMine, type ChangeTask, type DragMode, type DragState } from './shared';

type View = 'board' | 'timeline';
type Scope = 'mine' | 'all';
export const ALL_PROJECTS = 'all';

export function ProjectsView({ projectId, onProjectId }: { projectId: string; onProjectId: (id: string) => void }) {
  const { state, dispatch, me, isAdmin, memberName, flash } = useStore();
  const [view, setView] = useState<View>('board');
  const [scope, setScope] = useState<Scope>('all');
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const activeProjects = state.projects.filter((p) => p.status === 'active');

  // Open a freshly created project as soon as it lands in the store.
  useEffect(() => {
    if (!pendingName) return;
    const created = [...state.projects].reverse().find((p) => p.name === pendingName);
    if (created) { onProjectId(created.id); setPendingName(null); }
  }, [pendingName, state.projects, onProjectId]);

  const projects = projectId === ALL_PROJECTS ? activeProjects : activeProjects.filter((p) => p.id === projectId);
  const projectIds = new Set(projects.map((p) => p.id));
  const inScope = state.tasks.filter((t) => projectIds.has(t.projectId));
  const visible = inScope.filter((t) => scope === 'all' || isMine(t, me.id));
  const selectedTask = state.tasks.find((t) => t.id === selected);
  const open = inScope.filter((t) => t.status !== 'done' && t.status !== 'idea');
  const single = projects.length === 1 ? projects[0] : null;
  const inTeam = !!single && single.members.includes(me.id);
  const missingAreas = single ? AREAS.filter((a) => !single.workstreams.some((w) => w.name === a.name)) : [];

  // "projectId::workstream" pairs for the quick-add dropdown.
  const targets = projects.flatMap((p) => p.workstreams.map((w) => ({ value: `${p.id}::${w.name}`, label: single ? w.name : `${p.name} · ${w.name}` })));
  const target = targets.some((t) => t.value === newTarget) ? newTarget : targets[0]?.value ?? '';

  // Every change goes through here, so every change lands in the task history.
  const change: ChangeTask = (task, patch, text) => {
    dispatch({ type: 'updateTask', taskId: task.id, patch, who: me.name.split(' ')[0], text });
    flash(`${me.name.split(' ')[0]} ${text}`);
  };

  const startDrag = (e: DragEvent, task: Task, mode: DragMode = 'move') => {
    e.dataTransfer.setData('text/plain', String(task.id));
    e.dataTransfer.effectAllowed = 'move';
    // Defer so the browser takes its drag image before we restyle the card.
    setTimeout(() => setDrag({ taskId: task.id, mode }), 0);
  };
  const endDrag = () => { setDrag(null); setOver(null); };

  const addTask = () => {
    const title = newTitle.trim();
    if (!title || !target) return;
    const [pid, workstream] = target.split('::');
    const status = isAdmin ? 'priority' : 'idea';
    dispatch({
      type: 'addTask',
      task: {
        projectId: pid, title, workstream, status, owner: null, helpers: [], priority: 'Medium',
        startWeek: null, endWeek: null, due: null, doneAt: null, notes: '', links: [],
        history: [{ id: `new-${Date.now()}`, who: me.name.split(' ')[0], text: 'created this task', when: 'just now' }],
      },
    });
    flash(`Added to ${STATUS_NAME[status]}`);
    setNewTitle('');
  };

  const joinOrLeave = () => {
    if (!single) return;
    dispatch({ type: inTeam ? 'leaveProject' : 'joinProject', projectId: single.id, memberId: me.id });
    flash(inTeam ? `You left ${single.name}` : `You joined ${single.name}`);
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div className="field-group">
          <label className="label" htmlFor="projsel" style={{ fontSize: 13 }}>Project</label>
          <select
            id="projsel" className="field" style={{ minHeight: 44, fontSize: 20, fontWeight: 700, borderRadius: 10 }} value={projectId}
            onChange={(e) => { onProjectId(e.target.value); setSelected(null); }}
          >
            <option value={ALL_PROJECTS}>All projects</option>
            {activeProjects.map((p) => <option key={p.id} value={p.id}>{p.number ? `${p.number} ` : ''}{p.name}</option>)}
          </select>
          <span className="small muted">
            {projects.length > 1 ? `${projects.length} projects · ` : `${single?.workstreams.length ?? 0} areas · `}
            {open.length} open · {open.filter((t) => !t.owner).length} without an owner · {inScope.filter((t) => t.status === 'idea').length} ideas
          </span>
        </div>
        {isAdmin ? <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)}>+ New project</button> : null}
      </div>

      {single ? (
        <section className="card" aria-label={`About ${single.name}`} style={{ padding: 20, gap: 12 }}>
          <div className="between" style={{ alignItems: 'flex-start' }}>
            <div className="inline" style={{ gap: 8 }}>
              <span className="pill" style={{ background: areaById(single.mainArea).color, color: 'var(--ink)' }}>{areaById(single.mainArea).name}</span>
              {single.tags.map((t) => <span key={t} className="pill neutral">{t}</span>)}
            </div>
            <button type="button" className={inTeam ? 'btn btn-quiet btn-sm' : 'btn btn-primary btn-sm'} style={{ minHeight: 38 }} onClick={joinOrLeave}>
              {inTeam ? 'Leave project' : 'Join project'}
            </button>
          </div>
          {single.description ? <p className="small" style={{ lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 900 }}>{single.description}</p> : null}
          <div className="row" style={{ gap: 20 }}>
            {single.roles.length ? (
              <div className="stack" style={{ gap: 6, flex: '2 1 360px' }}>
                <span className="label">Roles</span>
                <ul className="inline" style={{ gap: 6 }}>
                  {single.roles.map((r) => <li key={r.name} className="pill info" title={r.description}>{r.name}</li>)}
                </ul>
              </div>
            ) : null}
            <div className="stack" style={{ gap: 6, flex: '1 1 260px' }}>
              <span className="label">Team · lead {memberName(single.lead)}</span>
              <div className="inline" style={{ gap: 4 }}>
                {single.members.map((id) => {
                  const m = state.members.find((x) => x.id === id);
                  return m ? <span key={id} title={m.name}><Avatar small initials={m.initials} /></span> : null;
                })}
                <span className="tiny muted" style={{ marginLeft: 4 }}>{single.members.length} people</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="between" style={{ alignItems: 'center' }}>
        <div className="inline" style={{ gap: 10 }}>
          <Segmented label="View" value={view} onChange={setView} options={[{ value: 'board', label: 'Board' }, { value: 'timeline', label: 'Timeline' }]} />
          <Segmented label="Whose tasks" value={scope} onChange={setScope} options={[{ value: 'mine', label: 'My tasks' }, { value: 'all', label: 'All tasks' }]} />
        </div>
        <div className="inline" style={{ gap: 6 }}>
          <label className="sr-only" htmlFor="newtarget">Where the new task goes</label>
          <select id="newtarget" className="field" style={{ maxWidth: 240, fontSize: 13 }} value={target} onChange={(e) => setNewTarget(e.target.value)}>
            {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="newtitle">New task</label>
          <input id="newtitle" className="field" style={{ width: 190, fontSize: 13 }} placeholder={isAdmin ? 'New task' : 'New idea'} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
          <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 40 }} onClick={addTask}>Add</button>
        </div>
      </div>
      <span className="tiny muted" style={{ marginTop: -6 }}>
        {view === 'board'
          ? 'Rows are the areas working on the project. Drag a card to another column to change its status, or to another row to change its area. Click a card to open it.'
          : 'Drag a bar sideways to move the dates, or to another area. Drag its right edge to change the deadline.'}
      </span>

      <div className="row" style={{ gap: 16 }}>
        <div style={{ flex: '999 1 600px', minWidth: 0 }}>
          {view === 'board' ? (
            <>
              <Board projects={projects} tasks={visible} mineOnly={scope === 'mine'} drag={drag} over={over} setOver={setOver}
                startDrag={(e, t) => startDrag(e, t)} endDrag={endDrag} open={(t) => setSelected(t.id)} change={change} />
              {isAdmin && single && missingAreas.length ? (
                <div className="inline" style={{ gap: 6, marginTop: 12 }}>
                  <label className="sr-only" htmlFor="addarea">Add an area to this project</label>
                  <select
                    id="addarea" className="field" style={{ fontSize: 13 }} value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      dispatch({ type: 'addArea', projectId: single.id, areaId: e.target.value as AreaId, lead: single.lead });
                      flash(`${areaById(e.target.value as AreaId).name} added to ${single.name}`);
                    }}
                  >
                    <option value="">+ Add an area to this project</option>
                    {missingAreas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              ) : null}
            </>
          ) : (
            <Timeline projects={projects} tasks={visible} mineOnly={scope === 'mine'} drag={drag} over={over} setOver={setOver}
              startDrag={startDrag} endDrag={endDrag} open={(t) => setSelected(t.id)} change={change} />
          )}
        </div>
        {selectedTask ? (
          <TaskPanel
            task={selectedTask}
            color={state.projects.find((p) => p.id === selectedTask.projectId)?.workstreams.find((w) => w.name === selectedTask.workstream)?.color ?? '#e1e6ef'}
            onClose={() => setSelected(null)}
            change={change}
          />
        ) : null}
      </div>

      <NewProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={(name) => setPendingName(name)} />
    </div>
  );
}
