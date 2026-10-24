/**
 * Turns a task change into the sentence shown in its history ("moved it to Done and set the owner to Maja").
 * The server writes these, so the history cannot be skipped or faked by a client.
 */
import type { Priority, TaskLink, TaskStatus } from '@hub-pulse/shared';

export const STATUS_NAMES: Record<TaskStatus, string> = {
  idea: 'Ideas', priority: 'Priority', progress: 'In progress', validation: 'Validation', done: 'Done',
};

export const CREATED_TEXT = 'created this task';
export const IDEA_CREATED_TEXT = 'added this idea';
export const CREATED_WITH_PROJECT_TEXT = 'created this task with the project';

export interface TaskFields {
  projectId: string;
  workstream: string;
  title: string;
  status: TaskStatus;
  owner: string | null;
  helpers: string[];
  priority: Priority;
  startWeek: number | null;
  endWeek: number | null;
  due: string | null;
  notes: string;
  links: TaskLink[];
}

export interface Names {
  member: (id: string) => string;
  project: (id: string) => string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (iso: string): string => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

const sameList = (a: string[], b: string[]): boolean => a.length === b.length && [...a].sort().join() === [...b].sort().join();

const weeks = (start: number | null, end: number | null): string => {
  if (start === null && end === null) return 'no timeline';
  if (start === null || end === null || start === end) return `W${start ?? end}`;
  return `W${start}–W${end}`;
};

/** The parts of a change, in a fixed order. Empty when nothing changed. */
export const describeChanges = (before: TaskFields, after: TaskFields, names: Names): string[] => {
  const parts: string[] = [];
  if (after.title !== before.title) parts.push(`renamed it to "${after.title}"`);
  if (after.projectId !== before.projectId) parts.push(`moved it to the ${names.project(after.projectId)} project`);
  if (after.workstream !== before.workstream) parts.push(`moved it to ${after.workstream}`);
  if (after.status !== before.status) parts.push(`moved it to ${STATUS_NAMES[after.status]}`);
  if (after.owner !== before.owner) {
    parts.push(after.owner ? `set the owner to ${names.member(after.owner)}` : 'removed the owner');
  }
  if (!sameList(after.helpers, before.helpers)) {
    parts.push(after.helpers.length ? `set the helpers to ${after.helpers.map(names.member).join(', ')}` : 'removed the helpers');
  }
  if (after.priority !== before.priority) parts.push(`changed the priority to ${after.priority}`);
  if (after.due !== before.due) parts.push(after.due ? `set the due date to ${shortDate(after.due)}` : 'removed the due date');
  if (after.startWeek !== before.startWeek || after.endWeek !== before.endWeek) {
    parts.push(`set the timeline to ${weeks(after.startWeek, after.endWeek)}`);
  }
  if (after.notes !== before.notes) parts.push('edited the notes');
  if (JSON.stringify(after.links) !== JSON.stringify(before.links)) parts.push('updated the links');
  return parts;
};

/** "a", "a and b", "a, b and c". */
export const joinParts = (parts: string[]): string =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
