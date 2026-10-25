/**
 * Made-up history for General tasks, so the analytics on the General tasks page have something to show:
 * - older no-shows (past the make-up window) that were made up: a done General task linked to the duty;
 * - a few General tasks people simply volunteered for and finished.
 * Spread over the last six weeks. Idempotent (a task with the same title is never created twice).
 * Runs after seedGeneralTasks, from db:seed and on backend start (app.ts).
 */
import { GENERAL_PROJECT, MAKEUP_DAYS, areaById } from '@hub-pulse/shared';
import { db } from '../core/db';
import { addDays, localParts, toDbDate, today, zonedToUtc } from '../core/clock';
import { CREATED_TEXT } from '../services/tasks';

const AREA = areaById('culture');
const ANA = 'ana-kovac';

const MADE_UP = [
  'Pospravi kuhinjo po Community večeru',
  'Uredi skupni koledar dogodkov',
  'Natisni plakate za Shape Talk',
  'Pripravi seznam prostovoljcev za dogodek',
  'Arhiviraj stare dokumente na Drivu',
  'Napiši zahvalo partnerjem po dogodku',
  'Posodobi vodič za nove člane',
];

const VOLUNTEERED: { title: string; owner: string; daysAgo: number }[] = [
  { title: 'Popravi Wi-Fi geslo na vratih huba', owner: 'luka-novak', daysAgo: 33 },
  { title: 'Kupi nove markerje za tablo', owner: 'nina-zupan', daysAgo: 26 },
  { title: 'Pripravi fotokotiček za dogodek', owner: 'eva-vidmar', daysAgo: 19 },
  { title: 'Uredi police s knjigami v hubu', owner: 'ziga-krajnc', daysAgo: 12 },
  { title: 'Posodobi seznam alergij za catering', owner: ANA, daysAgo: 6 },
  { title: 'Zamenjaj baterije v projektorju', owner: 'katja-lesjak', daysAgo: 2 },
];

const createDone = async (title: string, owner: string, ownerName: string, createdOn: string, doneOn: string) => {
  const created = zonedToUtc(createdOn, '10:00');
  const picked = zonedToUtc(addDays(createdOn, 1), '12:00');
  const done = zonedToUtc(doneOn, '19:00');
  return db.task.create({
    data: {
      projectId: GENERAL_PROJECT, workstream: AREA.name, title, status: 'done', priority: 'Low', ownerId: owner, createdById: ANA,
      due: toDbDate(addDays(createdOn, MAKEUP_DAYS)), doneAt: done, createdAt: created, notes: '',
      events: {
        create: [
          { actorId: ANA, kind: 'created', text: CREATED_TEXT, createdAt: created },
          { actorId: owner, kind: 'picked', text: `set the owner to ${ownerName}`, createdAt: picked },
          { actorId: owner, kind: 'updated', text: 'moved it to Done', createdAt: done },
        ],
      },
    },
    select: { id: true },
  });
};

export const seedGeneralHistory = async (): Promise<number> => {
  if (!(await db.project.findUnique({ where: { id: GENERAL_PROJECT }, select: { id: true } }))) return 0;
  const names = new Map((await db.member.findMany({ select: { id: true, name: true } })).map((m) => [m.id, m.name]));
  const now = today();
  let created = 0;

  // Older no-shows that were made up.
  const older = await db.attendanceRecord.findMany({
    where: {
      status: 'missed', makeup: null,
      meeting: { endsAt: { gte: zonedToUtc(addDays(now, -45)), lt: zonedToUtc(addDays(now, -MAKEUP_DAYS)) } },
    },
    select: { meetingId: true, memberId: true, meeting: { select: { endsAt: true } } },
    orderBy: { meeting: { startsAt: 'asc' } },
  });
  const usedMembers = new Set<string>();
  let i = 0;
  for (const r of older) {
    if (i >= MADE_UP.length) break;
    if (usedMembers.has(r.memberId)) continue;
    const title = MADE_UP[i++];
    usedMembers.add(r.memberId);
    if (await db.task.findFirst({ where: { projectId: GENERAL_PROJECT, title }, select: { id: true } })) continue;
    const ended = localParts(r.meeting.endsAt).date;
    const doneOn = addDays(ended, 3 + (i % 8));
    const task = await createDone(title, r.memberId, names.get(r.memberId) ?? r.memberId, ended, doneOn < now ? doneOn : now);
    await db.makeupDuty.create({ data: { meetingId: r.meetingId, memberId: r.memberId, dueOn: toDbDate(addDays(ended, MAKEUP_DAYS)), taskId: task.id } });
    created++;
  }

  // Volunteers.
  for (const v of VOLUNTEERED) {
    if (!names.has(v.owner)) continue;
    if (await db.task.findFirst({ where: { projectId: GENERAL_PROJECT, title: v.title }, select: { id: true } })) continue;
    const doneOn = addDays(now, -v.daysAgo);
    await createDone(v.title, v.owner, names.get(v.owner)!, addDays(doneOn, -4), doneOn);
    created++;
  }
  return created;
};
