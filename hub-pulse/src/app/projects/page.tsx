'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Segmented } from '@/components/ui';
import { ProjectsOverview } from '@/components/projects/ProjectsOverview';
import { ALL_PROJECTS, ProjectsView } from '@/components/projects/ProjectsView';

type Tab = 'overview' | 'work';

export default function ProjectsPage() {
  const { isAdmin } = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [projectId, setProjectId] = useState<string>(ALL_PROJECTS);

  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <span className="muted" style={{ fontSize: 14 }}>
          {isAdmin
            ? 'Admins can create projects, add areas, assign anyone and move any card.'
            : 'Every project, the areas behind them, and where you fit in.'}
        </span>
        <h1>Projects</h1>
        <Segmented<Tab>
          label="Projects sections"
          value={tab}
          onChange={setTab}
          options={[{ value: 'overview', label: 'Overview' }, { value: 'work', label: 'Board & timeline' }]}
        />
      </header>
      {tab === 'overview' ? (
        <ProjectsOverview onOpen={(id) => { setProjectId(id); setTab('work'); }} />
      ) : (
        <ProjectsView projectId={projectId} onProjectId={setProjectId} />
      )}
    </>
  );
}
