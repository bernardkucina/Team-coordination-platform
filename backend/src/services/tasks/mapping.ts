import type { Prisma } from '@prisma/client';
import { AREA_IDS, type AreaId, type Project, type ProjectRole, type Task } from '@hub-pulse/shared';
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
  rank: t.rank,
});

export const projectInclude = {
  workstreams: { orderBy: { position: 'asc' } },
  members: { select: { memberId: true }, orderBy: { createdAt: 'asc' } },
  interested: { select: { memberId: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ProjectInclude;

export type DbProject = Prisma.ProjectGetPayload<{ include: typeof projectInclude }>;

export const isAreaId = (value: string): value is AreaId => (AREA_IDS as string[]).includes(value);

/** roles is stored as JSON; keep only well-formed entries. */
const rolesOf = (raw: Prisma.JsonValue): ProjectRole[] =>
  Array.isArray(raw)
    ? raw.flatMap((r) => (r && typeof r === 'object' && !Array.isArray(r) && typeof r.name === 'string'
      ? [{ name: r.name, description: typeof r.description === 'string' ? r.description : '' }] : []))
    : [];

export const toProject = (p: DbProject): Project => ({
  id: p.id,
  number: p.number,
  name: p.name,
  status: p.status,
  mainArea: isAreaId(p.mainArea) ? p.mainArea : 'strategy',
  tags: p.tags,
  tagline: p.tagline,
  description: p.description,
  roles: rolesOf(p.roles),
  lead: p.leadId ?? '',
  members: p.members.map((m) => m.memberId),
  interested: p.interested.map((m) => m.memberId),
  workstreams: p.workstreams.map((w) => ({ name: w.name, color: w.color, lead: w.leadId ?? '', doneEarlier: w.doneEarlier })),
  deadline: p.deadline ? fromDbDate(p.deadline) : null,
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
