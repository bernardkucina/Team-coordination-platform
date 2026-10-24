'use client';

import { useStore } from '@/lib/store';
import { AdminAnalytics } from '@/components/analytics/AdminAnalytics';
import { MemberAnalytics } from '@/components/analytics/MemberAnalytics';

export default function AnalyticsPage() {
  const { isAdmin } = useStore();
  return isAdmin ? <AdminAnalytics /> : <MemberAnalytics />;
}
