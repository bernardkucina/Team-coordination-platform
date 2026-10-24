import { Router } from 'express';
import { z } from 'zod';
import { me, requireAdmin } from '../../core/auth';
import { badRequest } from '../../core/errors';
import { id, isoDate, parse } from '../../core/validate';
import {
  addWorkstream, commentOnTask, createProject, createTask, getTask, listProjects, listTasks, updateTask,
} from './service';

export const tasksRouter = Router();

const status = z.enum(['idea', 'priority', 'progress', 'validation', 'done']);
const priority = z.enum(['High', 'Medium', 'Low']);
const week = z.number().int().min(1).max(53).nullable();
const link = z.object({ label: z.string().trim().min(1).max(200), url: z.url().max(2000) });
const title = z.string().trim().min(1).max(300);

/* ---------- projects ---------- */

tasksRouter.get('/projects', async (_req, res) => {
  res.json(await listProjects());
});

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  lead: id.optional(),
  deadline: isoDate.nullable().optional(),
  neededRoles: z.array(z.string().max(60)).max(20).optional(),
  workstreams: z.array(z.string().max(80)).max(30).optional(),
  tasks: z.array(z.object({ title, workstream: z.string(), owner: id.nullable(), due: isoDate.nullable().optional() })).max(100).optional(),
});

tasksRouter.post('/projects', requireAdmin, async (req, res) => {
  res.status(201).json(await createProject(parse(createProjectSchema, req.body), me(req)));
});

tasksRouter.post('/projects/:id/workstreams', async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(1).max(80), lead: id.optional() }), req.body);
  res.status(201).json(await addWorkstream(String(req.params.id), body, me(req)));
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
