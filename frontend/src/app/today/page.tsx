'use client';

import { useStore } from '@/lib/store';
import { CURRENT_WEEK, DEMO_TODAY, longDate } from '@/lib/time';
import { HoursCard } from '@/components/HoursCard';
import { DidYouAttend, PlannedMeetings, TodayMeetings } from '@/components/Meetings';
import { MyTasks } from '@/components/MyTasks';
import { TrackMeetingButton, TrackingBanner } from '@/components/Tracking';

export default function TodayPage() {
  const { isAdmin } = useStore();

  return (
    <>
      <header className="page-head">
        <div>
          <span className="kicker">{longDate(DEMO_TODAY)} · Week {CURRENT_WEEK}</span>
          <h1>Today</h1>
        </div>
        <TrackMeetingButton />
      </header>

      <TrackingBanner />

      <div className="row">
        <div className="col-main">
          {/* Members start from their tasks; admins start from the meetings they run. */}
          {isAdmin ? <><TodayMeetings /><DidYouAttend /><MyTasks /></> : <><MyTasks /><TodayMeetings /><DidYouAttend /></>}
        </div>
        <div className="col-side">
          <HoursCard title={isAdmin ? 'My hours this week' : 'Hours this week'} />
          {isAdmin ? <PlannedMeetings /> : null}
        </div>
      </div>
    </>
  );
}
