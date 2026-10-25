/**
 * Loads the sandbox package from /material into the database:
 *   roster.xlsx            → members and their meeting series
 *   meetings.ics           → meeting series and meetings (the same import the calendar sync will use)
 *   attendance flat.xlsx   → attendance; meetings before 2026-10-24 are marked recorded
 *   hours.xlsx             → weekly totals, spread over Monday–Friday as time entries
 * plus sample projects and tasks (sample-projects.ts).
 *
 * Usage: npm run db:seed               (empty database)
 *        npm run db:seed -- --reset    (wipes everything first)
 *        npm run db:seed -- --if-empty (does nothing when there is data; used on every deploy)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AttendanceStatus } from '@prisma/client';
import { areaById, type AreaId } from '@hub-pulse/shared';
import { db } from '../core/db';
import { addDays, isoWeek, toDbDate, weekdayOf, zonedToUtc } from '../core/clock';
import { memberIdFromEmail, tierFromRoster } from '../services/members';
import { importCalendarEvents, parseIcs } from '../services/meetings';
import { CREATED_TEXT, IDEA_CREATED_TEXT, slugify } from '../services/tasks';
import { readSheet, text, toIsoDate } from './xlsx';
import { SAMPLE_PROJECTS, SAMPLE_TASKS, type SampleTask } from './sample-projects';
import { seedTeambuildings } from './teambuildings';
import { seedDemoTasks } from './demo-tasks';

const MATERIAL = process.env.SEED_MATERIAL_DIR ?? resolve(fileURLToPath(import.meta.url), '../../../../material');
/** Attendance exists for every meeting before this date (SANDBOX.md). */
const ATTENDANCE_UNTIL = '2026-10-24';

const SHEET_STATES: Record<string, AttendanceStatus> = { present: 'present', remote: 'remote', excused: 'excused', unexcused: 'missed' };

const STATUS_NAMES = { idea: 'Ideas', priority: 'Priority', progress: 'In progress', validation: 'Validation', done: 'Done' } as const;

const wipe = async () => {
  // Children first.
  await db.$transaction([
    db.session.deleteMany(),
    db.slackMessage.deleteMany(),
    db.activeTimer.deleteMany(),
    db.attendanceRecord.deleteMany(),
    db.timeEntry.deleteMany(),
    db.taskEvent.deleteMany(),
    db.taskLink.deleteMany(),
    db.taskHelper.deleteMany(),
    db.task.deleteMany(),
    db.workstream.deleteMany(),
    db.projectMember.deleteMany(),
    db.projectInterest.deleteMany(),
    db.memberArea.deleteMany(),
    db.seriesMember.deleteMany(),
    db.meeting.deleteMany(),
    db.meetingSeries.deleteMany(),
    db.project.deleteMany(),
    db.member.deleteMany(),
  ]);
};

const seedMembers = async () => {
  const rows = await readSheet(resolve(MATERIAL, 'roster.xlsx'));
  const seriesOf = new Map<string, string[]>();
  for (const row of rows) {
    const email = text(row.email).toLowerCase();
    if (!email) continue;
    const id = memberIdFromEmail(email);
    await db.member.create({
      data: { id, email, name: text(row.name), tier: tierFromRoster(text(row.tier)), isAdmin: text(row.admin).toLowerCase() === 'yes' },
    });
    seriesOf.set(id, text(row.series).split(';').map((s) => s.trim()).filter(Boolean));
  }
  // Members of the Voice, Tech and Grants series count as members of those areas.
  const areaOfSeries: Record<string, AreaId> = { 'shapers-voice': 'voice', 'shapers-tech': 'tech', grants: 'money' };
  const areas = [...seriesOf].flatMap(([memberId, names]) =>
    names.map((n) => areaOfSeries[slugify(n)]).filter((areaId): areaId is AreaId => !!areaId).map((areaId) => ({ memberId, areaId })),
  );
  await db.memberArea.createMany({ data: areas, skipDuplicates: true });
  return seriesOf;
};

const seedMeetings = async (seriesOf: Map<string, string[]>) => {
  const result = await importCalendarEvents(parseIcs(readFileSync(resolve(MATERIAL, 'meetings.ics'), 'utf8')));
  const known = new Set((await db.meetingSeries.findMany({ select: { id: true } })).map((s) => s.id));
  const links = [...seriesOf].flatMap(([memberId, names]) =>
    names.map((n) => slugify(n)).filter((seriesId) => known.has(seriesId)).map((seriesId) => ({ seriesId, memberId })),
  );
  await db.seriesMember.createMany({ data: links, skipDuplicates: true });
  return result;
};

