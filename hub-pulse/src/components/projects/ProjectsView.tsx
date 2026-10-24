'use client';

import { useEffect, useState, type DragEvent } from 'react';
import { useStore } from '@/lib/store';
import type { Task } from '@/lib/types';
import { Segmented } from '../ui';
import { Board } from './Board';
import { NewProjectDialog } from './NewProjectDialog';
import { TaskPanel } from './TaskPanel';
import { Timeline } from './Timeline';
import { STATUS_NAME, isMine, type ChangeTask, type DragMode, type DragState } from './shared';

type View = 'board' | 'timeline';
type Scope = 'mine' | 'all';
const ALL = 'all';

export function ProjectsView() {
  const { state, dispatch, me, isAdmin, flash } = useStore();
  const [projectId, setProjectId] = useState<string>(ALL);
  const [view, setView] = useState<View>('board');
  const [scope, setScope] = useState<Scope>('all');
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWorkstream, setNewWorkstream] = useState('');
  const [pendingName, setPendingName] = useState<string | null>(null);

  // Open a freshly created project as soon as it lands in the store.
  useEffect(() => {
    if (!pendingName) return;
    const created = [...state.projects].reverse().find((p) => p.name === pendingName);
    if (created) { setProjectId(created.id); setPendingName(null); }
  }, [pendingName, state.projects]);

  const projects = projectId === ALL ? state.projects : state.projects.filter((p) => p.id === projectId);
  const projectIds = new Set(projects.map((p) => p.id));
  const inScope = state.tasks.filter((t) => projectIds.has(t.projectId));
  const visible = inScope.filter((t) => scope === 'all' || isMine(t, me.id));
  const selectedTask = state.tasks.find((t) => t.id === selected);
  const open = inScope.filter((t) => t.status !== 'done' && t.status !== 'idea');
  const single = projects.length === 1 ? projects[0] : null;

  // "projectId::workstream" pairs for the quick-add dropdown.
  const targets = projects.flatMap((p) => p.workstreams.map((w) => ({ value: `${p.id}::${w.name}`, label: single ? w.name : `${p.name} · ${w.name}` })));
  const target = targets.some((t) => t.value === newTarget) ? newTarget : targets[0]?.value ?? '';

  // Every change goes through here, so every change lands in the task history.
  const change: ChangeTask = (task, patch, text) => {
    dispatch({ type: 'updateTask', taskId: task.id, patch, who: me.name, text });
    flash(`${me.name} ${text}`);
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
        startWeek: null, endWeek: null, due: null, notes: '', links: [],
        history: [{ id: `new-${Date.now()}`, who: me.name, text: 'created this task', when: 'just now' }],
      },
    });
    flash(`Added to ${STATUS_NAME[status]}`);
    setNewTitle('');
  };

  const addWorkstream = () => {
    const name = newWorkstream.trim();
    if (!name || !single) return;
    dispatch({ type: 'addWorkstream', projectId: single.id, name, lead: me.id });
    flash('Workstream added');
    setNewWorkstream('');
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="page-head">
        <div className="field-group">
          <label className="label" htmlFor="projsel" style={{ fontSize: 13 }}>Project</label>
          <select
            id="projsel" className="field" style={{ minHeight: 44, fontSize: 20, fontWeight: 700, borderRadius: 10 }} value={projectId}
            onChange={(e) => { setProjectId(e.target.value); setSelected(null); }}
          >
            <option value={ALL}>All projects</option>
            {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="small muted">
            {single?.description ? `${single.description} · ` : ''}
            {projects.length > 1 ? `${projects.length} projects · ` : `${single?.workstreams.length ?? 0} workstreams · `}
            {open.length} open · {open.filter((t) => !t.owner).length} without an owner · {inScope.filter((t) => t.status === 'idea').length} ideas
          </span>
        </div>
        {isAdmin ? <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)}>+ New project</button> : null}
      </div>

      <div className="between" style={{ alignItems: 'center' }}>
        <div className="inline" style={{ gap: 10 }}>
          <Segmented label="View" value={view} onChange={setView} options={[{ value: 'board', label: 'Board' }, { value: 'timeline', label: 'Timeline' }]} />
          <Segmented label="Whose tasks" value={scope} onChange={setScope} options={[{ value: 'mine', label: 'My tasks' }, { value: 'all', label: 'All tasks' }]} />
        </div>
        <div className="inline" style={{ gap: 6 }}>
          <label className="sr-only" htmlFor="newtarget">Where the new task goes</label>
          <select id="newtarget" className="field" style={{ maxWidth: 220, fontSize: 13 }} value={target} onChange={(e) => setNewTarget(e.target.value)}>
            {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="sr-only" htmlFor="newtitle">New task</label>
          <input id="newtitle" className="field" style={{ width: 190, fontSize: 13 }} placeholder={isAdmin ? 'New task' : 'New idea'} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
          <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 40 }} onClick={addTask}>Add</button>
        </div>
      </div>
      <span className="tiny muted" style={{ marginTop: -6 }}>
        {view === 'board'
          ? 'Drag a card to another column to change its status, or to another row to change its workstream. Click a card to open it.'
          : 'Drag a bar sideways to move the dates, or to another workstream. Drag its right edge to change the deadline.'}
      </span>

      <div className="row" style={{ gap: 16 }}>
        <div style={{ flex: '999 1 600px', minWidth: 0 }}>
          {view === 'board' ? (
            <>
              <Board projects={projects} tasks={visible} mineOnly={scope === 'mine'} drag={drag} over={over} setOver={setOver}
                startDrag={(e, t) => startDrag(e, t)} endDrag={endDrag} open={(t) => setSelected(t.id)} change={change} />
              {isAdmin && single ? (
                <div className="inline" style={{ gap: 6, marginTop: 12 }}>
                  <label className="sr-only" htmlFor="newwsname">New workstream</label>
                  <input id="newwsname" className="field" style={{ width: 220, fontSize: 13 }} placeholder="New workstream" value={newWorkstream} onChange={(e) => setNewWorkstream(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addWorkstream()} />
                  <button type="button" className="btn btn-outline btn-sm" style={{ minHeight: 40 }} onClick={addWorkstream}>Add workstream</button>
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

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(name) => setPendingName(name)}
      />
    </div>
  );
}
