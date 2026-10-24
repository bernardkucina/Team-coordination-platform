'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { AREAS, areaById } from '@/lib/data';
import type { AreaId, Project } from '@/lib/types';
import { Avatar, Progress } from '../ui';

type AreaFilter = AreaId | 'all';

/** Overview of all projects (from "PROJEKTI GS za Shapers GO"), the areas, and planned projects. */
export function ProjectsOverview({ onOpen }: { onOpen: (projectId: string) => void }) {
  const { state, dispatch, me, flash } = useStore();
  const [area, setArea] = useState<AreaFilter>('all');
  const [mineOnly, setMineOnly] = useState(false);

  const activeProjects = state.projects.filter((p) => p.status === 'active');
  const plannedProjects = state.projects.filter((p) => p.status === 'planned');
  const myProjects = activeProjects.filter((p) => p.members.includes(me.id));
  const shown = activeProjects
    .filter((p) => area === 'all' || p.mainArea === area || p.workstreams.some((w) => w.name === areaById(area).name))
    .filter((p) => !mineOnly || p.members.includes(me.id));
  const me_ = state.members.find((m) => m.id === me.id) ?? me;

  const joinOrLeave = (p: Project) => {
    const inTeam = p.members.includes(me.id);
    if (inTeam && myProjects.length === 1) {
      flash('You need to stay in at least one project. Join another one first.');
      return;
    }
    dispatch({ type: inTeam ? 'leaveProject' : 'joinProject', projectId: p.id, memberId: me.id });
    flash(inTeam ? `You left ${p.name}` : `You joined ${p.name}`);
  };

  return (
    <div className="stack" style={{ gap: 28 }}>
      {myProjects.length === 0 ? (
        <div role="status" className="card" style={{ background: 'var(--warn-bg)', borderColor: 'var(--ink)', padding: 18 }}>
          <strong style={{ color: 'var(--warn)' }}>You are not in a project yet.</strong>
          <span className="small" style={{ color: 'var(--warn)' }}>Everyone is active in at least one project. Pick one below; you can switch any time.</span>
        </div>
      ) : null}

      <section className="stack" style={{ gap: 14 }} aria-labelledby="active-h">
        <div className="between" style={{ alignItems: 'center' }}>
          <div className="stack" style={{ gap: 4 }}>
            <h2 id="active-h">Projects we run</h2>
            <span className="small muted">
              You are in {myProjects.length} of {activeProjects.length}. Join as many as you like, and switch if a project isn&apos;t for you.
            </span>
          </div>
          <button type="button" className={mineOnly ? 'btn btn-primary btn-sm' : 'btn btn-quiet btn-sm'} style={{ minHeight: 38 }} aria-pressed={mineOnly} onClick={() => setMineOnly(!mineOnly)}>
            Only my projects
          </button>
        </div>
        <div className="chips" role="group" aria-label="Filter by area">
          <button type="button" className="btn btn-sm" aria-pressed={area === 'all'} onClick={() => setArea('all')}
            style={{ minHeight: 34, background: area === 'all' ? 'var(--navy)' : '#fff', color: area === 'all' ? '#fff' : 'var(--ink)', borderColor: area === 'all' ? 'var(--navy)' : 'var(--field)' }}>
            All areas
          </button>
          {AREAS.map((a) => (
            <button key={a.id} type="button" className="btn btn-sm" aria-pressed={area === a.id} onClick={() => setArea(a.id)}
              style={{ minHeight: 34, background: area === a.id ? a.color : '#fff', color: 'var(--ink)', borderColor: area === a.id ? 'var(--ink)' : 'var(--field)' }}>
              <span className="swatch" style={{ background: a.color }} />{a.name.replace('Shapers ', '')}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {shown.map((p) => {
            const main = areaById(p.mainArea);
            const tasks = state.tasks.filter((t) => t.projectId === p.id && t.status !== 'idea');
            const done = tasks.filter((t) => t.status === 'done').length;
            const openCount = tasks.length - done;
            const inTeam = p.members.includes(me.id);
            return (
              <article key={p.id} className="card" style={{ padding: 20, gap: 12, borderTop: `4px solid ${main.color}` }} aria-labelledby={`pc-${p.id}`}>
                <div className="stack" style={{ gap: 8 }}>
                  <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <h3 id={`pc-${p.id}`} style={{ fontSize: 17, lineHeight: 1.3 }}>
                      {p.number ? <span className="muted" style={{ fontWeight: 600, marginRight: 6 }}>{p.number}</span> : null}{p.name}
                    </h3>
                    {inTeam ? <span className="pill good">You&apos;re in</span> : null}
                  </div>
                  <div className="inline" style={{ gap: 6 }}>
                    <span className="pill" style={{ background: main.color, color: 'var(--ink)' }}>{main.name}</span>
                    {p.tags.map((t) => <span key={t} className="pill neutral">{t}</span>)}
                  </div>
                </div>
                <p className="small" style={{ lineHeight: 1.5, color: 'var(--ink-2)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {p.description}
                </p>
                {p.roles.length ? (
                  <div className="inline" style={{ gap: 6 }}>
                    {p.roles.map((r) => <span key={r.name} className="pill info" title={r.description}>{r.name}</span>)}
                  </div>
                ) : null}
                <div className="stack" style={{ gap: 6 }}>
                  <div className="between tiny muted"><span>{openCount} open tasks</span><span>{done} done</span></div>
                  <Progress value={done} max={tasks.length || 1} />
                </div>
                <div className="between" style={{ alignItems: 'center', marginTop: 'auto', flexWrap: 'nowrap' }}>
                  <div className="inline" style={{ gap: 3, flexWrap: 'nowrap' }} aria-label={`${p.members.length} people in the team`}>
                    {p.members.slice(0, 6).map((id) => {
                      const m = state.members.find((x) => x.id === id);
                      return m ? <span key={id} title={m.name}><Avatar small initials={m.initials} /></span> : null;
                    })}
                    {p.members.length > 6 ? <span className="tiny muted">+{p.members.length - 6}</span> : null}
                  </div>
                  <div className="inline" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    <button type="button" className={inTeam ? 'btn btn-quiet btn-sm' : 'btn btn-outline btn-sm'} style={{ minHeight: 36 }} onClick={() => joinOrLeave(p)}>
                      {inTeam ? 'Leave' : 'Join'}
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" style={{ minHeight: 36 }} onClick={() => onOpen(p.id)}>Open board</button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {shown.length === 0 ? <p className="small muted">No projects in this area yet.</p> : null}
      </section>

      <section className="stack" style={{ gap: 14 }} aria-labelledby="areas-h">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="areas-h">Areas</h2>
          <span className="small muted">Every project has a main area. You can also join an area directly, whatever project you are in. For now only Voice and Tech meet on their own.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
          {AREAS.map((a) => {
            const joined = me_.areas.includes(a.id);
            const people = state.members.filter((m) => m.areas.includes(a.id)).length;
            const projectsHere = activeProjects.filter((p) => p.mainArea === a.id).length;
            const locked = a.coreOnly && me.tier !== 'Shapers Core';
            return (
              <article key={a.id} className="card" style={{ padding: 16, gap: 8, borderLeftWidth: 1 }} aria-labelledby={`ar-${a.id}`}>
                <div className="between" style={{ alignItems: 'center', flexWrap: 'nowrap' }}>
                  <h3 id={`ar-${a.id}`} className="inline" style={{ gap: 8, fontSize: 15 }}><span className="swatch" style={{ width: 12, height: 12, background: a.color }} />{a.name}</h3>
                  {a.active ? <span className="pill good">Meets</span> : <span className="pill neutral">Needs a lead</span>}
                </div>
                <span className="small" style={{ color: 'var(--ink-2)' }}>{a.about}</span>
                <span className="tiny muted">{a.work}</span>
                <div className="between" style={{ alignItems: 'center', marginTop: 'auto' }}>
                  <span className="tiny muted">{people} people · main area of {projectsHere} project{projectsHere === 1 ? '' : 's'}</span>
                  {locked ? (
                    <span className="pill neutral" title="Only Core members">Core only</span>
                  ) : (
                    <button
                      type="button" className={joined ? 'btn btn-quiet btn-sm' : 'btn btn-outline btn-sm'} style={{ minHeight: 32 }}
                      onClick={() => { dispatch({ type: 'toggleArea', areaId: a.id, memberId: me.id }); flash(joined ? `You left ${a.name}` : `You joined ${a.name}`); }}
                    >{joined ? 'Leave' : 'Join'}</button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="stack" style={{ gap: 14 }} aria-labelledby="planned-h">
        <div className="stack" style={{ gap: 4 }}>
          <h2 id="planned-h">Projects we are planning</h2>
          <span className="small muted">Not running yet. Say if one interests you, and if you have your own idea, bring it to your buddy.</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {plannedProjects.map((p) => {
            const interested = p.interested.includes(me.id);
            return (
              <article key={p.id} className="card" style={{ padding: 16, gap: 8, background: 'var(--surface-2)', borderStyle: 'dashed' }} aria-labelledby={`pl-${p.id}`}>
                <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <h3 id={`pl-${p.id}`} style={{ fontSize: 15 }}>{p.name}</h3>
                  <span className="pill" style={{ background: areaById(p.mainArea).color, color: 'var(--ink)' }}>{areaById(p.mainArea).name.replace('Shapers ', '')}</span>
                </div>
                <span className="small" style={{ color: 'var(--ink-2)', lineHeight: 1.45 }}>{p.description}</span>
                <div className="between" style={{ alignItems: 'center', marginTop: 'auto' }}>
                  <span className="tiny muted">{p.interested.length} interested</span>
                  <button
                    type="button" aria-pressed={interested} className={interested ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'} style={{ minHeight: 32 }}
                    onClick={() => { dispatch({ type: 'toggleInterest', projectId: p.id, memberId: me.id }); flash(interested ? 'Removed your interest' : `Noted: you're interested in ${p.name}`); }}
                  >{interested ? "I'm interested ✓" : "I'm interested"}</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