const seedAttendance = async () => {
  const rows = await readSheet(resolve(MATERIAL, 'attendance flat.xlsx'));
  const meetings = new Map((await db.meeting.findMany({ select: { id: true, startsAt: true } })).map((m) => [m.id, m]));
  const data = [];
  const missing = new Set<string>();
  for (const row of rows) {
    const meetingId = `${slugify(text(row.series))}-${toIsoDate(row.date).replaceAll('-', '')}`;
    if (!meetings.has(meetingId)) {
      missing.add(meetingId);
      continue;
    }
    const status = SHEET_STATES[text(row.state).toLowerCase()];
    if (!status) throw new Error(`Unknown attendance state "${text(row.state)}"`);
    data.push({ meetingId, memberId: memberIdFromEmail(text(row.email)), status, source: 'admin' as const });
  }
  await db.attendanceRecord.createMany({ data, skipDuplicates: true });
  await db.meeting.updateMany({ where: { startsAt: { lt: zonedToUtc(ATTENDANCE_UNTIL) } }, data: { recorded: true } });
  if (missing.size) console.warn(`  attendance rows for unknown meetings: ${[...missing].join(', ')}`);
  return data.length;
};

const seedProjects = async () => {
  // Projects are listed by createdAt, so space them a minute apart in the document's order.
  const base = zonedToUtc('2026-09-01', '09:00').getTime();
  for (const [i, p] of SAMPLE_PROJECTS.entries()) {
    await db.project.create({
      data: {
        id: p.id, number: p.number, name: p.name, status: p.status, mainArea: p.mainArea, tags: p.tags, tagline: p.tagline,
        description: p.description, roles: p.roles.map((r) => ({ ...r })), leadId: p.lead || null, createdAt: new Date(base + i * 60_000),
        workstreams: {
          create: p.rows.map((r, position) => ({
            name: areaById(r.area).name, color: areaById(r.area).color, leadId: r.lead, doneEarlier: r.doneEarlier, position,
          })),
        },
        members: { create: p.members.map((memberId) => ({ memberId })) },
        interested: { create: p.interested.map((memberId) => ({ memberId })) },
      },
    });
    await db.meetingSeries.updateMany({ where: { id: { in: p.series } }, data: { projectId: p.id } });
  }
};

/** The history a task would have if it had been worked on in the app. */
const eventsFor = (t: SampleTask, lead: string, nameOf: (id: string) => string) => {
  const at = (date: string, time: string) => zonedToUtc(date, time);
  const createdBy = t.createdBy ?? lead;
  const events: { actorId: string; kind: 'created' | 'updated' | 'picked' | 'comment'; text: string; comment?: string; createdAt: Date }[] = [
    { actorId: createdBy, kind: 'created', text: t.status === 'idea' ? IDEA_CREATED_TEXT : CREATED_TEXT, createdAt: at(t.created, '10:00') },
  ];
  if (t.owner) {
    const name = `set the owner to ${nameOf(t.owner)}`;
    events.push(
      t.picked
        ? { actorId: t.owner, kind: 'picked', text: name, createdAt: at(t.picked, '11:00') }
        : { actorId: lead, kind: 'updated', text: name, createdAt: at(t.created, '10:05') },
    );
  }
  const owner = t.owner ?? lead;
  if (t.started) events.push({ actorId: owner, kind: 'updated', text: `moved it to ${STATUS_NAMES.progress}`, createdAt: at(t.started, '18:00') });
  if (t.status === 'validation') {
    events.push({ actorId: owner, kind: 'updated', text: `moved it to ${STATUS_NAMES.validation}`, createdAt: at(addDays(t.started ?? t.created, 4), '19:00') });
  }
  if (t.done) events.push({ actorId: owner, kind: 'updated', text: `moved it to ${STATUS_NAMES.done}`, createdAt: at(t.done, '20:00') });
  for (const c of t.comments ?? []) {
    events.push({ actorId: c.by, kind: 'comment', text: 'commented', comment: c.text, createdAt: at(c.on, '17:30') });
  }
  return events;
};

