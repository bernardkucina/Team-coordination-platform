/**
 * The data model shared by the frontend and the backend.
 * Moved here from frontend/src/lib/types.ts so both sides compile against the same shapes.
 */

export type Role = 'member' | 'admin';

export type Tier = 'ShapersGO' | 'Shapers Impact' | 'Shapers Core';

export const TIER_HOURS: Record<Tier, number> = {
  ShapersGO: 4,
  'Shapers Impact': 10,
  'Shapers Core': 70,
};

export interface Member {
  id: string;
  name: string;
  initials: string;
  tier: Tier;
  isAdmin: boolean;
  since: string;
  /** Open tasks this member picked up themselves this month. */
  picked: number;
  /** Ideas this member added this month. */
  ideas: number;
  /** Hours for the 7 finished weeks before the current one, oldest first. */
  pastWeeks: number[];
  /** Set by the API. */
  email?: string;
  /** Inactive members are hidden from pickers but keep their history. Set by the API. */
  active?: boolean;
}

export type TaskStatus = 'priority' | 'progress' | 'validation' | 'done' | 'idea';
export type Priority = 'High' | 'Medium' | 'Low';

export interface HistoryEntry {
  id: string;
  who: string;
  text: string;
  /** From the API: ISO timestamp. */
  when: string;
  comment?: string;
}

export interface TaskLink {
  label: string;
  url: string;
}

export interface Task {
  id: number;
  projectId: string;
  title: string;
  workstream: string;
  status: TaskStatus;
  /** Member id of the single owner, or null when nobody owns it yet. */
  owner: string | null;
  /** Other members working on it. */
  helpers: string[];
  priority: Priority;
  startWeek: number | null;
  endWeek: number | null;
  /** ISO date (YYYY-MM-DD). */
  due: string | null;
  notes: string;
  links: TaskLink[];
  /** Newest first. */
  history: HistoryEntry[];
  /** ISO timestamp of when the task was last moved to done. Set by the API. */
  doneAt?: string | null;
}

export interface Workstream {
  name: string;
  color: string;
  lead: string;
  doneEarlier: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  /** Member id of the project lead. */
  lead?: string;
  workstreams: Workstream[];
}

/** A running "Track time" stopwatch for regular work (not a meeting). */
export interface WorkTimer {
  memberId: string;
  projectId: string;
  /** HH:MM */
  at: string;
  /** Epoch ms, for the live clock. */
  startedAt: number;
}

export interface TimeEntry {
  id: number;
  memberId: string;
  projectId: string;
  /** ISO date. */
  date: string;
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
  note: string;
  source: 'manual' | 'meeting';
}

export type AttendanceStatus = 'present' | 'remote' | 'excused' | 'missed';

export interface MeetingSeries {
  id: string;
  name: string;
  /** null = hub-wide. */
  projectId: string | null;
  invited: string[];
}

export interface Meeting {
  id: string;
  seriesId: string;
  date: string;
  start: string;
  end: string;
  /** An admin confirmed the attendance list. */
  recorded: boolean;
}

export interface AttendanceRecord {
  meetingId: string;
  memberId: string;
  status: AttendanceStatus;
  source: 'self' | 'admin';
  /** HH:MM clock-in time for self clock-ins. */
  at?: string;
}

export interface Tracking {
  meetingId: string;
  memberId: string;
  mode: 'present' | 'remote';
  /** HH:MM */
  at: string;
  /** Epoch ms, for the live clock. */
  startedAt: number;
}
