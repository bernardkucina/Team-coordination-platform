/**
 * Calls the backend. Requests go to /api on this origin; Next forwards them to the backend
 * (next.config.mjs), so the session cookie is first-party. Types come from @hub-pulse/shared.
 */
import type {
  AccessMember, AddWorkstreamRequest, AppData, AreaId, MemberAreasResponse, ApiError, BulkAttendanceRequest, CreateAccessMemberRequest, CreateProjectRequest,
  AttendanceReportRequest, CalendarSyncStatus, CreateTaskRequest, CreateTimeEntryRequest, LoginResponse, MeetingDetail,
  MemberAnalyticsRow, SessionInfo, SlackRunRequest, SlackStatus, UpdateAccessRequest, Project, SelfAttendanceRequest, Task, TimeEntry,
  TimersResponse, UpdateTaskRequest, UpdateTimeEntryRequest, HubWifiResponse, MakeupDuty,
} from '@hub-pulse/shared';

export class ApiFailure extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiFailure(res.status, err?.error ?? `Request failed (${res.status}).`, err?.details);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  login: (email: string, password?: string) => request<LoginResponse>('POST', '/auth/login', { email, ...(password ? { password } : {}) }),
  session: () => request<SessionInfo>('GET', '/auth/session'),
  logout: () => request<void>('POST', '/auth/logout'),
  bootstrap: () => request<AppData>('GET', '/bootstrap'),

  createProject: (body: CreateProjectRequest) => request<Project>('POST', '/projects', body),
  addWorkstream: (projectId: string, body: AddWorkstreamRequest) => request<Project>('POST', `/projects/${encodeURIComponent(projectId)}/workstreams`, body),
  joinProject: (projectId: string) => request<Project>('POST', `/projects/${encodeURIComponent(projectId)}/members`),
  leaveProject: (projectId: string) => request<Project>('DELETE', `/projects/${encodeURIComponent(projectId)}/members`),
  setInterest: (projectId: string, on: boolean) => request<Project>(on ? 'POST' : 'DELETE', `/projects/${encodeURIComponent(projectId)}/interest`),
  setArea: (areaId: AreaId, on: boolean) => request<MemberAreasResponse>(on ? 'POST' : 'DELETE', `/members/me/areas/${areaId}`),
  createTask: (body: CreateTaskRequest) => request<Task>('POST', '/tasks', body),
  reorderTasks: (ids: number[]) => request<void>('PUT', '/tasks/order', { ids }),
  updateTask: (id: number, body: UpdateTaskRequest) => request<Task>('PATCH', `/tasks/${id}`, body),
  comment: (id: number, text: string) => request<Task>('POST', `/tasks/${id}/comments`, { text }),

  logTime: (body: CreateTimeEntryRequest) => request<TimeEntry>('POST', '/time-entries', body),
  editTime: (id: number, body: UpdateTimeEntryRequest) => request<TimeEntry>('PATCH', `/time-entries/${id}`, body),
  deleteTime: (id: number) => request<void>('DELETE', `/time-entries/${id}`),
  startWork: (projectId: string, location?: 'hub' | 'remote') => request<TimersResponse>('POST', '/timers/work/start', { projectId, ...(location ? { location } : {}) }),
  stopWork: () => request<TimersResponse>('POST', '/timers/work/stop', {}),
  startMeeting: (meetingId: string, mode: 'present' | 'remote') => request<TimersResponse>('POST', '/timers/meeting/start', { meetingId, mode }),
  setMeetingMode: (mode: 'present' | 'remote') => request<TimersResponse>('PATCH', '/timers/meeting/mode', { mode }),
  stopMeeting: (projectId?: string) => request<TimersResponse>('POST', '/timers/meeting/stop', { projectId }),

  markSelf: (meetingId: string, body: SelfAttendanceRequest) => request<unknown>('POST', `/meetings/${encodeURIComponent(meetingId)}/attendance/self`, body),
  unmarkSelf: (meetingId: string) => request<void>('DELETE', `/meetings/${encodeURIComponent(meetingId)}/attendance/self`),
  reportAttendance: (meetingId: string, body: AttendanceReportRequest) => request<unknown>('POST', `/meetings/${encodeURIComponent(meetingId)}/attendance/report`, body),
  syncCalendar: () => request<CalendarSyncStatus>('POST', '/calendar/sync'),
  slackStatus: () => request<SlackStatus>('GET', '/slack/status'),
  slackRun: (job: SlackRunRequest['job']) => request<Record<string, unknown>>('POST', '/slack/run', { job }),
  memberAnalytics: () => request<MemberAnalyticsRow[]>('GET', '/analytics/members'),
  recordMeeting: (meetingId: string, body: BulkAttendanceRequest) => request<MeetingDetail>('PUT', `/meetings/${encodeURIComponent(meetingId)}/attendance`, body),
  accessMembers: () => request<AccessMember[]>('GET', '/access/members'),
  addAccessMember: (body: CreateAccessMemberRequest) => request<AccessMember>('POST', '/access/members', body),
  updateAccess: (id: string, body: UpdateAccessRequest) => request<AccessMember>('PATCH', `/access/members/${encodeURIComponent(id)}`, body),

  takeMakeup: (meetingId: string, taskId: number) => request<MakeupDuty>('POST', `/makeups/${encodeURIComponent(meetingId)}/take`, { taskId }),
  hubWifi: () => request<HubWifiResponse>('GET', '/access/hub-wifi'),
  addHubWifi: (ip?: string) => request<HubWifiResponse>('POST', '/access/hub-wifi', ip ? { ip } : {}),
  removeHubWifi: (ip: string) => request<HubWifiResponse>('DELETE', `/access/hub-wifi/${encodeURIComponent(ip)}`),
  fillPresent: (meetingId: string) => request<MeetingDetail>('POST', `/meetings/${encodeURIComponent(meetingId)}/attendance/fill-present`),
};
