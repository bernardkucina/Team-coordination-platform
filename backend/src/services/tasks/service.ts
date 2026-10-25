import type { TaskEventKind } from '@prisma/client';
import {
  areaById, type AddWorkstreamRequest, type AreaId, type CreateProjectRequest, type CreateTaskRequest, type Project, type Task,
  type UpdateTaskRequest,
} from '@hub-pulse/shared';
import { db } from '../../core/db';
import { now, toDbDate } from '../../core/clock';
import { badRequest, conflict, forbidden, notFound } from '../../core/errors';
import type { SessionMember } from '../../core/auth';
import { assertMembersExist } from '../members';
import { emit } from '../../core/events';
import {
  CREATED_TEXT, CREATED_WITH_PROJECT_TEXT, IDEA_CREATED_TEXT, describeChanges, joinParts, type TaskFields,
} from './history';
import { WORKSTREAM_COLORS, projectInclude, slugify, taskInclude, toProject, toTask, type DbTask } from './mapping';

/* ---------- projects ---------- */

export const listProjects = async (): Promise<Project[]> =>
  (await db.project.findMany({ include: projectInclude, orderBy: { createdAt: 'asc' } })).map(toProject);

const uniqueProjectId = async (name: string): Promise<string> => {
  const base = slugify(name);
  const taken = new Set((await db.project.findMany({ where: { id: { startsWith: base } }, select: { id: true } })).map((p) => p.id));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
};

const loadProject = async (id: string) => {
  const project = await db.project.findUnique({ where: { id }, include: projectInclude });
  if (!project) throw notFound('Project');
  return project;
};

/**
 * An active project in one step. Its board rows are the main area plus the other areas that work on it;
 * the lead and every task owner join the team.
 */
export const createProject = async (input: CreateProjectRequest, actor: SessionMember): Promise<Project> => {
  const areaIds = [...new Set([input.mainArea, ...(input.areas ?? [])])];
  const rowOf = (area?: AreaId) => areaById(area && areaIds.includes(area) ? area : input.mainArea).name;
  const roles = (input.roles ?? []).map((r) => ({ name: r.name.trim(), description: r.description.trim() })).filter((r) => r.name);
  const tags = [...new Set((input.tags ?? []).map((t) => t.trim()).filter(Boolean))];
  const lead = input.lead || null;
  const owners = (input.tasks ?? []).map((t) => t.owner);
  await assertMembersExist([lead, ...owners]);
  const team = [...new Set([lead, ...owners].filter((x): x is string => !!x))];
  const id = await uniqueProjectId(input.name);

  await db.$transaction(async (tx) => {
    await tx.project.create({
      data: {
        id, name: input.name.trim(), description: input.description?.trim() ?? '', leadId: lead,
        deadline: input.deadline ? toDbDate(input.deadline) : null, mainArea: input.mainArea, roles, tags,
        workstreams: {
          create: areaIds.map((a, i) => ({ name: areaById(a).name, color: areaById(a).color, leadId: lead, position: i })),
        },
        members: { create: team.map((memberId) => ({ memberId })) },
      },
    });
    for (const t of input.tasks ?? []) {
      await tx.task.create({
        data: {
          projectId: id,
          title: t.title.trim(),
          workstream: rowOf(t.area),
          ownerId: t.owner,
          due: t.due ? toDbDate(t.due) : null,
          createdById: actor.id,
          events: { create: { actorId: actor.id, kind: 'created', text: CREATED_WITH_PROJECT_TEXT, createdAt: now() } },
        },
      });
    }
  });

  if (lead && lead !== actor.id) await emit('project.memberAdded', { memberId: lead, actorId: actor.id, projectId: id, role: 'lead' });
  for (const t of input.tasks ?? []) {
    if (t.owner && t.owner !== actor.id) await emit('project.memberAdded', { memberId: t.owner, actorId: actor.id, projectId: id, role: 'owner' });
  }
  return toProject(await db.project.findUniqueOrThrow({ where: { id }, include: projectInclude }));
};

/** Tells people someone else added them to a task. */
const announceAssignments = async (task: Task, actorId: string, before?: { owner: string | null; helpers: string[] }) => {
  if (task.owner && task.owner !== actorId && task.owner !== before?.owner) {
    await emit('project.memberAdded', { memberId: task.owner, actorId, projectId: task.projectId, taskId: task.id, role: 'owner' });
  }
  for (const h of task.helpers) {
    if (h !== actorId && !before?.helpers.includes(h)) {
      await emit('project.memberAdded', { memberId: h, actorId, projectId: task.projectId, taskId: task.id, role: 'helper' });
    }
  }
};

