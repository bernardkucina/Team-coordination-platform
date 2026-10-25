/**
 * Domain events: a service announces what happened, other services react. This keeps optional features
 * (Slack) out of the core services and avoids import cycles between services.
 *
 * Listeners run after the change is saved. Their errors are logged and never undo or fail the change.
 */

export interface DomainEvents {
  /** Someone (actor) made a member owner or helper of a task, or lead of a project. */
  'project.memberAdded': { memberId: string; actorId: string; projectId: string; taskId?: number; role: 'owner' | 'helper' | 'lead' };
  /** A member's own attendance changed: clocked in, said they can't come, took it back, or answered afterwards. */
  'attendance.self': { meetingId: string; memberId: string; status: 'present' | 'remote' | 'excused' | 'cleared' };
  /** A member missed a meeting and now owes a General task (make-up duty). */
  'attendance.missed': { meetingId: string; memberId: string; series: string; date: string; dueOn: string };
  /** The calendar copy changed (sync or seed). */
  'calendar.synced': Record<string, never>;
}

type Listener<K extends keyof DomainEvents> = (payload: DomainEvents[K]) => Promise<void> | void;

const listeners: { [K in keyof DomainEvents]?: Listener<K>[] } = {};

export const on = <K extends keyof DomainEvents>(event: K, listener: Listener<K>): void => {
  (listeners[event] ??= []).push(listener as never);
};

/** Runs every listener; waits for them (serverless functions may stop right after the response). */
export const emit = async <K extends keyof DomainEvents>(event: K, payload: DomainEvents[K]): Promise<void> => {
  for (const listener of (listeners[event] ?? []) as Listener<K>[]) {
    try {
      await listener(payload);
    } catch (err) {
      console.error(`[events] ${event} listener failed:`, err);
    }
  }
};
