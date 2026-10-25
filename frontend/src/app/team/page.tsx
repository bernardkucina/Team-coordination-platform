'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { meetingPhase } from '@/lib/rules';
import { Segmented } from '@/components/ui';
import { People } from '@/components/team/People';
import { Attendance } from '@/components/team/Attendance';
import { MembersTable } from '@/components/team/MembersTable';
import { TeamStats } from '@/components/team/TeamStats';

type Tab = 'people' | 'members' | 'attendance';

function TeamInner() {
  const { state, isAdmin } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const raw = params?.get('tab');
  const tab: Tab = raw === 'attendance' || raw === 'members' ? raw : 'people';
  const needs = state.meetings.filter((m) => meetingPhase(m) === 'past' && !m.recorded).length;

  if (!isAdmin) {
    return (
      <>
        <h1>Team</h1>
        <p className="muted">The Team view is for hub admins.</p>
      </>
    );
  }

  return (
    <>
      <header className="stack" style={{ gap: 10 }}>
        <h1>Team</h1>
        <TeamStats />
        <Segmented<Tab>
          label="Team sections"
          value={tab}
          onChange={(t) => router.replace(t === 'people' ? '/team' : `/team?tab=${t}`)}
          options={[
            { value: 'people', label: 'People and hours' },
            { value: 'members', label: 'Members overview' },
            { value: 'attendance', label: 'Attendance' },
          ]}
        />
      </header>
      {tab === 'people' ? <People /> : tab === 'members' ? <MembersTable /> : <Attendance />}
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
