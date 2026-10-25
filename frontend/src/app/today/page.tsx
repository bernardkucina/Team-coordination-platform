'use client';

import { useStore } from '@/lib/store';
import { CURRENT_WEEK, DEMO_TODAY, longDate } from '@/lib/time';
import { HoursCard } from '@/components/HoursCard';
import { DidYouAttend, TodayMeetings } from '@/components/Meetings';
import { MyTasks } from '@/components/MyTasks';
import { MakeupCard } from '@/components/GeneralTasks';
import { SlackCard } from '@/components/SlackCard';
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
          {/* Today's meetings come first for everyone, then tasks. */}
          <TodayMeetings />
          <DidYouAttend />
          <MakeupCard />
          <MyTasks />
          {isAdmin ? <SlackCard /> : null}
        </div>
        <div className="col-side">
          <HoursCard title={isAdmin ? 'My hours this week' : 'Hours this week'} />
        </div>
      </div>
    </>
  );
}
