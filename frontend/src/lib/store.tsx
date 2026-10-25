'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import type {
  AppData, AreaId, AttendanceRecord, AttendanceStatus, CalendarSyncStatus, HistoryEntry, HubNetwork, MakeupDuty, Meeting, MeetingSeries, Member, Project,
  ProjectRole, Role, Task, TimeEntry, Tracking, UpdateTaskRequest, WorkTimer,
} from './types';
import { areaById } from './types';
import { ApiFailure, api } from './api';
import { DEMO_TODAY, fromMin, localDate, setClock, tickClock, toMin } from './time';
import { SignIn } from '@/components/SignIn';
import { AccessConsole } from '@/components/AccessConsole';

export interface AppState {
  role: Role;
  /** The signed-in member as the server sent it. */
  me: Member;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  series: MeetingSeries[];
  meetings: Meeting[];
  attendance: AttendanceRecord[];
  timeEntries: TimeEntry[];
  tracking: Tracking | null;
  workTimer: WorkTimer | null;
  /** Admins only: the last calendar sync. */
  calendar: CalendarSyncStatus | null;
  /** Whether this browser is on the hub wifi ("in the hub" is only allowed there). */
  network: HubNetwork;
  /** Make-up duties for missed meetings: your own, or everyone's for admins. */
  makeups: MakeupDuty[];
  /** Id of the time entry that was just added or edited, to highlight it. */
  lastEntryId: number | null;
  /** Id for the next optimistic change. Negative, so it never clashes with the server's ids. */
  nextId: number;
  toast: string | null;
}

export type Action =
  /** Replaces all data with what the server returned (GET /api/bootstrap). */
  | { type: 'load'; data: AppData; lastEntryId?: number | null }
  /** Re-renders after the clock moved on. */
  | { type: 'tick' }
  | { type: 'toast'; text: string | null }
  | { type: 'logTime'; entry: Omit<TimeEntry, 'id'> }
  | { type: 'editTime'; id: number; start: string; end: string }
  | { type: 'deleteTime'; id: number }
  | { type: 'startTracking'; tracking: Tracking }
  | { type: 'setTrackingMode'; mode: Tracking['mode'] }
  | { type: 'stopTracking'; end: string; projectId: string }
  | { type: 'setAttendance'; meetingId: string; memberId: string; status: AttendanceStatus; source: AttendanceRecord['source']; at?: string; reason?: string }
  /** Takes back your own "can't come" before the meeting. */
  | { type: 'unexcuseSelf'; meetingId: string; memberId: string }
  /** "Did you attend?" after a meeting you did not clock in to. */
  | { type: 'reportAttendance'; meetingId: string; memberId: string; answer: 'present' | 'remote' | 'absent'; reason?: string }
  | { type: 'fillPresent'; meetingId: string }
  | { type: 'markRecorded'; meetingId: string }
  | { type: 'updateTask'; taskId: number; patch: Partial<Task>; who: string; text: string }
  | { type: 'comment'; taskId: number; who: string; text: string }
  | { type: 'addTask'; task: Omit<Task, 'id'> }
  /** A task the server already created (shown at once; nothing more to save). */
  | { type: 'taskCreated'; task: Task }
  | { type: 'reorderTasks'; ids: number[] }
  /** Pick a General task for a missed meeting: you become its owner. */
  | { type: 'takeMakeup'; meetingId: string; taskId: number; who: string }
  | { type: 'startWork'; timer: WorkTimer }
  | { type: 'stopWork'; end: string }
  | { type: 'addProject'; project: NewProject; who: string }
  | { type: 'addArea'; projectId: string; areaId: AreaId; lead: string }
  | { type: 'joinProject'; projectId: string; memberId: string }
  | { type: 'leaveProject'; projectId: string; memberId: string }
  | { type: 'toggleInterest'; projectId: string; memberId: string }
  | { type: 'toggleArea'; areaId: AreaId; memberId: string };

