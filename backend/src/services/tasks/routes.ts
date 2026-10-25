import { Router } from 'express';
import { z } from 'zod';
import { me, requireAdmin } from '../../core/auth';
import { badRequest } from '../../core/errors';
import { id, isoDate, parse } from '../../core/validate';
import { AREA_IDS, type AreaId } from '@hub-pulse/shared';
import {
  addWorkstream, commentOnTask, createProject, createTask, getTask, joinProject, leaveProject, listProjects, listTasks, reorderTasks,
  setInterest, updateTask,
} from './service';

export const tasksRouter = Router();

const status = z.enum(['idea', 'priority', 'progress', 'validation', 'done']);
const priority = z.enum(['High', 'Medium', 'Low']);
const week = z.number().int().min(1).max(53).nullable();
const link = z.object({ label: z.string().trim().min(1).max(200), url: z.url().max(2000) });
const title = z.string().trim().min(1).max(300);
const area = z.enum(AREA_IDS as [AreaId, ...AreaId[]]);

/* ---------- projects ---------- */

tasksRouter.get('/projects', async (_req, res) => {
  res.json(await listProjects());
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(4000).optional(),
  lead: id.optional(),
  mainArea: area,
  areas: z.array(area).max(10).optional(),
  roles: z.array(z.object({ name: z.string().max(80), description: z.string().max(500) })).max(20).optional(),
  tags: z.array(z.string().max(80)).max(10).optional(),
  deadline: isoDate.nullable().optional(),
  tasks: z.array(z.object({ title, area: area.optional(), owner: id.nullable(), due: isoDate.nullable().optional() })).max(100).optional(),
});

tasksRouter.post('/projects', requireAdmin, async (req, res) => {
  res.status(201).json(await createProject(parse(createProjectSchema, req.body), me(req)));
});

tasksRouter.post('/projects/:id/workstreams', async (req, res) => {
  const body = parse(
    z.object({ area: area.optional(), name: z.string().trim().min(1).max(80).optional(), lead: id.optional() })
      .refine((b) => b.area || b.name, 'Choose an area.'),
    req.body,
  );
  res.status(201).json(await addWorkstream(String(req.params.id), body, me(req)));
});

/* Team and interest: each member for themselves. */

tasksRouter.post('/projects/:id/members', async (req, res) => {
  res.json(await joinProject(String(req.params.id), me(req)));
});

tasksRouter.delete('/projects/:id/members', async (req, res) => {
  res.json(await leaveProject(String(req.params.id), me(req)));
});

tasksRouter.post('/projects/:id/interest', async (req, res) => {
  res.json(await setInterest(String(req.params.id), true, me(req)));
});

tasksRouter.delete('/projects/:id/interest', async (req, res) => {
  res.json(await setInterest(String(req.params.id), false, me(req)));
});

/* ---------- tasks ---------- */

const taskId = (raw: unknown): number => {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw badRequest('Task id must be a positive number.');
  return n;
};

tasksRouter.get('/tasks', async (req, res) => {
  const query = parse(z.object({ projectId: id.optional(), mine: z.enum(['true', 'false']).optional() }), req.query);
  res.json(await listTasks({ projectId: query.projectId, ownerId: query.mine === 'true' ? me(req).id : undefined }));
});

/** Registered before /tasks/:id routes so "order" is never read as a task id. */
tasksRouter.put('/tasks/order', async (req, res) => {
  const { ids } = parse(z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }), req.body);
  await reorderTasks(ids);
  res.status(204).end();
});

tasksRouter.get('/tasks/:id', async (req, res) => {
  res.json(await getTask(taskId(req.params.id)));
});

const taskFields = {
  projectId: id,
  title,
  workstream: z.string().min(1),
  status,
  owner: id.nullable(),
  helpers: z.array(id).max(20),
  priority,
  startWeek: week,
  endWeek: week,
  due: isoDate.nullable(),
  notes: z.string().max(10_000),
  links: z.array(link).max(20),
};

const weeksInOrder = (t: { startWeek?: number | null; endWeek?: number | null }) =>
  t.startWeek == null || t.endWeek == null || t.startWeek <= t.endWeek;

const createTaskSchema = z
  .object(taskFields)
  .partial()
  .required({ projectId: true, title: true, workstream: true })
  .refine(weeksInOrder, 'startWeek must not be after endWeek.');

tasksRouter.post('/tasks', async (req, res) => {
  res.status(201).json(await createTask(parse(createTaskSchema, req.body), me(req)));
});

const updateTaskSchema = z.object(taskFields).partial().strict().refine(weeksInOrder, 'startWeek must not be after endWeek.');

tasksRouter.patch('/tasks/:id', async (req, res) => {
  res.json(await updateTask(taskId(req.params.id), parse(updateTaskSchema, req.body), me(req)));
});

tasksRouter.post('/tasks/:id/comments', async (req, res) => {
  const { text } = parse(z.object({ text: z.string().trim().min(1).max(5000) }), req.body);
  res.status(201).json(await commentOnTask(taskId(req.params.id), text, me(req)));
});
