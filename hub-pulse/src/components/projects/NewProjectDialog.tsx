'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { AREAS, areaById } from '@/lib/data';
import type { AreaId } from '@/lib/types';
import { Icon } from '../ui';

interface DraftTask {
  key: number;
  title: string;
  areaId: AreaId;
  owner: string;
}

const emptyTask = (key: number, areaId: AreaId): DraftTask => ({ key, title: '', areaId, owner: '' });

/** Modal for creating a project: description, main area, the areas that work on it, roles and first tasks. */
export function NewProjectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (projectName: string) => void }) {
  const { state, dispatch, me, flash } = useStore();
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lead, setLead] = useState(me.id);
  const [mainArea, setMainArea] = useState<AreaId>('voice');
  const [areas, setAreas] = useState<AreaId[]>(['voice']);
  const [rolesText, setRolesText] = useState('');
  const [tasks, setTasks] = useState<DraftTask[]>([emptyTask(1, 'voice')]);
  const [error, setError] = useState('');

  // The main area is always one of the board rows.
  const rowAreas = Array.from(new Set<AreaId>([mainArea, ...areas]));

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const reset = () => {
    setName(''); setDescription(''); setLead(me.id); setMainArea('voice'); setAreas(['voice']); setRolesText('');
    setTasks([emptyTask(1, 'voice')]); setError('');
  };

  const close = () => { reset(); onClose(); };

  const create = () => {
    if (!name.trim()) { setError('Give the project a name.'); return; }
    const real = tasks.filter((t) => t.title.trim());
    // "Role: what you do" per line; the part after the colon is optional.
    const roles = rolesText.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
      const [roleName, ...rest] = line.split(':');
      return { name: roleName.trim(), description: rest.join(':').trim() };
    });
    dispatch({
      type: 'addProject',
      who: me.name.split(' ')[0],
      project: {
        name: name.trim(), description: description.trim(), lead, mainArea, areas: rowAreas, roles,
        tasks: real.map((t) => ({ title: t.title.trim(), areaId: rowAreas.includes(t.areaId) ? t.areaId : mainArea, owner: t.owner || null })),
      },
    });
    flash(`Project created: ${name.trim()}${real.length ? ` with ${real.length} task${real.length > 1 ? 's' : ''}` : ''}`);
    onCreated(name.trim());
    close();
  };

  const updateTask = (key: number, patch: Partial<DraftTask>) => setTasks(tasks.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  const toggleArea = (id: AreaId) => setAreas(areas.includes(id) ? areas.filter((a) => a !== id) : [...areas, id]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="np-title"
      onClose={onClose}
      onCancel={reset}
      style={{ width: 'min(680px, calc(100vw - 32px))', maxHeight: 'calc(100vh - 48px)', border: 0, borderRadius: 16, padding: 0, boxShadow: '0 24px 60px rgba(10,19,60,0.3)' }}
    >
      <div className="stack" style={{ gap: 18, padding: 24 }}>
        <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <h2 id="np-title">New project</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={close}>{Icon.close}</button>
        </div>

        <div className="field-group">
          <label className="label" htmlFor="np-name">Name</label>
          <input id="np-name" className="field" style={{ minHeight: 44, fontSize: 16 }} value={name} onChange={(e) => { setName(e.target.value); setError(''); }} placeholder="e.g. Shape Clash" />
        </div>
        <div className="field-group">
          <label className="label" htmlFor="np-desc">What is it about?</label>
          <textarea id="np-desc" className="field" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Goal, who it's for, when it happens" />
        </div>
        <div className="grid-2">
          <div className="field-group">
            <label className="label" htmlFor="np-main">Main area</label>
            <select id="np-main" className="field" value={mainArea} onChange={(e) => setMainArea(e.target.value as AreaId)}>
              {AREAS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="label" htmlFor="np-lead">Project lead</label>
            <select id="np-lead" className="field" value={lead} onChange={(e) => setLead(e.target.value)}>
              {state.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>

        <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="field-group">
          <legend className="label" style={{ marginBottom: 6 }}>Areas that work on it (these become the board rows)</legend>
          <div className="chips">
            {AREAS.map((a) => {
              const on = rowAreas.includes(a.id);
              return (
                <button
                  key={a.id} type="button" aria-pressed={on} disabled={a.id === mainArea}
                  onClick={() => toggleArea(a.id)}
                  className="btn btn-sm"
                  style={{ minHeight: 34, background: on ? a.color : '#fff', borderColor: on ? a.color : 'var(--field)', color: 'var(--ink)' }}
                >{a.name}</button>
              );
            })}
          </div>
        </fieldset>

        <div className="field-group">
          <label className="label" htmlFor="np-roles">Roles, one per line ("Role: what you do")</label>
          <textarea id="np-roles" className="field" rows={3} value={rolesText} onChange={(e) => setRolesText(e.target.value)} placeholder={'Moderator: vodiš soočenje\nPriprava tem: raziščeš temo'} />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          <span className="label">First tasks (optional)</span>
          {tasks.map((t, i) => (
            <div key={t.key} className="inline" style={{ flexWrap: 'nowrap', gap: 6 }}>
              <label className="sr-only" htmlFor={`np-t-${t.key}`}>Task {i + 1}</label>
              <input id={`np-t-${t.key}`} className="field" style={{ flex: '1 1 auto', minWidth: 0 }} placeholder={`Task ${i + 1}`} value={t.title} onChange={(e) => updateTask(t.key, { title: e.target.value })} />
              <label className="sr-only" htmlFor={`np-w-${t.key}`}>Area for task {i + 1}</label>
              <select id={`np-w-${t.key}`} className="field" style={{ maxWidth: 160 }} value={rowAreas.includes(t.areaId) ? t.areaId : mainArea} onChange={(e) => updateTask(t.key, { areaId: e.target.value as AreaId })}>
                {rowAreas.map((a) => <option key={a} value={a}>{areaById(a).name}</option>)}
              </select>
              <label className="sr-only" htmlFor={`np-o-${t.key}`}>Owner for task {i + 1}</label>
              <select id={`np-o-${t.key}`} className="field" style={{ maxWidth: 150 }} value={t.owner} onChange={(e) => updateTask(t.key, { owner: e.target.value })}>
                <option value="">No owner</option>
                {state.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              {tasks.length > 1 ? (
                <button type="button" className="icon-btn" aria-label={`Remove task ${i + 1}`} onClick={() => setTasks(tasks.filter((x) => x.key !== t.key))}>{Icon.close}</button>
              ) : null}
            </div>
          ))}
          <button type="button" className="btn btn-quiet btn-sm" style={{ alignSelf: 'flex-start', color: 'var(--blue)' }} onClick={() => setTasks([...tasks, emptyTask(Date.now(), mainArea)])}>
            + Add another task
          </button>
        </div>

        {error ? <span role="alert" className="small strong" style={{ color: 'var(--bad)' }}>{error}</span> : null}
        <div className="inline" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-quiet" onClick={close}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={create}>Create project</button>
        </div>
      </div>
    </dialog>
  );
}
