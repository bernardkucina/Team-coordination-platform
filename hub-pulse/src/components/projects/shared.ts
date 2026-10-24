import type { Task, TaskStatus } from '@/lib/types';

export const STATUS_NAME: Record<TaskStatus, string> = {
  priority: 'Priority', progress: 'In progress', validation: 'Validation', done: 'Done', idea: 'Ideas',
};

/** Board column order. Ideas sit last: least important. */
export const BOARD_COLUMNS: TaskStatus[] = ['priority', 'progress', 'validation', 'done', 'idea'];

export type DragMode = 'move' | 'resize';

export interface DragState {
  taskId: number;
  mode: DragMode;
}

export type ChangeTask = (task: Task, patch: Partial<Task>, text: string) => void;

export const isMine = (t: Task, me: string): boolean => t.owner === me || t.helpers.includes(me);
