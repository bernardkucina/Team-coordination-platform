'use client';

import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type {
  AreaId, AttendanceRecord, AttendanceStatus, HistoryEntry, Meeting, MeetingSeries, Member, Project, ProjectRole, Role, Task, TimeEntry, Tracking, WorkTimer,
} from './types';
import { ADMIN_DEMO_USER, ATTENDANCE, MEETINGS, MEMBERS, MEMBER_DEMO_USER, PROJECTS, SERIES, TASKS, TIME_ENTRIES, areaById } from './data';
import { DEMO_TODAY, toMin, fromMin } from './time';

export interface AppState {
  role: Role;
  members: Member[];
  projects: Project[];
  tasks: Task[];
  series: MeetingSeries[];
  meetings: Meeting[];
  attendance: AttendanceRecord[];
  timeEntries: TimeEntry[];
  tracking: Tracking | null;
  workTimer: WorkTimer | null;
  /** Id of the time entry that was just added or edited, to highlight it. */
  lastEntryId: number | null;
  nextId: number;
  toast: string | null;
}

export type Action =
  | { type: 'setRole'; role: Role }
  | { type: 'toast'; text: string | null }
  | { type: 'logTime'; entry: Omit<TimeEntry, 'id'> }
  | { type: 'editTime'; id: number; start: string; end: string }
  | { type: 'startTracking'; tracking: Tracking }
  | { type: 'setTrackingMode'; mode: Tracking['mode'] }
  | { type: 'stopTracking'; end: string; projectId: string }
  | { type: 'setAttendance'; meetingId: string; memberId: string; status: AttendanceStatus; source: AttendanceRecord['source']; at?: string }
  | { type: 'fillPresent'; meetingId: string }
  | { type: 'markRecorded'; meetingId: string }
  | { type: 'updateTask'; taskId: number; patch: Partial<Task>; who: string; text: string }
  | { type: 'comment'; taskId: number; who: string; text: string }
  | { type: 'addTask'; task: Omit<Task, 'id'> }
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

const toggle = (list: string[], id: string): string[] => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

const initialState: AppState = {
  role: 'member',
  members: MEMBERS,
  projects: PROJECTS,
  tasks: TASKS,
  series: SERIES,
  meetings: MEETINGS,
  attendance: ATTENDANCE,
  timeEntries: TIME_ENTRIES,
  tracking: null,
  workTimer: null,
  lastEntryId: null,
  nextId: 1000,
  toast: null,
};

const upsertAttendance = (list: AttendanceRecord[], rec: AttendanceRecord): AttendanceRecord[] => [
  ...list.filter((r) => !(r.meetingId === rec.meetingId && r.memberId === rec.memberId)),
  rec,
];

const withHistory = (task: Task, entry: Omit<HistoryEntry, 'id'>, id: number): Task => ({
  ...task,
  history: [{ ...entry, id: `h${id}` }, ...task.history],
});

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setRole':
      return { ...state, role: action.role };
    case 'toast':
      return { ...state, toast: action.text };
    case 'logTime': {
      const id = state.nextId;
      return { ...state, timeEntries: [{ ...action.entry, id }, ...state.timeEntries], lastEntryId: id, nextId: id + 1 };
    }
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
        note: `Meeting: ${series?.name ?? 'meeting'}`, source: 'meeting', place: t.mode === 'present' ? 'hub' : 'remote',
      };
      return { ...state, tracking: null, timeEntries: [entry, ...state.timeEntries], lastEntryId: id, nextId: id + 1 };
    }
    case 'setAttendance':
      return {
        ...state,
        attendance: upsertAttendance(state.attendance, {
          meetingId: action.meetingId, memberId: action.memberId, status: action.status, source: action.source, at: action.at,
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
        tasks: state.tasks.map((t) => {
          if (t.id !== action.taskId) return t;
          const next = { ...t, ...action.patch };
          // Keep the finish date in step with the status, wherever the change came from.
          if (next.status === 'done' && t.status !== 'done') next.doneAt = DEMO_TODAY;
          if (next.status !== 'done') next.doneAt = null;
          return withHistory(next, { who: action.who, text: action.text, when: 'just now' }, state.nextId);
        }),
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
    case 'startWork':
      return { ...state, workTimer: action.timer };
    case 'stopWork': {
      const w = state.workTimer;
      if (!w) return state;
      const id = state.nextId;
      const entry: TimeEntry = {
        id, memberId: w.memberId, projectId: w.projectId, date: DEMO_TODAY, start: w.at,
        end: fromMin(Math.max(toMin(w.at) + 1, toMin(action.end))), note: '', source: 'manual', place: w.place,
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
      const team = Array.from(new Set([p.lead, ...p.tasks.map((t) => t.owner).filter((x): x is string => !!x)]));
      const project: Project = {
        id, number: '', name: p.name, status: 'active', mainArea: p.mainArea, tags: [], description: p.description,
        roles: p.roles, lead: p.lead, members: team, interested: [],
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
    case 'toggleArea':
      return {
        ...state,
        members: state.members.map((m) =>
          m.id === action.memberId ? { ...m, areas: toggle(m.areas, action.areaId) as AreaId[] } : m,
        ),
      };
    default:
      return state;
  }
}

interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
  me: Member;
  isAdmin: boolean;
  memberName: (id: string | null) => string;
  flash: (text: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (!state.toast) return;
    const t = setTimeout(() => dispatch({ type: 'toast', text: null }), 2600);
    return () => clearTimeout(t);
  }, [state.toast]);

  const value = useMemo<StoreValue>(() => {
    const meId = state.role === 'admin' ? ADMIN_DEMO_USER : MEMBER_DEMO_USER;
    const me = state.members.find((m) => m.id === meId) ?? state.members[0];
    return {
      state,
      dispatch,
      me,
      isAdmin: state.role === 'admin',
      memberName: (id) => (id ? state.members.find((m) => m.id === id)?.name ?? id : 'No owner'),
      flash: (text) => dispatch({ type: 'toast', text }),
    };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
