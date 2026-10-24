export type Role = 'member' | 'admin';

export type Tier = 'ShapersGO' | 'Shapers Impact' | 'Shapers Core';

export const TIER_HOURS: Record<Tier, number> = {
  ShapersGO: 4,
  'Shapers Impact': 10,
  'Shapers Core': 70,
};

export interface Member {
  /** Email local part, e.g. "ana.kovac". Email is the join key across the sandbox files. */
  id: string;
  name: string;
  email: string;
  initials: string;
  tier: Tier;
  isAdmin: boolean;
  since: string;
  /** Open tasks this member picked up themselves this month. */
  picked: number;
  /** Ideas this member added this month. */
  ideas: number;
  /** Hours for the finished weeks before the current one, oldest first. */
  pastWeeks: number[];
  /** Of those hours, how many were done in the hub (the rest was remote). Same order. */
  pastWeeksHub: number[];
  /** Tasks finished in each of those weeks. Same order. */
  pastTasksDone: number[];
  /** Areas (oddelki) the member joined directly, besides their projects. */
  areas: AreaId[];
}

/** The organisation's areas ("oddelki"). Every project has one main area. */
export type AreaId = 'strategy' | 'money' | 'finance' | 'voice' | 'recruiting' | 'culture' | 'tech';

export interface Area {
  id: AreaId;
  name: string;
  /** What the area takes care of. */
  about: string;
  /** What you do there. */
  work: string;
  color: string;
  /** Only Voice and Tech meet on their own so far. */
  active: boolean;
  coreOnly: boolean;
}

export interface ProjectRole {
  name: string;
  description: string;
}

export type TaskStatus = 'priority' | 'progress' | 'validation' | 'done' | 'idea';
export type Priority = 'High' | 'Medium' | 'Low';

export interface HistoryEntry {
  id: string;
  who: string;
  text: string;
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
  /** ISO date the task moved to Done; null while it is open. */
  doneAt: string | null;
  notes: string;
  links: TaskLink[];
  /** Newest first. */
  history: HistoryEntry[];
}

/** A board row inside a project. Rows are the areas that work on the project. */
export interface Workstream {
  /** Area name, e.g. "Shapers Voice". */
  name: string;
  color: string;
  lead: string;
  doneEarlier: number;
}

export interface Project {
  id: string;
  /** "01" … "07" as in the projects document; empty for projects added later. */
  number: string;
  name: string;
  status: 'active' | 'planned';
  mainArea: AreaId;
  /** Short labels under the title, e.g. "Sodelovanje s šolami". */
  tags: string[];
  description: string;
  roles: ProjectRole[];
  /** Member id of the project lead. */
  lead: string;
  /** Member ids in the project team. */
  members: string[];
  /** Planned projects only: who said "I'm interested". */
  interested: string[];
  workstreams: Workstream[];
}

/** A running "Track time" stopwatch for regular work (not a meeting). */
export type Place = 'hub' | 'remote';

export interface WorkTimer {
  memberId: string;
  projectId: string;
  place: Place;
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
  /** Worked live in the hub or remotely. */
  place: Place;
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
