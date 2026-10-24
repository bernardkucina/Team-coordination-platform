'use client';

import { useStore } from '@/lib/store';
import { ProjectsView } from '@/components/projects/ProjectsView';

export default function ProjectsPage() {
  const { isAdmin } = useStore();
  return (
    <>
      <header>
        <span className="kicker muted" style={{ display: 'block', fontSize: 14, marginBottom: 6 }}>
          {isAdmin
            ? 'Admins can add projects and workstreams, assign anyone and move any card.'
            : 'The whole picture, not only your tasks. Your cards have a blue outline.'}
        </span>
        <h1>Projects</h1>
      </header>
      <ProjectsView />
    </>
  );
}
