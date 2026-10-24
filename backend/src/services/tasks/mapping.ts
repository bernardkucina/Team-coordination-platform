import type { Prisma } from '@prisma/client';
import type { Project, Task } from '@hub-pulse/shared';
import { fromDbDate } from '../../core/clock';

export const taskInclude = {
  helpers: { select: { memberId: true } },
  links: { orderBy: { position: 'asc' } },
  events: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { actor: { select: { name: true } } } },
} satisfies Prisma.TaskInclude;

export type DbTask = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export const toTask = (t: DbTask): Task => ({
  id: t.id,
  projectId: t.projectId,
  title: t.title,
  workstream: t.workstream,
  status: t.status,
  owner: t.ownerId,
  helpers: t.helpers.map((h) => h.memberId),
  priority: t.priority,
  startWeek: t.startWeek,
  endWeek: t.endWeek,
  due: t.due ? fromDbDate(t.due) : null,
  notes: t.notes,
  links: t.links.map((l) => ({ label: l.label, url: l.url })),
  history: t.events.map((e) => ({
    id: `e${e.id}`,
    who: e.actor?.name ?? 'Someone',
    text: e.text,
    when: e.createdAt.toISOString(),
    ...(e.comment ? { comment: e.comment } : {}),
  })),
  doneAt: t.doneAt ? t.doneAt.toISOString() : null,
});

export const projectInclude = { workstreams: { orderBy: { position: 'asc' } } } satisfies Prisma.ProjectInclude;

export type DbProject = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export const toProject = (p: DbProject): Project => ({
  id: p.id,
  name: p.name,
  description: p.description,
  lead: p.leadId ?? undefined,
  workstreams: p.workstreams.map((w) => ({ name: w.name, color: w.color, lead: w.leadId ?? '', doneEarlier: w.doneEarlier })),
  deadline: p.deadline ? fromDbDate(p.deadline) : null,
  neededRoles: p.neededRoles,
});

export const WORKSTREAM_COLORS = ['#D9C2F0', '#B8E0D2', '#F5B8D9', '#FFD6A5', '#BDE0FE', '#CDE8A6', '#F7E38A'];

/** "Summer School 2027" → "summer-school-2027". */
export const slugify = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