/** Admins and the project lead can add board rows: an area (its name and colour) or a free name. */
export const addWorkstream = async (projectId: string, input: AddWorkstreamRequest, actor: SessionMember): Promise<Project> => {
  const project = await loadProject(projectId);
  if (!actor.isAdmin && project.leadId !== actor.id) throw forbidden('Only admins and the project lead can add areas.');
  const area = input.area ? areaById(input.area) : undefined;
  const name = area?.name ?? input.name?.trim() ?? '';
  if (!name) throw badRequest('Choose an area.');
  if (project.workstreams.some((w) => w.name === name)) throw conflict(`${name} already works on this project.`);
  const lead = input.lead || actor.id;
  await assertMembersExist([lead]);
  await db.workstream.create({
    data: {
      projectId, name, leadId: lead, position: project.workstreams.length,
      color: area?.color ?? WORKSTREAM_COLORS[project.workstreams.length % WORKSTREAM_COLORS.length],
    },
  });
  return toProject(await loadProject(projectId));
};

/* ---------- project team and interest (each member for themselves) ---------- */

/** Hub Operations: where meeting time and hub work outside projects is logged. Not a real team. */
const OPS_PROJECT = 'ops';

export const joinProject = async (projectId: string, actor: SessionMember): Promise<Project> => {
  const project = await loadProject(projectId);
  if (project.status !== 'active') throw badRequest('This project has not started yet. Say you are interested instead.');
  await db.projectMember.upsert({
    where: { projectId_memberId: { projectId, memberId: actor.id } },
    create: { projectId, memberId: actor.id },
    update: {},
  });
  return toProject(await loadProject(projectId));
};

/** Everyone stays in at least one active project, so you can't leave your last one. */
export const leaveProject = async (projectId: string, actor: SessionMember): Promise<Project> => {
  await loadProject(projectId);
  const mine = await db.projectMember.findMany({
    where: { memberId: actor.id, project: { status: 'active', id: { not: OPS_PROJECT } } },
    select: { projectId: true },
  });
  if (!mine.some((m) => m.projectId === projectId)) return toProject(await loadProject(projectId));
  if (projectId !== OPS_PROJECT && mine.length <= 1) throw conflict("You can't leave your last project.");
  await db.projectMember.delete({ where: { projectId_memberId: { projectId, memberId: actor.id } } });
  return toProject(await loadProject(projectId));
};

export const setInterest = async (projectId: string, interested: boolean, actor: SessionMember): Promise<Project> => {
  const project = await loadProject(projectId);
  if (project.status !== 'planned') throw badRequest('Only planned projects take interest. Join the project instead.');
  if (interested) {
    await db.projectInterest.upsert({
      where: { projectId_memberId: { projectId, memberId: actor.id } },
      create: { projectId, memberId: actor.id },
      update: {},
    });
  } else {
    await db.projectInterest.deleteMany({ where: { projectId, memberId: actor.id } });
  }
  return toProject(await loadProject(projectId));
};

const assertWorkstream = async (projectId: string, workstream: string): Promise<void> => {
  const project = await db.project.findUnique({ where: { id: projectId }, include: { workstreams: { select: { name: true } } } });
  if (!project) throw badRequest('Unknown project.');
  if (!project.workstreams.some((w) => w.name === workstream)) {
    throw badRequest(`The project has no workstream called "${workstream}".`);
  }
};

/* ---------- tasks ---------- */

