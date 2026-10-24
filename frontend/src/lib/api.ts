/**
 * Calls the backend. Requests go to /api on this origin; Next forwards them to the backend
 * (next.config.mjs), so the session cookie is first-party. Types come from @hub-pulse/shared.
 */
import type {
  AddWorkstreamRequest, AppData, ApiError, BulkAttendanceRequest, CreateProjectRequest, CreateTaskRequest,
  CreateTimeEntryRequest, LoginResponse, MeetingDetail, Project, SelfAttendanceRequest, Task, TimeEntry,
  TimersResponse, UpdateTaskRequest, UpdateTimeEntryRequest,
} from '@hub-pulse/shared';

export class ApiFailure extends Error {
  constructor(public status: number, message: string) {
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
    throw new ApiFailure(res.status, err?.error ?? `Request failed (${res.status}).`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  demoLogin: (email: string) => request<LoginResponse>('POST', '/auth/demo-login', { email }),
  logout: () => request<void>('POST', '/auth/logout'),
  bootstrap: () => request<AppData>('GET', '/bootstrap'),

  createProject: (body: CreateProjectRequest) => request<Project>('POST', '/projects', body),
  addWorkstream: (projectId: string, body: AddWorkstreamRequest) => request<Project>('POST', `/projects/${encodeURIComponent(projectId)}/workstreams`, body),
  createTask: (body: CreateTaskRequest) => request<Task>('POST', '/tasks', body),
  updateTask: (id: number, body: UpdateTaskRequest) => request<Task>('PATCH', `/tasks/${id}`, body),
  comment: (id: number, text: string) => request<Task>('POST', `/tasks/${id}/comments`, { text }),

  logTime: (body: CreateTimeEntryRequest) => request<TimeEntry>('POST', '/time-entries', body),
  editTime: (id: number, body: UpdateTimeEntryRequest) => request<TimeEntry>('PATCH', `/time-entries/${id}`, body),
  startWork: (projectId: string) => request<TimersResponse>('POST', '/timers/work/start', { projectId }),
  stopWork: () => request<TimersResponse>('POST', '/timers/work/stop', {}),
  startMeeting: (meetingId: string, mode: 'present' | 'remote') => request<TimersResponse>('POST', '/timers/meeting/start', { meetingId, mode }),
  setMeetingMode: (mode: 'present' | 'remote') => request<TimersResponse>('PATCH', '/timers/meeting/mode', { mode }),
  stopMeeting: (projectId?: string) => request<TimersResponse>('POST', '/timers/meeting/stop', { projectId }),

  markSelf: (meetingId: string, body: SelfAttendanceRequest) => request<unknown>('POST', `/meetings/${encodeURIComponent(meetingId)}/attendance/self`, body),
  recordMeeting: (meetingId: string, body: BulkAttendanceRequest) => request<MeetingDetail>('PUT', `/meetings/${encodeURIComponent(meetingId)}/attendance`, body),
  fillPresent: (meetingId: string) => request<MeetingDetail>('POST', `/meetings/${encodeURIComponent(meetingId)}/attendance/fill-present`),
};