export interface NewProject {
  name: string;
  description: string;
  lead: string;
  mainArea: AreaId;
  /** Areas that work on the project; they become the board rows. */
  areas: AreaId[];
  roles: ProjectRole[];
  tasks: { title: string; areaId: AreaId; owner: string | null }[];
}

const toggle = <T extends string>(list: T[], id: T): T[] => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

/** Optimistic changes get negative ids until the reload brings the server's. */
const FIRST_TEMP_ID = -1_000_000;

const fromData = (data: AppData): Omit<AppState, 'lastEntryId' | 'nextId' | 'toast'> => ({
  role: data.role,
  me: data.me,
  members: data.members,
  projects: data.projects,
  // The screens count finished tasks per day and week, so keep the local date the task was finished.
  tasks: data.tasks.map((t) => ({ ...t, doneAt: t.doneAt ? localDate(t.doneAt) : null })),
  series: data.series,
  meetings: data.meetings,
  attendance: data.attendance,
  timeEntries: data.timeEntries,
  tracking: data.tracking,
  workTimer: data.workTimer,
  calendar: data.calendar ?? null,
  network: data.network,
  makeups: data.makeups,
});

const upsertAttendance = (list: AttendanceRecord[], rec: AttendanceRecord): AttendanceRecord[] => [
  ...list.filter((r) => !(r.meetingId === rec.meetingId && r.memberId === rec.memberId)),
  rec,
];

