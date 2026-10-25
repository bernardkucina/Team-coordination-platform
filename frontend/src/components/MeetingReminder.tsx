'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';
import { DEMO_NOW, toMin } from '@/lib/time';
import { useLiveMeeting, useTrackingActions } from './Tracking';
import { Icon } from './ui';

/*
 * Meeting reminders that work without Slack. While the app is open, a banner shows on every page when one of your
 * meetings opens for clock-in (10 minutes before it starts), plus a browser notification if you allowed them.
 * When Slack is connected it sends the same reminder; clocking in or "can't come" clears both.
 */

const notifySupported = (): boolean => typeof window !== 'undefined' && 'Notification' in window;

/** Meetings that already notified, so a reload or a second tab does not notify again. */
const NOTIFIED_KEY = 'hp-notified-meetings';

const alreadyNotified = (meetingId: string): boolean => {
  try {
    return (localStorage.getItem(NOTIFIED_KEY) ?? '').split(',').includes(meetingId);
  } catch {
    return false;
  }
};

const markNotified = (meetingId: string): void => {
  try {
    const ids = (localStorage.getItem(NOTIFIED_KEY) ?? '').split(',').filter(Boolean).slice(-20);
    localStorage.setItem(NOTIFIED_KEY, [...ids, meetingId].join(','));
  } catch {
    // Storage blocked: at worst it notifies again after a reload.
  }
};

/** Your meeting is open for clock-in and you have not answered yet. */
export function MeetingReminder() {
  const { state, me } = useStore();
  const live = useLiveMeeting();
  const { start } = useTrackingActions();
  const [dismissed, setDismissed] = useState<string | null>(null);

  const answered = !!live && state.attendance.some((r) => r.meetingId === live.id && r.memberId === me.id);
  const due = live && !answered && !state.tracking ? live : undefined;
  const series = due ? state.series.find((s) => s.id === due.seriesId) : undefined;
  const minsToStart = due ? toMin(due.start) - toMin(DEMO_NOW) : 0;
  const when = !due ? '' : minsToStart > 0 ? `starts in ${minsToStart} min (${due.start})` : `started at ${due.start}`;
  const title = `${series?.name ?? 'Your meeting'} ${when}`;
  const dueId = due?.id;

  useEffect(() => {
    if (!dueId || !notifySupported() || Notification.permission !== 'granted' || alreadyNotified(dueId)) return;
    markNotified(dueId);
    try {
      const n = new Notification(title, { body: 'Open Shapers Hub to clock in.', tag: `meeting-${dueId}` });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch {
      // Some mobile browsers only notify through a service worker; the banner still shows.
    }
  }, [dueId, title]);

  if (!due || dismissed === due.id) return null;
  return (
    <section
      className="card" role="status" aria-label="Meeting reminder"
      style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderColor: 'var(--blue-light)', background: 'var(--blue-soft)' }}
    >
      <span className="inline" style={{ gap: 12 }}>
        <span className="pill info">Reminder</span>
        <span className="strong">{title}</span>
      </span>
      <span className="inline" style={{ gap: 8 }}>
        <button type="button" className="btn btn-primary" onClick={() => start(due)}>{Icon.clock}Clock in</button>
        <button type="button" className="btn btn-outline" onClick={() => start(due, 'remote')}>Joining remotely</button>
        <button type="button" className="btn btn-quiet" onClick={() => setDismissed(due.id)}>Not now</button>
      </span>
    </section>
  );
}

/** Asks once for browser notifications. Hidden when the browser has none or you already decided. */
export function ReminderToggle() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  useEffect(() => {
    if (notifySupported()) setPermission(Notification.permission);
  }, []);
  if (permission !== 'default') return null;
  return (
    <span className="inline tiny muted" style={{ gap: 8 }}>
      Get a browser notification when your meeting opens for clock-in.
      <button type="button" className="btn btn-outline btn-sm" onClick={() => void Notification.requestPermission().then(setPermission)}>
        Turn on
      </button>
    </span>
  );
}
