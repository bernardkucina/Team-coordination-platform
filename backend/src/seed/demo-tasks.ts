/**
 * Made-up open tasks due this week, so "My tasks this week" on Today is never empty in the sandbox.
 * Ana (the demo admin) gets five; every other member of an active project gets one in that project.
 * Due dates are relative to the day this first runs. Idempotent: a task with the same project, title and owner
 * is never created twice, and nothing existing is changed. Runs from db:seed and on backend start (app.ts).
 */
import { areaById, type AreaId } from '@hub-pulse/shared';
import type { Priority, TaskStatus } from '@prisma/client';
import { db } from '../core/db';
import { addDays, isoWeek, localParts, now, toDbDate, zonedToUtc } from '../core/clock';
import { CREATED_TEXT } from '../services/tasks';
import { SAMPLE_PROJECTS } from './sample-projects';

interface DemoTask { project: string; area: AreaId; title: string; owner: string; status: TaskStatus; priority: Priority; dueIn: number; notes?: string }

const ANA = 'ana-kovac';

const ANA_TASKS: DemoTask[] = [
  { project: 'p06', area: 'finance', title: 'Zberi tri ponudbe za catering', owner: ANA, status: 'progress', priority: 'High', dueIn: 0, notes: 'Za 60 ljudi, vegetarijanska opcija obvezna.' },
  { project: 'academy', area: 'strategy', title: 'Pripravi agendo za sestanek s partnerji EYE', owner: ANA, status: 'priority', priority: 'High', dueIn: 1 },
  { project: 'p06', area: 'culture', title: 'Potrdi lokacijo za dogodek s partnerji', owner: ANA, status: 'progress', priority: 'Medium', dueIn: 2 },
  { project: 'academy', area: 'money', title: 'Pošlji vmesno poročilo Preskoku', owner: ANA, status: 'priority', priority: 'Medium', dueIn: 3 },
  { project: 'ops', area: 'strategy', title: 'Pregled ur in prisotnosti za oktober', owner: ANA, status: 'priority', priority: 'Low', dueIn: 4 },
];

/** One task for everyone else, cycled through these titles. */
const OTHER_TITLES = [
  'Pripravi povzetek zadnjega sestanka',
  'Posodobi seznam kontaktov',
  'Pripravi objavo za Instagram',
  'Preveri proračun za naslednji mesec',
  'Dogovori termin s partnerjem',
  'Uredi skupno mapo na Drivu',
  'Pripravi predlog za naslednji dogodek',
];

const otherTasks = (): DemoTask[] => {
  const tasks: DemoTask[] = [];
  const seen = new Set([ANA]);
  for (const p of SAMPLE_PROJECTS) {
    if (p.status !== 'active' || !p.rows.length) continue;
    for (const member of p.members) {
      if (seen.has(member)) continue;
      seen.add(member);
      const i = tasks.length;
      tasks.push({
        project: p.id, area: p.rows[i % p.rows.length].area, title: OTHER_TITLES[i % OTHER_TITLES.length], owner: member,
        status: i % 3 === 0 ? 'progress' : 'priority', priority: (['High', 'Medium', 'Low'] as const)[i % 3], dueIn: i % 5,
      });
    }
  }
  return tasks;
};

export const seedDemoTasks = async (): Promise<number> => {
  const today = localParts(now()).date;
  const members = new Set((await db.member.findMany({ select: { id: true } })).map((m) => m.id));
  const projects = new Set((await db.project.findMany({ select: { id: true } })).map((p) => p.id));
  let created = 0;
  for (const t of [...ANA_TASKS, ...otherTasks()]) {
    if (!members.has(t.owner) || !projects.has(t.project)) continue;
    const exists = await db.task.findFirst({ where: { projectId: t.project, title: t.title, ownerId: t.owner }, select: { id: true } });
    if (exists) continue;
    const due = addDays(today, t.dueIn);
    const lead = SAMPLE_PROJECTS.find((p) => p.id === t.project)?.lead || t.owner;
    await db.task.create({
      data: {
        projectId: t.project, workstream: areaById(t.area).name, title: t.title, status: t.status, priority: t.priority,
        ownerId: t.owner, createdById: lead, startWeek: isoWeek(today), endWeek: isoWeek(due), due: toDbDate(due), notes: t.notes ?? '',
        createdAt: zonedToUtc(addDays(today, -3), '10:00'),
        events: {
          create: [
            { actorId: lead, kind: 'created', text: CREATED_TEXT, createdAt: zonedToUtc(addDays(today, -3), '10:00') },
            ...(t.status === 'progress' ? [{ actorId: t.owner, kind: 'updated' as const, text: 'moved it to In progress', createdAt: zonedToUtc(addDays(today, -2), '18:00') }] : []),
          ],
        },
      },
    });
    created++;
  }
  return created;
};