const withHistory = (task: Task, entry: Omit<HistoryEntry, 'id'>, id: number): Task => ({
  ...task,
  history: [{ ...entry, id: `h${id}` }, ...task.history],
});
/** Applies a task patch; moving it to Done (or out of Done) sets the finish date the way the server will. */
const withDoneAt = (task: Task, patch: Partial<Task>): Task => {
  const next = { ...task, ...patch };
  if (patch.status && patch.status !== task.status) next.doneAt = patch.status === 'done' ? DEMO_TODAY : null;
  return next;
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'tick':
      return { ...state };
    case 'toast':
      return { ...state, toast: action.text };
    case 'logTime': {
      const id = state.nextId;
      return { ...state, timeEntries: [{ ...action.entry, id }, ...state.timeEntries], lastEntryId: id, nextId: id + 1 };
    }
    case 'deleteTime':
      return { ...state, timeEntries: state.timeEntries.filter((e) => e.id !== action.id) };
    case 'unexcuseSelf':
      return { ...state, attendance: state.attendance.filter((r) => !(r.meetingId === action.meetingId && r.memberId === action.memberId)) };
    case 'reportAttendance':
      return {
        ...state,
        attendance: upsertAttendance(state.attendance, {
          meetingId: action.meetingId, memberId: action.memberId, source: 'self',
          status: action.answer === 'absent' ? 'excused' : action.answer, ...(action.reason ? { reason: action.reason } : {}),
        }),
      };
    case 'editTime':
      return {
        ...state,
        timeEntries: state.timeEntries.map((e) => (e.id === action.id ? { ...e, start: action.start, end: action.end } : e)),
        lastEntryId: action.id,
      };
    case 'startTracking': {
      const t = action.tracking;
      return {
        ...state,
        tracking: t,
        attendance: upsertAttendance(state.attendance, { meetingId: t.meetingId, memberId: t.memberId, status: t.mode, source: 'self', at: t.at }),
      };
    }
    case 'setTrackingMode': {
      if (!state.tracking) return state;
      const t = { ...state.tracking, mode: action.mode };
      return {
        ...state,
        tracking: t,
        attendance: upsertAttendance(state.attendance, { meetingId: t.meetingId, memberId: t.memberId, status: t.mode, source: 'self', at: t.at }),
      };
    }
    case 'stopTracking': {
      const t = state.tracking;
      if (!t) return state;
      const meeting = state.meetings.find((m) => m.id === t.meetingId);
      const series = state.series.find((s) => s.id === meeting?.seriesId);
      const end = fromMin(Math.max(toMin(t.at) + 1, toMin(action.end)));
      const id = state.nextId;
      const entry: TimeEntry = {
        id, memberId: t.memberId, projectId: action.projectId, date: DEMO_TODAY, start: t.at, end,
        note: `Meeting: ${series?.name ?? 'meeting'}`, source: 'meeting',
      };
      return { ...state, tracking: null, timeEntries: [entry, ...state.timeEntries], lastEntryId: id, nextId: id + 1 };
    }
    case 'setAttendance':
      return {
        ...state,
        attendance: upsertAttendance(state.attendance, {
          meetingId: action.meetingId, memberId: action.memberId, status: action.status, source: action.source, at: action.at,
          ...(action.reason ? { reason: action.reason } : {}),
        }),
        meetings: state.meetings.map((m) => (m.id === action.meetingId && action.source === 'admin' ? { ...m, recorded: false } : m)),
      };
    case 'fillPresent': {
      const meeting = state.meetings.find((m) => m.id === action.meetingId);
      const series = state.series.find((s) => s.id === meeting?.seriesId);
      if (!series) return state;
      let attendance = state.attendance;
      for (const memberId of series.invited) {
        if (!attendance.some((r) => r.meetingId === action.meetingId && r.memberId === memberId)) {
          attendance = upsertAttendance(attendance, { meetingId: action.meetingId, memberId, status: 'present', source: 'admin' });
        }
      }
      return { ...state, attendance };
    }
    case 'markRecorded':
      return { ...state, meetings: state.meetings.map((m) => (m.id === action.meetingId ? { ...m, recorded: true } : m)) };
    case 'updateTask':
      return {
        ...state,
        nextId: state.nextId + 1,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? withHistory(withDoneAt(t, action.patch), { who: action.who, text: action.text, when: 'just now' }, state.nextId) : t,
        ),
      };
    case 'comment':
      return {
        ...state,
        nextId: state.nextId + 1,
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? withHistory(t, { who: action.who, text: 'commented', when: 'just now', comment: action.text }, state.nextId) : t,
        ),
      };
    case 'addTask':
      return { ...state, tasks: [...state.tasks, { ...action.task, id: state.nextId }], nextId: state.nextId + 1 };
    case 'taskCreated':
      return { ...state, tasks: [...state.tasks.filter((t) => t.id !== action.task.id), { ...action.task, doneAt: null }] };
    case 'takeMakeup':
      return {
        ...state,
        nextId: state.nextId + 1,
        makeups: state.makeups.map((d) => (d.meetingId === action.meetingId && d.memberId === state.me.id ? { ...d, taskId: action.taskId } : d)),
        tasks: state.tasks.map((t) =>
          t.id === action.taskId ? withHistory({ ...t, owner: state.me.id }, { who: action.who, text: 'took it to make up for a missed meeting', when: 'just now' }, state.nextId) : t,
        ),
      };
    case 'reorderTasks': {
      const pos = new Map(action.ids.map((id, i) => [id, i]));
      return { ...state, tasks: state.tasks.map((t) => (pos.has(t.id) ? { ...t, rank: pos.get(t.id) } : t)) };
    }
    case 'startWork':
      return { ...state, workTimer: action.timer };
    case 'stopWork': {
      const w = state.workTimer;
      if (!w) return state;
      const id = state.nextId;
      const entry: TimeEntry = {
        id, memberId: w.memberId, projectId: w.projectId, date: DEMO_TODAY, start: w.at,
        end: fromMin(Math.max(toMin(w.at) + 1, toMin(action.end))), note: '', source: 'manual', location: w.location ?? null,
      };
      return { ...state, workTimer: null, timeEntries: [entry, ...state.timeEntries], lastEntryId: id, nextId: id + 1 };
    }
    case 'addProject': {
      const p = action.project;
      const id = `p${state.nextId}`;
      const areaIds = Array.from(new Set([p.mainArea, ...p.areas]));
      let nextId = state.nextId + 1;
      const tasks: Task[] = p.tasks.map((t) => ({
        id: nextId++, projectId: id, title: t.title, workstream: areaById(areaIds.includes(t.areaId) ? t.areaId : p.mainArea).name,
        status: 'priority', owner: t.owner, helpers: [], priority: 'Medium', startWeek: null, endWeek: null, due: null, doneAt: null,
        notes: '', links: [], history: [{ id: `h${nextId}`, who: action.who, text: 'created this task with the project', when: 'just now' }],
      }));
      const team = Array.from(new Set([p.lead, ...p.tasks.map((t) => t.owner)].filter((x): x is string => !!x)));
      const project: Project = {
        id, number: '', name: p.name, status: 'active', mainArea: p.mainArea, tags: [], tagline: '', description: p.description,
        roles: p.roles, lead: p.lead, members: team, interested: [], deadline: null,
        workstreams: areaIds.map((a) => ({ name: areaById(a).name, color: areaById(a).color, lead: p.lead, doneEarlier: 0 })),
      };
      return { ...state, nextId, projects: [...state.projects, project], tasks: [...state.tasks, ...tasks] };
    }
    case 'addArea': {
      const area = areaById(action.areaId);
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId && !p.workstreams.some((w) => w.name === area.name)
            ? { ...p, workstreams: [...p.workstreams, { name: area.name, color: area.color, lead: action.lead, doneEarlier: 0 }] }
            : p,
        ),
      };
    }
    case 'joinProject':
    case 'leaveProject':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id !== action.projectId ? p
            : { ...p, members: action.type === 'joinProject' ? Array.from(new Set([...p.members, action.memberId])) : p.members.filter((m) => m !== action.memberId) },
        ),
      };
    case 'toggleInterest':
      return { ...state, projects: state.projects.map((p) => (p.id === action.projectId ? { ...p, interested: toggle(p.interested, action.memberId) } : p)) };
    case 'toggleArea': {
      const flip = (m: Member): Member => (m.id === action.memberId ? { ...m, areas: toggle(m.areas, action.areaId) } : m);
      return { ...state, members: state.members.map(flip), me: flip(state.me) };
    }
    default:
      return state;
  }
}

