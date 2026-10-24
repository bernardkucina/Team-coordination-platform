/**
 * Request and response shapes of the backend API (all routes are under /api).
 * The frontend and backend both import these, so a contract change breaks the build, not the demo.
 */
import type {
  AttendanceRecord, AttendanceStatus, Meeting, MeetingSeries, Member, Priority, Project, Role, Task, TaskLink,
  TaskStatus, Tier, TimeEntry, Tracking, WorkTimer,
} from './domain';

export interface ApiError {
  error: string;
  details?: unknown;
}

/* ---------- members (auth + people) ---------- */

/** POST /api/auth/demo-login (only when DEMO_MODE=true): sign in with a roster email, no password. */
export interface DemoLoginRequest {
  email: string;
}

/** POST /api/auth/demo-login */
export interface LoginResponse {
  memberId: string;
  role: Role;
}

/** GET /api/me */
export interface MeResponse {
  member: Member;
  role: Role;
}

/** PATCH /api/members/:id (admin). GET /api/members returns Member[]. */
export interface UpdateMemberRequest {
  tier?: Tier;
  isAdmin?: boolean;
  active?: boolean;
}

/** GET /api/bootstrap: everything the frontend store needs on load. */
export interface AppData {
  me: Member;
  role: Role;
  /** Server clock in Europe/Ljubljana, so the UI and the rules agree on "today". */
  now: { date: string; time: string };
  members: Member[];
  projects: Project[];
  tasks: Task[];
  series: MeetingSeries[];
  meetings: Meeting[];
  attendance: AttendanceRecord[];
  /** Members get their own entries; admins get everyone's. */
  timeEntries: TimeEntry[];
  tracking: Tracking | null;
  workTimer: WorkTimer | null;
}

/* ---------- projects ---------- */

/** POST /api/projects (admin): a project in one step, with its workstreams and first tasks. */
export interface CreateProjectRequest {
  name: string;
  description?: string;
  lead?: string;
  workstreams?: string[];
  tasks?: { title: string; workstream: string; owner: string | null }[];
}

/** POST /api/projects/:id/workstreams (admin or project lead) */
export interface AddWorkstreamRequest {
  name: string;
  lead?: string;
}

/* ---------- tasks ---------- */

/** POST /api/tasks */
export interface CreateTaskRequest {
  projectId: string;
  title: string;
  workstream: string;
  status?: TaskStatus;
  owner?: string | null;
  helpers?: string[];
  priority?: Priority;
  startWeek?: number | null;
  endWeek?: number | null;
  due?: string | null;
  notes?: string;
  links?: TaskLink[];
}

/** PATCH /api/tasks/:id: every change is written to the task history by the server. */
export type UpdateTaskRequest = Partial<Omit<CreateTaskRequest, 'links'>> & { links?: TaskLink[] };

/** POST /api/tasks/:id/comments */
export interface CommentRequest {
  text: string;
}

/* ---------- hours ---------- */

/** POST /api/time-entries */
export interface CreateTimeEntryRequest {
  projectId: string;
  date: string;
  start: string;
  end: string;
  note?: string;
  /** Admins only: log for someone else. */
  memberId?: string;
}

/** PATCH /api/time-entries/:id */
export interface UpdateTimeEntryRequest {
  projectId?: string;
  date?: string;
  start?: string;
  end?: string;
  note?: string;
}

export type PaceStatus = 'met' | 'on-track' | 'behind';

/** GET /api/hours/summary?memberId= */
export interface HoursSummary {
  memberId: string;
  weekStart: string;
  isoWeek: number;
  hours: number;
  commitment: number;
  /** Pro-rated by working days so far. */
  expected: number;
  pace: PaceStatus;
}

/** POST /api/timers/work/start */
export interface StartWorkRequest {
  projectId: string;
}

/** POST /api/timers/meeting/start: clocks in to the meeting and starts its timer. */
export interface StartMeetingRequest {
  meetingId: string;
  mode: Tracking['mode'];
}

/** PATCH /api/timers/meeting/mode */
export interface SetTrackingModeRequest {
  mode: Tracking['mode'];
}

/** POST /api/timers/work/stop, POST /api/timers/meeting/stop */
export interface StopTimerRequest {
  /** Required for meetings whose series has no project. */
  projectId?: string;
}

/** GET /api/timers, and the result of every timer call. */
export interface TimersResponse {
  tracking: Tracking | null;
  workTimer: WorkTimer | null;
  /** The entry created by a stop call. */
  entry?: TimeEntry;
}

/* ---------- attendance ---------- */

/** POST /api/meetings/:id/attendance/self: clock in, switch to remote, or say "can't come". */
export interface SelfAttendanceRequest {
  status: Extract<AttendanceStatus, 'present' | 'remote' | 'excused'>;
}

/** PUT /api/meetings/:id/attendance (admin): record or correct a whole meeting at once. */
export interface BulkAttendanceRequest {
  records: { memberId: string; status: AttendanceStatus }[];
  /** true = "Save attendance": the list is confirmed and absent members count as missed. */
  recorded?: boolean;
}

/** GET /api/meetings/:id */
export interface MeetingDetail {
  meeting: Meeting;
  series: MeetingSeries;
  attendance: AttendanceRecord[];
}

/* ---------- analytics (admin) ---------- */

export interface AttendanceStats {
  invited: number;
  present: number;
  remote: number;
  excused: number;
  missed: number;
  /** showed up ÷ (invited − excused), in percent; null when nothing counts. */
  rate: number | null;
}

/** GET /api/analytics/members */
export interface MemberAnalyticsRow {
  memberId: string;
  name: string;
  tier: Tier;
  active: boolean;
  commitment: number;
  weekHours: number;
  expectedHours: number;
  pace: PaceStatus;
  /** Average over the last 6 finished weeks. */
  avgHours6w: number;
  attendance: AttendanceStats;
  tasksOpen: number;
  tasksDone: number;
  tasksDoneThisWeek: number;
  /** Under half the commitment in each of the last two finished weeks and missed a meeting in them. */
  drifting: boolean;
  /** On pace and took initiative this month (picked up or proposed at least 2 tasks). */
  superstar: boolean;
}

export interface WeekPoint {
  weekStart: string;
  isoWeek: number;
}

/** GET /api/analytics/tiers */
export interface TierTrend {
  tier: Tier;
  members: number;
  weeks: (WeekPoint & { hours: number; commitment: number; share: number })[];
}

/** GET /api/analytics/series */
export interface SeriesTrend {
  seriesId: string;
  name: string;
  weeks: (WeekPoint & AttendanceStats)[];
}

/** GET /api/analytics/members/:id */
export interface MemberHistory {
  member: Member;
  row: MemberAnalyticsRow;
  weeks: (WeekPoint & { hours: number; commitment: number })[];
  attendance: (AttendanceRecord & { date: string; seriesId: string })[];
  tasks: Task[];
}
