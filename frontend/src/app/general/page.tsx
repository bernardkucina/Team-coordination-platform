'use client';

import { GeneralTasksList } from '@/components/GeneralTasks';

/** General tasks: small hub jobs anyone can take; missing a meeting means picking one within 14 days. */
export default function GeneralTasksPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <span className="kicker">Small jobs for the hub anyone can take</span>
          <h1 id="general-page-h">General tasks</h1>
        </div>
      </header>
      <p className="small muted" style={{ margin: 0 }}>Missed a meeting? Pick one within 14 days.</p>
      <GeneralTasksList asPage />
    </>
  );
}