const seedTasks = async () => {
  const names = new Map((await db.member.findMany({ select: { id: true, name: true } })).map((m) => [m.id, m.name]));
  const leads = new Map(SAMPLE_PROJECTS.map((p) => [p.id, p.lead]));
  for (const t of SAMPLE_TASKS) {
    const lead = leads.get(t.project)!;
    const events = eventsFor(t, lead, (id) => names.get(id) ?? id);
    await db.task.create({
      data: {
        projectId: t.project,
        workstream: areaById(t.area).name,
        title: t.title,
        status: t.status,
        ownerId: t.owner ?? null,
        createdById: t.createdBy ?? lead,
        priority: t.priority ?? 'Medium',
        startWeek: t.weeks?.[0] ?? null,
        endWeek: t.weeks?.[1] ?? null,
        due: t.due ? toDbDate(t.due) : null,
        doneAt: t.done ? zonedToUtc(t.done, '20:00') : null,
        createdAt: zonedToUtc(t.created, '10:00'),
        notes: t.notes ?? '',
        helpers: { create: (t.helpers ?? []).map((memberId) => ({ memberId })) },
        links: { create: (t.links ?? []).map((l, position) => ({ ...l, position })) },
        events: { create: events },
      },
    });
  }
  return SAMPLE_TASKS.length;
};

/** Spreads each weekly total over Monday–Friday (Saturday too for very long weeks). */
const seedHours = async () => {
  const rows = await readSheet(resolve(MATERIAL, 'hours.xlsx'));
  // Each member's hours go to the active projects they are on; Hub Operations for everyone else.
  const projectsOf = new Map<string, string[]>();
  for (const p of SAMPLE_PROJECTS) {
    if (p.status !== 'active' || p.id === 'ops') continue;
    for (const m of p.members) projectsOf.set(m, [...(projectsOf.get(m) ?? []), p.id]);
  }

  const data = [];
  for (const row of rows) {
    const memberId = memberIdFromEmail(text(row.email));
    const weekStart = toIsoDate(row.week_start);
    if (weekdayOf(weekStart) !== 0) throw new Error(`week_start ${weekStart} is not a Monday`);
    const minutes = Math.round(Number(row.hours) * 60);
    if (!minutes) continue;
    const days = minutes / 5 > 15 * 60 ? 6 : 5;
    const mine = projectsOf.get(memberId) ?? [];
    const projects = mine.length ? mine : ['ops'];
    let left = minutes;
    for (let d = 0; d < days && left > 0; d++) {
      const chunk = d === days - 1 ? left : Math.round(minutes / days);
      const start = chunk > 4 * 60 ? 8 * 60 : 17 * 60;
      data.push({
        memberId, projectId: projects[(d + isoWeek(weekStart)) % projects.length], date: toDbDate(addDays(weekStart, d)),
        startMin: start, endMin: Math.min(start + chunk, 24 * 60 - 1), note: 'Imported from the hours sheet', source: 'manual' as const,
        // The sheet has no location. Assign one so the hub/remote split has data: about one day in three remote.
        location: (d + memberId.length + isoWeek(weekStart)) % 3 === 0 ? ('remote' as const) : ('hub' as const),
      });
      left -= chunk;
    }
  }
  await db.timeEntry.createMany({ data });
  return { weeks: rows.length, entries: data.length, hours: Math.round(data.reduce((s, e) => s + e.endMin - e.startMin, 0) / 60) };
};

const main = async () => {
  const reset = process.argv.includes('--reset');
  if ((await db.member.count()) > 0) {
    if (process.argv.includes('--if-empty')) {
      // Made-up extras are idempotent, so existing databases get them too.
      const tb = await seedTeambuildings();
      const tasks = await seedDemoTasks();
      console.log(`The database already has data; not seeding. Added ${tb.records} teambuilding records, ${tasks} demo tasks.`);
      return;
    }
    if (!reset) {
      console.error('The database already has data. Run with --reset to wipe it and seed again.');
      process.exit(1);
    }
    await wipe();
  }

  console.log(`Seeding from ${MATERIAL}`);
  const seriesOf = await seedMembers();
  console.log(`  members: ${seriesOf.size}`);
  const meetings = await seedMeetings(seriesOf);
  console.log(`  series: ${meetings.series}, meetings: ${meetings.meetings}`);
  console.log(`  attendance records: ${await seedAttendance()}`);
  await seedProjects();
  console.log(`  projects: ${SAMPLE_PROJECTS.length}, tasks: ${await seedTasks()}`);
  const hours = await seedHours();
  console.log(`  hours: ${hours.weeks} weekly rows → ${hours.entries} entries, ${hours.hours} h`);
  const tb = await seedTeambuildings();
  console.log(`  teambuildings: ${tb.meetings} evenings, ${tb.records} attendance records`);
  console.log(`  demo tasks for this week: ${await seedDemoTasks()}`);
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
