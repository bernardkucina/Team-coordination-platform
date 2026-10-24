'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { meetingPhase } from '@/lib/rules';
import { Segmented } from '@/components/ui';
import { People } from '@/components/team/People';
import { Attendance } from '@/components/team/Attendance';

type Tab = 'people' | 'attendance';

function TeamInner() {
  const { state, isAdmin } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const tab: Tab = params?.get('tab') === 'attendance' ? 'attendance' : 'people';
  const needs = state.meetings.filter((m) => meetingPhase(m) === 'past' && !m.recorded).length;

  if (!isAdmin) {
    return (
      <>
        <h1>Team</h1>
        <p className="muted">The Team view is for hub admins. Switch to Admin in the sidebar to see it.</p>
      </>
    );
  }

  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <h1>Team</h1>
        <Segmented<Tab>
          label="Team sections"
          value={tab}
          onChange={(t) => router.replace(t === 'people' ? '/team' : '/team?tab=attendance')}
          options={[
            { value: 'people', label: 'People and hours' },
            { value: 'attendance', label: <>Attendance {needs ? <span className="pill" style={{ marginLeft: 4, background: 'var(--amber)', color: 'var(--navy)', padding: '1px 7px' }}>{needs}</span> : null}</> },
          ]}
        />
      </header>
      {tab === 'people' ? <People /> : <Attendance />}
    </>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <TeamInner />
    </Suspense>
  );
}
