'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { Icon } from '../ui';

interface DraftTask {
  key: number;
  title: string;
  workstream: string;
  owner: string;
  due: string;
}

const emptyTask = (key: number, workstream: string): DraftTask => ({ key, title: '', workstream, owner: '', due: '' });

/** Kinds of people a project can ask for. Anything else can be typed in. */
const ROLE_SUGGESTIONS = ['Tech', 'Marketing', 'Design', 'Finance', 'Logistics', 'Programme', 'Partnerships', 'Writing', 'Speakers'];

/** Modal for creating a project: owner, deadline, who it needs, workstreams and first tasks with due dates. */
export function NewProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (projectName: string) => void }) {
  const { state, dispatch, me, flash } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lead, setLead] = useState(me.id);
  const [deadline, setDeadline] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState('');
  const [workstreamText, setWorkstreamText] = useState('General');
  const [tasks, setTasks] = useState<DraftTask[]>([emptyTask(1, 'General')]);
  const [error, setError] = useState('');

  const workstreams = Array.from(new Set(workstreamText.split('\n').map((s) => s.trim()).filter(Boolean)));
  const wsList = workstreams.length ? workstreams : ['General'];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const reset = () => {
    setName(''); setDescription(''); setLead(me.id); setDeadline(''); setRoles([]); setCustomRole('');
    setWorkstreamText('General'); setTasks([emptyTask(1, 'General')]); setError('');
  };

  const create = () => {
    if (!name.trim()) { setError('Give the project a name.'); return; }
    const real = tasks.filter((t) => t.title.trim());
    dispatch({
      type: 'addProject',
      who: me.name,
      project: {
        name: name.trim(), description: description.trim(), lead, workstreams: wsList, deadline: deadline || null, neededRoles: roles,
        tasks: real.map((t) => ({
          title: t.title.trim(), workstream: wsList.includes(t.workstream) ? t.workstream : wsList[0], owner: t.owner || null, due: t.due || null,
        })),
      },
    });
    flash(`Project created: ${name.trim()}${real.length ? ` with ${real.length} task${real.length > 1 ? 's' : ''}` : ''}`);
    onCreated(name.trim());
    reset();
    onClose();
  };

  const updateTask = (key: number, patch: Partial<DraftTask>) => setTasks(tasks.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const toggleRole = (r: string) => setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r]);
  const addCustomRole = () => {
    const r = customRole.trim();
    if (r && !roles.includes(r)) setRoles([...roles, r]);
    setCustomRole('');
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="np-title"
      onClose={onClose}
      onCancel={() => { reset(); }}
      style={{ width: 'min(640px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', border: 0, borderRadius: 16, padding: 0, boxShadow: '0 24px 60px rgba(10,19,60,0.3)' }}
    >
      <div className="stack" style={{ gap: 18, padding: 24 }}>
        <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <h2 id="np-title">New project</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={() => { reset(); onClose(); }}>{Icon.close}</button>
        </div>

        <div className="field-group">
          <label className="label" htmlFor="np-name">Name</label>
          <input id="np-name" className="field" style={{ minHeight: 44, fontSize: 16 }} value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="e.g. Shapers Summit 2027" />
        </div>
        <div className="field-group">
          <label className="label" htmlFor="np-desc">What is it about?</label>
          <textarea id="np-desc" className="field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Goal, who it's for, when it should be done" />
        </div>
        <div className="grid-2">
          <div className="field-group">
            <label className="label" htmlFor="np-lead">Project owner</label>
            <select id="np-lead" className="field" value={lead} onChange={(e) => setLead(e.target.value)}>
              {state.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="np-deadline">Deadline</label>
            <input id="np-deadline" className="field" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <span className="label" id="np-roles-label">Who will you need?</span>
          <div className="inline" role="group" aria-labelledby="np-roles-label" style={{ gap: 6 }}>
            {[...ROLE_SUGGESTIONS, ...roles.filter((r) => !ROLE_SUGGESTIONS.includes(r))].map((r) => (
              <button
                key={r} type="button" className="btn btn-sm" aria-pressed={roles.includes(r)} onClick={() => toggleRole(r)}
                style={{ minHeight: 32, borderRadius: 999, background: roles.includes(r) ? 'var(--blue)' : '#fff', color: roles.includes(r) ? '#fff' : 'var(--ink)', borderColor: roles.includes(r) ? 'var(--blue)' : 'var(--field)' }}
              >{r}</button>
            ))}
            <label className="sr-only" htmlFor="np-role-other">Other role</label>
            <input
              id="np-role-other" className="field" style={{ width: 140, minHeight: 32, fontSize: 13 }} placeholder="Other…" value={customRole}
              onChange={(e) => setCustomRole(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomRole(); } }} onBlur={addCustomRole}
            />
          </div>
        </div>

        <div className="field-group">
          <label className="label" htmlFor="np-ws">Workstreams, one per line</label>
          <textarea id="np-ws" className="field" rows={3} style={{ minHeight: 72 }} value={workstreamText} onChange={(e) => setWorkstreamText(e.target.value)} />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <span className="label">First tasks (optional)</span>
          {tasks.map((t, i) => (
            <div key={t.key} className="inline" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <label className="sr-only" htmlFor={`np-t-${t.key}`}>Task {i + 1}</label>
              <input id={`np-t-${t.key}`} className="field" style={{ flex: '1 1 auto', minWidth: 0 }} placeholder={`Task ${i + 1}`} value={t.title} onChange={(e) => updateTask(t.key, { title: e.target.value })} />
              <label className="sr-only" htmlFor={`np-w-${t.key}`}>Workstream for task {i + 1}</label>
              <select id={`np-w-${t.key}`} className="field" style={{ maxWidth: 140 }} value={wsList.includes(t.workstream) ? t.workstream : wsList[0]} onChange={(e) => updateTask(t.key, { workstream: e.target.value })}>
                {wsList.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
              <label className="sr-only" htmlFor={`np-o-${t.key}`}>Owner for task {i + 1}</label>
              <select id={`np-o-${t.key}`} className="field" style={{ maxWidth: 130 }} value={t.owner} onChange={(e) => updateTask(t.key, { owner: e.target.value })}>
                <option value="">No owner</option>
                {state.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <label className="sr-only" htmlFor={`np-d-${t.key}`}>Due date for task {i + 1}</label>
              <input id={`np-d-${t.key}`} className="field" type="date" style={{ maxWidth: 150 }} value={t.due} onChange={(e) => updateTask(t.key, { due: e.target.value })} />
              {tasks.length > 1 ? (
                <button type="button" className="icon-btn" aria-label={`Remove task ${i + 1}`} onClick={() => setTasks(tasks.filter((x) => x.key !== t.key))}>{Icon.close}</button>
              ) : null}
            </div>
          ))}
          <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start', color: 'var(--blue)' }} onClick={() => setTasks([...tasks, emptyTask(Date.now(), wsList[0])])}>
            + Add another task
          </button>
        </div>

        {error ? <span role="alert" className="small strong" style={{ color: 'var(--bad)' }}>{error}</span> : null}
        <div className="inline" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-quiet" onClick={() => { reset(); onClose(); }}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={create}>Create project</button>
        </div>
      </div>
    </dialog>
  );
}
