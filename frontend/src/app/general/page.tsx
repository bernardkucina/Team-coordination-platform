'use client';

import { useStore } from '@/lib/store';
import { GeneralStats, GeneralTasksList } from '@/components/GeneralTasks';

/** General tasks: small hub jobs anyone can take; missing a meeting means picking one within 14 days. */
export default function GeneralTasksPage() {
  const { isAdmin } = useStore();
  return (
    <>
      <header className="page-head">
        <div>
          <span className="kicker">Small jobs for the hub anyone can take</span>
          <h1 id="general-page-h">General tasks</h1>
        </div>
      </header>
      <p className="small muted" style={{ margin: 0 }}>Missed a meeting? Pick one within 14 days.</p>
      {isAdmin ? (
        <GeneralTasksList asPage />
      ) : (
        <div className="row">
          <div className="col-main" style={{ flex: '3 1 520px' }}><GeneralTasksList asPage /></div>
          <div className="col-side" style={{ flex: '2 1 320px' }}><GeneralStats /></div>
        </div>
      )}
    </>
  );
}
