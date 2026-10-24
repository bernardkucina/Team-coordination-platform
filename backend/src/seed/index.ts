/**
 * Loads the sandbox package from /material into the database:
 *   roster.xlsx            → members and their meeting series
 *   meetings.ics           → meeting series and meetings (the same import the calendar sync will use)
 *   attendance flat.xlsx   → attendance; meetings before 2026-10-24 are marked recorded
 *   hours.xlsx             → weekly totals, spread over Monday–Friday as time entries
 * plus sample projects and tasks (sample-projects.ts).
 *
 * Usage: npm run db:seed            (empty database)
 *        npm run db:seed -- --reset (wipes everything first)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AttendanceStatus } from '@prisma/client';
import { db } from '../core/db';
import { addDays, isoWeek, toDbDate, weekdayOf, zonedToUtc } from '../core/clock';
import { memberIdFromEmail, tierFromRoster } from '../services/members';
import { importCalendarEvents, parseIcs } from '../services/meetings';
import { CREATED_TEXT, IDEA_CREATED_TEXT, WORKSTREAM_COLORS, slugify } from '../services/tasks';
import { readSheet, text, toIsoDate } from './xlsx';
import { SAMPLE_PROJECTS, SAMPLE_TASKS, type SampleTask } from './sample-projects';

const MATERIAL = process.env.SEED_MATERIAL_DIR ?? resolve(fileURLToPath(import.meta.url), '../../../../material');
/** Attendance exists for every meeting before this date (SANDBOX.md). */
const ATTENDANCE_UNTIL = '2026-10-24';

const SHEET_STATES: Record<string, AttendanceStatus> = { present: 'present', remote: 'remote', excused: 'excused', unexcused: 'missed' };

const STATUS_NAMES = { idea: 'Ideas', priority: 'Priority', progress: 'In progress', validation: 'Validation', done: 'Done' } as const;

const wipe = async () => {
  // Children first.
  await db.$transaction([
    db.session.deleteMany(),
    db.activeTimer.deleteMany(),
    db.attendanceRecord.deleteMany(),
    db.timeEntry.deleteMany(),
    db.taskEvent.deleteMany(),
    db.taskLink.deleteMany(),
    db.taskHelper.deleteMany(),
    db.task.deleteMany(),
    db.workstream.deleteMany(),
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
  for (const p of SAMPLE_PROJECTS) {
    await db.project.create({
      data: {
        id: p.id, name: p.name, description: p.description, leadId: p.lead, createdAt: zonedToUtc(p.created, '09:00'),
        workstreams: { create: p.workstreams.map((name, i) => ({ name, color: WORKSTREAM_COLORS[i % WORKSTREAM_COLORS.length], leadId: p.lead, position: i })) },
      },
    });
    await db.meetingSeries.updateMany({ where: { id: { in: p.series } }, data: { projectId: p.id } });
  }
};

/** The history a task would have if it had been worked on in the app. */
const eventsFor = (t: SampleTask, lead: string, nameOf: (id: string) => string) => {
  const at = (date: string, time: string) => zonedToUtc(date, time);
  const createdBy = t.createdBy ?? lead;
  const events: { actorId: string; kind: 'created' | 'updated' | 'picked'; text: string; createdAt: Date }[] = [
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
        workstream: t.workstream,
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
        helpers: { create: (t.helpers ?? []).map((memberId) => ({ memberId })) },
        events: { create: events },
      },
    });
  }
  return SAMPLE_TASKS.length;
};

/** Spreads each weekly total over Monday–Friday (Saturday too for very long weeks). */
const seedHours = async () => {
  const rows = await readSheet(resolve(MATERIAL, 'hours.xlsx'));
  const series = await db.meetingSeries.findMany({ select: { id: true, projectId: true } });
  const projectOfSeries = new Map(series.map((s) => [s.id, s.projectId]));
  const memberSeries = await db.seriesMember.findMany();
  const projectsOf = new Map<string, string[]>();
  for (const sm of memberSeries) {
    const p = projectOfSeries.get(sm.seriesId);
    if (p && p !== 'ops') projectsOf.set(sm.memberId, [...(projectsOf.get(sm.memberId) ?? []), p]);
  }

  const data = [];
  for (const row of rows) {
    const memberId = memberIdFromEmail(text(row.email));
    const weekStart = toIsoDate(row.week_start);
    if (weekdayOf(weekStart) !== 0) throw new Error(`week_start ${weekStart} is not a Monday`);
    const minutes = Math.round(Number(row.hours) * 60);
    if (!minutes) continue;
    const days = minutes / 5 > 15 * 60 ? 6 : 5;
    const projects = [...(projectsOf.get(memberId) ?? []), 'ops'];
    let left = minutes;
    for (let d = 0; d < days && left > 0; d++) {
      const chunk = d === days - 1 ? left : Math.round(minutes / days);
      const start = chunk > 4 * 60 ? 8 * 60 : 17 * 60;
      data.push({
        memberId, projectId: projects[(d + isoWeek(weekStart)) % projects.length], date: toDbDate(addDays(weekStart, d)),
        startMin: start, endMin: Math.min(start + chunk, 24 * 60 - 1), note: 'Imported from the hours sheet', source: 'manual' as const,
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
};

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