/** Before the first load there is no state; 'load' creates it. */
function rootReducer(state: AppState | null, action: Action): AppState | null {
  if (action.type === 'load') {
    return {
      nextId: FIRST_TEMP_ID,
      toast: null,
      lastEntryId: null,
      ...state,
      ...fromData(action.data),
      ...(action.lastEntryId !== undefined && { lastEntryId: action.lastEntryId }),
    };
  }
  if (action.type === 'tick') return state && { ...state };
  return state && reducer(state, action);
}

/** Fields the API accepts on PATCH /api/tasks/:id. */
const TASK_FIELDS = ['projectId', 'title', 'workstream', 'status', 'owner', 'helpers', 'priority', 'startWeek', 'endWeek', 'due', 'notes', 'links'] as const;

const taskPatch = (patch: Partial<Task>): UpdateTaskRequest =>
  Object.fromEntries(TASK_FIELDS.filter((k) => patch[k] !== undefined).map((k) => [k, patch[k]])) as UpdateTaskRequest;

/**
 * Saves one action on the backend. Returns the id of a time entry the server created, so it can be highlighted.
 * Actions on things that only exist optimistically (negative ids) are skipped; the reload brings the real ones.
 * `before` is the state the action was applied to, for toggles that become a POST or a DELETE.
 */