export const listTasks = async (filter: { projectId?: string; ownerId?: string } = {}): Promise<Task[]> => {
  const tasks = await db.task.findMany({
    where: {
      ...(filter.projectId && { projectId: filter.projectId }),
      ...(filter.ownerId && { OR: [{ ownerId: filter.ownerId }, { helpers: { some: { memberId: filter.ownerId } } }] }),
    },
    include: taskInclude,
    orderBy: [{ rank: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
  });
  return tasks.map(toTask);
};

/** A to-do list in its new order: rank = position. Ordering is not a change to the task, so no history. */
export const reorderTasks = async (ids: number[]): Promise<void> => {
  const unique = [...new Set(ids)];
  const found = await db.task.count({ where: { id: { in: unique } } });
  if (found !== unique.length) throw badRequest('Unknown task in the new order.');
  await db.$transaction(unique.map((id, rank) => db.task.update({ where: { id }, data: { rank } })));
};

const loadTask = async (id: number): Promise<DbTask> => {
  const task = await db.task.findUnique({ where: { id }, include: taskInclude });
  if (!task) throw notFound('Task');
  return task;
};

export const getTask = async (id: number): Promise<Task> => toTask(await loadTask(id));

export const createTask = async (input: CreateTaskRequest, actor: SessionMember): Promise<Task> => {
  await assertWorkstream(input.projectId, input.workstream);
  const helpers = [...new Set(input.helpers ?? [])].filter((h) => h !== input.owner);
  await assertMembersExist([input.owner, ...helpers]);
  const status = input.status ?? 'priority';

  const task = await db.task.create({
    data: {
      projectId: input.projectId,
      workstream: input.workstream,
      title: input.title.trim(),
      status,
      ownerId: input.owner ?? null,
      createdById: actor.id,
      priority: input.priority ?? 'Medium',
      startWeek: input.startWeek ?? null,
      endWeek: input.endWeek ?? null,
      due: input.due ? toDbDate(input.due) : null,
      notes: input.notes ?? '',
      doneAt: status === 'done' ? now() : null,
      helpers: { create: helpers.map((memberId) => ({ memberId })) },
      links: { create: (input.links ?? []).map((l, position) => ({ ...l, position })) },
      events: { create: { actorId: actor.id, kind: 'created', text: status === 'idea' ? IDEA_CREATED_TEXT : CREATED_TEXT, createdAt: now() } },
    },
    include: taskInclude,
  });
  const created = toTask(task);
  await announceAssignments(created, actor.id);
  return created;
};

const fieldsOf = (t: Task): TaskFields => ({
  projectId: t.projectId, workstream: t.workstream, title: t.title, status: t.status, owner: t.owner,
  helpers: t.helpers, priority: t.priority, startWeek: t.startWeek, endWeek: t.endWeek, due: t.due, notes: t.notes, links: t.links,
});

/**
 * Members can change anything on a task, including its owner (the brief: "hand it to someone").
 * The history is the safeguard: every change is written with who made it.
 */
export const updateTask = async (id: number, patch: UpdateTaskRequest, actor: SessionMember): Promise<Task> => {
  const current = toTask(await loadTask(id));
  const before = fieldsOf(current);
  const after: TaskFields = {
    ...before,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    title: patch.title?.trim() ?? before.title,
  };
  after.helpers = [...new Set(after.helpers)].filter((h) => h !== after.owner);

  if (after.projectId !== before.projectId || after.workstream !== before.workstream) {
    await assertWorkstream(after.projectId, after.workstream);
  }
  await assertMembersExist([after.owner !== before.owner ? after.owner : null, ...after.helpers.filter((h) => !before.helpers.includes(h))]);

  const memberNames = new Map((await db.member.findMany({ select: { id: true, name: true } })).map((m) => [m.id, m.name]));
  const projectNames = new Map((await db.project.findMany({ select: { id: true, name: true } })).map((p) => [p.id, p.name]));
  const parts = describeChanges(before, after, {
    member: (mid) => memberNames.get(mid) ?? mid,
    project: (pid) => projectNames.get(pid) ?? pid,
  });
  if (!parts.length) return current;

  const kind: TaskEventKind = before.owner === null && after.owner === actor.id ? 'picked' : 'updated';
  const doneAt = after.status === before.status ? undefined : after.status === 'done' ? now() : null;

  const task = await db.task.update({
    where: { id },
    data: {
      projectId: after.projectId,
      workstream: after.workstream,
      title: after.title,
      status: after.status,
      ownerId: after.owner,
      priority: after.priority,
      startWeek: after.startWeek,
      endWeek: after.endWeek,
      due: after.due ? toDbDate(after.due) : null,
      notes: after.notes,
      ...(doneAt !== undefined && { doneAt }),
      helpers: { deleteMany: {}, create: after.helpers.map((memberId) => ({ memberId })) },
      links: { deleteMany: {}, create: after.links.map((l, position) => ({ label: l.label, url: l.url, position })) },
      events: { create: { actorId: actor.id, kind, text: joinParts(parts), createdAt: now() } },
    },
    include: taskInclude,
  });
  const updated = toTask(task);
  await announceAssignments(updated, actor.id, { owner: before.owner, helpers: before.helpers });
  return updated;
};

export const commentOnTask = async (id: number, text: string, actor: SessionMember): Promise<Task> => {
  await loadTask(id);
  await db.taskEvent.create({ data: { taskId: id, actorId: actor.id, kind: 'comment', text: 'commented', comment: text.trim(), createdAt: now() } });
  return getTask(id);
};

/* ---------- numbers for analytics and member profiles ---------- */

/** Per member since a moment: tasks they picked up themselves, and ideas they added. */
export const initiativeSince = async (since: Date): Promise<Map<string, { picked: number; ideas: number }>> => {
  const events = await db.taskEvent.findMany({
    where: { createdAt: { gte: since }, actorId: { not: null }, OR: [{ kind: 'picked' }, { kind: 'created', text: IDEA_CREATED_TEXT }] },
    select: { actorId: true, kind: true },
  });
  const counts = new Map<string, { picked: number; ideas: number }>();
  for (const e of events) {
    const c = counts.get(e.actorId!) ?? { picked: 0, ideas: 0 };
    if (e.kind === 'picked') c.picked++;
    else c.ideas++;
    counts.set(e.actorId!, c);
  }
  return counts;
};

/** Owner, status and completion time of every task: enough for the per-member task numbers. */
export const taskOutcomes = () =>
  db.task.findMany({ select: { id: true, ownerId: true, status: true, doneAt: true } });
