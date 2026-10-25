'use client';

import { useEffect, useState, type DragEvent } from 'react';
import { useStore } from '@/lib/store';
import { AREAS, areaById } from '@/lib/data';
import type { AreaId, Task } from '@/lib/types';
import { Avatar, Toggle } from '../ui';
import { Board } from './Board';
import { NewProjectDialog } from './NewProjectDialog';
import { ProjectPanel } from './ProjectPanel';
import { TaskPanel } from './TaskPanel';
import { STATUS_NAME, isMine, type ChangeTask, type DragMode, type DragState } from './shared';

type Scope = 'mine' | 'all';
export const ALL_PROJECTS = 'all';

export function ProjectsView({ projectId, onProjectId }: { projectId: string; onProjectId: (id: string) => void }) {
  const { state, dispatch, me, isAdmin, memberName, flash } = useStore();
  const [scope, setScope] = useState<Scope>('all');
  const [selected, setSelected] = useState<number | null>(null);
  const [panelProject, setPanelProject] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const activeProjects = state.projects.filter((p) => p.status === 'active');

  // Picking one project (here or from the overview) opens its task list beside the board.
  useEffect(() => { setPanelProject(projectId === ALL_PROJECTS ? null : projectId); }, [projectId]);

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
  const panelProjectObj = state.projects.find((p) => p.id === panelProject) ?? null;
  const open = inScope.filter((t) => t.status !== 'done' && t.status !== 'idea');
  const single = projects.length === 1 ? projects[0] : null;
  // The team is whoever owns or helps with a task in the project.
  const singleTeam = single
    ? [...new Set(state.tasks.filter((t) => t.projectId === single.id && t.status !== 'idea').flatMap((t) => [t.owner, ...t.helpers]).filter((x): x is string => !!x))]
    : [];
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

  /** Creates an empty task and opens it in the side panel, where the title and details are filled in. */
  const newTask = () => {
    const project = single ?? state.projects.find((p) => p.id === panelProject) ?? projects[0];
    if (!project) return;
    const id = state.nextId;
    dispatch({
      type: 'addTask',
      task: {
        projectId: project.id, title: '', workstream: project.workstreams[0]?.name ?? '', status: 'priority', owner: me.id, helpers: [], priority: 'Medium',
        startWeek: null, endWeek: null, due: null, doneAt: null, notes: '', links: [],
        history: [{ id: `new-${Date.now()}`, who: me.name.split(' ')[0], text: 'created this task', when: 'just now' }],
      },
    });
    setSelected(id);
  };

  const closeTask = () => {
    if (selectedTask && !selectedTask.title.trim()) {
      dispatch({ type: 'updateTask', taskId: selectedTask.id, patch: { title: 'Untitled task' }, who: me.name.split(' ')[0], text: 'left the title empty' });
    }
    setSelected(null);
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
            id="projsel" className="field select-plain" style={{ minHeight: 44, fontSize: 20, fontWeight: 700, borderRadius: 10, textAlign: 'left', textAlignLast: 'left', textOverflow: 'ellipsis' }} value={projectId}
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
      </div>

      {single ? (
        <section className="card" aria-label={`About ${single.name}`} style={{ padding: 20, gap: 12 }}>
          {single.description ? <p className="small" style={{ lineHeight: 1.55, color: 'var(--ink-2)', maxWidth: 900 }}>{single.description}</p> : null}
          <div className="row" style={{ gap: 20 }}>
            <div className="stack" style={{ gap: 6, flex: '1 1 260px' }}>
              <span className="label">Team · lead {memberName(single.lead)}</span>
              <div className="inline" style={{ gap: 4 }}>
                {singleTeam.map((id) => {
                  const m = state.members.find((x) => x.id === id);
                  return m ? <span key={id} title={m.name}><Avatar small initials={m.initials} /></span> : null;
                })}
                <span className="tiny muted" style={{ marginLeft: 4 }}>{singleTeam.length} people</span>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="between" style={{ alignItems: 'center' }}>
        <div className="inline" style={{ gap: '10px 32px' }}>
          <Toggle label="Show all tasks" value={scope} onChange={setScope} left={{ value: 'mine', label: 'My tasks' }} right={{ value: 'all', label: 'All tasks' }} />
        </div>
        {isAdmin ? (
          <>
            <label className="sr-only" htmlFor="newwhat">Create something new</label>
            <select
              id="newwhat" className="btn btn-primary select-plain" value=""
              onChange={(e) => { if (e.target.value === 'task') newTask(); if (e.target.value === 'project') setDialogOpen(true); }}
            >
              <option value="" disabled hidden>+ New</option>
              <option value="task">New task</option>
              <option value="project">New project</option>
            </select>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={newTask}>+ New task</button>
        )}
      </div>
      <span className="tiny muted" style={{ marginTop: -6 }}>
        Rows are the areas working on the project. Drag a card to another column to change its status, or to another row to change its area. Click a card to open it.
      </span>

      <div className="row" style={{ gap: 16 }}>
        <div style={{ flex: '999 1 600px', minWidth: 0 }}>
          {(
            <>
              <Board projects={projects} tasks={visible} mineOnly={scope === 'mine'} drag={drag} over={over} setOver={setOver}
                startDrag={(e, t) => startDrag(e, t)} endDrag={endDrag} open={(t) => setSelected(t.id)} openProject={(p) => { setPanelProject(p.id); setSelected(null); }} change={change} />
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
          )}
        </div>
        {selectedTask ? (
          <TaskPanel
            task={selectedTask}
            color={state.projects.find((p) => p.id === selectedTask.projectId)?.workstreams.find((w) => w.name === selectedTask.workstream)?.color ?? 'var(--line-soft)'}
            onClose={closeTask}
            change={change}
          />
        ) : panelProjectObj ? (
          <ProjectPanel project={panelProjectObj} onClose={() => setPanelProject(null)} openTask={(t) => setSelected(t.id)} change={change} />
        ) : null}
      </div>

      <NewProjectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={(name) => setPendingName(name)} />
    </div>
  );
}