const persist = async (action: Action, before: AppState | null): Promise<number | null> => {
  switch (action.type) {
    case 'logTime': {
      const { projectId, date, start, end, note, location } = action.entry;
      return (await api.logTime({ projectId, date, start, end, note, ...(location ? { location } : {}) })).id;
    }
    case 'editTime':
      if (action.id < 0) return null;
      return (await api.editTime(action.id, { start: action.start, end: action.end })).id;
    case 'deleteTime':
      if (action.id > 0) await api.deleteTime(action.id);
      return null;
    case 'startWork':
      await api.startWork(action.timer.projectId, action.timer.location ?? undefined);
      return null;
    case 'stopWork':
      return (await api.stopWork()).entry?.id ?? null;
    case 'startTracking':
      await api.startMeeting(action.tracking.meetingId, action.tracking.mode);
      return null;
    case 'setTrackingMode':
      await api.setMeetingMode(action.mode);
      return null;
    case 'stopTracking':
      return (await api.stopMeeting(action.projectId)).entry?.id ?? null;
    case 'setAttendance':
      if (action.source === 'admin') {
        await api.recordMeeting(action.meetingId, { records: [{ memberId: action.memberId, status: action.status }], recorded: false });
      } else if (action.status !== 'missed') {
        await api.markSelf(action.meetingId, { status: action.status, ...(action.reason ? { reason: action.reason } : {}) });
      }
      return null;
    case 'unexcuseSelf':
      await api.unmarkSelf(action.meetingId);
      return null;
    case 'reportAttendance':
      await api.reportAttendance(action.meetingId, { status: action.answer, ...(action.reason ? { reason: action.reason } : {}) });
      return null;
    case 'fillPresent':
      await api.fillPresent(action.meetingId);
      return null;
    case 'markRecorded':
      await api.recordMeeting(action.meetingId, { records: [], recorded: true });
      return null;
    case 'updateTask':
      if (action.taskId > 0) await api.updateTask(action.taskId, taskPatch(action.patch));
      return null;
    case 'comment':
      if (action.taskId > 0) await api.comment(action.taskId, action.text);
      return null;
    case 'addTask': {
      const t = action.task;
      await api.createTask({
        projectId: t.projectId, title: t.title, workstream: t.workstream, status: t.status, owner: t.owner, helpers: t.helpers,
        priority: t.priority, startWeek: t.startWeek, endWeek: t.endWeek, due: t.due, notes: t.notes, links: t.links,
      });
      return null;
    }
    case 'takeMakeup':
      await api.takeMakeup(action.meetingId, action.taskId);
      return null;
    case 'reorderTasks': {
      const ids = action.ids.filter((id) => id > 0);
      if (ids.length) await api.reorderTasks(ids);
      return null;
    }
    case 'addProject': {
      const p = action.project;
      await api.createProject({
        name: p.name, description: p.description, lead: p.lead || undefined, mainArea: p.mainArea, areas: p.areas, roles: p.roles,
        tasks: p.tasks.map((t) => ({ title: t.title, area: t.areaId, owner: t.owner })),
      });
      return null;
    }
    case 'addArea':
      // A project created a moment ago still has its temporary id (p-1000000); the reload brings the real one.
      if (!/^p-\d+$/.test(action.projectId)) await api.addWorkstream(action.projectId, { area: action.areaId, lead: action.lead || undefined });
      return null;
    case 'joinProject':
      await api.joinProject(action.projectId);
      return null;
    case 'leaveProject':
      await api.leaveProject(action.projectId);
      return null;
    case 'toggleInterest': {
      const was = before?.projects.find((p) => p.id === action.projectId)?.interested.includes(action.memberId) ?? false;
      await api.setInterest(action.projectId, !was);
      return null;
    }
    case 'toggleArea': {
      const was = before?.me.areas.includes(action.areaId) ?? false;
      await api.setArea(action.areaId, !was);
      return null;
    }
    default:
      return null;
  }
};

/** How often the data is reloaded so other people's changes show up. */
const REFRESH_MS = 30_000;
/** How often "now" moves on screen. */
const TICK_MS = 15_000;

