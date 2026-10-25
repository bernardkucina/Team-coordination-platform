/**
 * General tasks: small jobs for the hub that anyone can pick, mainly to make up for a missed meeting.
 * They live in the `general` project, which the frontend shows as its own list (not on the board).
 * Also starts make-up duties for no-shows in the last MAKEUP_DAYS, without Slack messages.
 * Idempotent; runs from db:seed and on backend start (app.ts).
 */
import { GENERAL_PROJECT, MAKEUP_DAYS, areaById } from '@hub-pulse/shared';
import { db } from '../core/db';
import { addDays, now, toDbDate, today, zonedToUtc } from '../core/clock';
import { CREATED_TEXT } from '../services/tasks';
import { ensureMakeup } from '../services/attendance';

const ANA = 'ana-kovac';
const AREA = areaById('culture');

const GENERAL_TASKS = [
  'Pospravi skupni prostor v hubu po dogodku',
  'Uredi fotografije zadnjega dogodka na Drivu',
  'Napiši objavo za LinkedIn o zadnjem dogodku',
  'Posodobi seznam partnerjev in kontaktov',
  'Pripravi zapisnik naslednjega sestanka Community',
  'Preveri zaloge kave in pisarniškega materiala',
  'Prevedi opis projekta v angleščino',
  'Pomagaj pripraviti prostor za naslednji teambuilding',
];

export const seedGeneralTasks = async (): Promise<{ tasks: number; duties: number }> => {
  if (!(await db.member.findUnique({ where: { id: ANA }, select: { id: true } }))) return { tasks: 0, duties: 0 };
  await db.project.upsert({
    where: { id: GENERAL_PROJECT },
    create: {
      id: GENERAL_PROJECT, number: '', name: 'General tasks', status: 'active', mainArea: AREA.id, tags: [], roles: [],
      tagline: 'Manjša opravila za hub, ki jih lahko prevzame kdorkoli.',
      description: 'Kdor zamudi sestanek, v 14 dneh prevzame eno od teh opravil.',
      leadId: ANA, workstreams: { create: { name: AREA.name, color: AREA.color, leadId: ANA, doneEarlier: 0, position: 0 } },
    },
    update: {},
  });

  let tasks = 0;
  const created = zonedToUtc(addDays(today(), -5), '10:00');
  for (const title of GENERAL_TASKS) {
    if (await db.task.findFirst({ where: { projectId: GENERAL_PROJECT, title }, select: { id: true } })) continue;
    await db.task.create({
      data: {
        projectId: GENERAL_PROJECT, workstream: AREA.name, title, status: 'priority', priority: 'Low', createdById: ANA, notes: '',
        createdAt: created, events: { create: { actorId: ANA, kind: 'created', text: CREATED_TEXT, createdAt: created } },
      },
    });
    tasks++;
  }

  // No-shows in the last two weeks owe a General task (quietly: these happened before the feature existed).
  const since = toDbDate(addDays(today(), -MAKEUP_DAYS));
  const missed = await db.attendanceRecord.findMany({
    where: { status: 'missed', makeup: null, meeting: { endsAt: { gte: since, lte: now() } } },
    select: { meetingId: true, memberId: true },
  });
  for (const r of missed) await ensureMakeup(r.meetingId, r.memberId, false);
  return { tasks, duties: missed.length };
};