interface StoreValue {
  state: AppState;
  /** Shows the change right away and saves it on the server. */
  dispatch: (action: Action) => void;
  me: Member;
  isAdmin: boolean;
  memberName: (id: string | null) => string;
  flash: (text: string) => void;
  /** Sign in with an email (roster members in DEMO_MODE) or the super admin's email and password. */
  signIn: (email: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Admins: read the calendar again now. */
  syncCalendar: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** 'superadmin': the super admin is signed in; it only gets the access console. */
type Status = 'loading' | 'signed-out' | 'ready' | 'superadmin' | 'error';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState('');
  const [state, rawDispatch] = useReducer(rootReducer, null);
  /** The latest state, so dispatch can tell persist() what an action changed (e.g. interest on or off). */
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const highlight = useRef<number | null>(null);

  /** Loads everything from the server. A 401 shows the sign-in screen, the super admin gets the access console. */
  const refresh = useCallback(async () => {
    try {
      const data = await api.bootstrap();
      setClock(data.now.date, data.now.time);
      rawDispatch({ type: 'load', data, ...(highlight.current !== null && { lastEntryId: highlight.current }) });
      highlight.current = null;
      setStatus('ready');
    } catch (err) {
      if (err instanceof ApiFailure && err.status === 401) {
        setStatus('signed-out');
      } else if (err instanceof ApiFailure && err.status === 403 && (await api.session().catch(() => null))?.kind === 'superadmin') {
        setStatus('superadmin');
      } else {
        setLoadError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      }
    }
  }, []);

  const flash = useCallback((text: string) => rawDispatch({ type: 'toast', text }), []);

  const dispatch = useCallback((action: Action) => {
    const before = stateRef.current;
    rawDispatch(action);
    if (action.type === 'toast' || action.type === 'load' || action.type === 'tick') return;
    // Saves run one at a time in order; once nothing is waiting, reload so the screen shows what the server kept.
    // A refused change (e.g. hours too far back) shows the server's reason, and the reload undoes it on screen.
    pending.current++;
    queue.current = queue.current
      .then(async () => {
        const entryId = await persist(action, before);
        if (entryId !== null) highlight.current = entryId;
      })
      .catch((err: unknown) => {
        if (err instanceof ApiFailure && err.status === 401) setStatus('signed-out');
        else flash(err instanceof Error ? err.message : 'Could not save the change.');
      })
      .finally(async () => {
        pending.current--;
        if (pending.current === 0) await refresh();
      });
  }, [flash, refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (status !== 'ready') return;
    const tick = setInterval(() => {
      tickClock();
      rawDispatch({ type: 'tick' });
    }, TICK_MS);
    const reload = setInterval(() => {
      if (pending.current === 0) void refresh();
    }, REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(reload);
    };
  }, [status, refresh]);

  useEffect(() => {
    if (!state?.toast) return;
    const t = setTimeout(() => rawDispatch({ type: 'toast', text: null }), 2600);
    return () => clearTimeout(t);
  }, [state?.toast]);

  const signIn = useCallback(async (email: string, password?: string) => {
    const session = await api.login(email, password);
    if (session.kind === 'superadmin') {
      setStatus('superadmin');
      return;
    }
    setStatus('loading');
    await refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await api.logout();
    setStatus('signed-out');
  }, []);

  const syncCalendar = useCallback(async () => {
    try {
      const status = await api.syncCalendar();
      flash(status.error ? `Calendar sync failed: ${status.error}` : `Calendar synced: ${status.result ?? 'done'}`);
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Calendar sync failed.');
    }
    await refresh();
  }, [flash, refresh]);

  const value = useMemo<StoreValue | null>(() => {
    if (!state) return null;
    const me = state.members.find((m) => m.id === state.me.id) ?? state.me;
    return {
      state,
      dispatch,
      me,
      isAdmin: state.role === 'admin',
      memberName: (id) => (id ? state.members.find((m) => m.id === id)?.name ?? id : 'No owner'),
      flash,
      signIn,
      signOut,
      syncCalendar,
    };
  }, [state, dispatch, flash, signIn, signOut, syncCalendar]);

  if (status === 'signed-out') return <SignIn onSignIn={signIn} />;
  if (status === 'superadmin') return <AccessConsole onSignOut={signOut} />;
  if (status === 'error') {
    return (
      <div className="signin">
        <section className="card" style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 22 }}>Shapers Hub cannot reach the server</h1>
          <p className="small muted">{loadError}</p>
          <button type="button" className="btn btn-primary" onClick={() => { setStatus('loading'); void refresh(); }}>Try again</button>
        </section>
      </div>
    );
  }
  if (status === 'loading' || !value) {
    return <div className="signin"><span className="muted">Loading Shapers Hub…</span></div>;
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
