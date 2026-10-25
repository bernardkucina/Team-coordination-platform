/**
 * Made-up teambuildings for the sandbox: a hub-wide "Teambuilding" series with four past evenings and everyone's
 * attendance, so the Teambuildings leaderboard and the series charts have data. The calendar has no teambuildings yet.
 *
 * Idempotent (upserts only), so it can run on a database that is already seeded:
 *   npm run db:seed:teambuildings -w backend
 * It also runs as part of `npm run db:seed` (including --if-empty on deploy).
 *
 * The calendar sync only removes *future* meetings that have no attendance, so these past ones stay.
 */
import type { AttendanceStatus } from '@prisma/client';
import { db } from '../core/db';
import { zonedToUtc } from '../core/clock';

export const TEAMBUILDING_SERIES = { id: 'teambuilding', name: 'Teambuilding' } as const;

/** Every other Friday evening in the sandbox weeks (W36–W43). */
export const TEAMBUILDINGS = [
  { date: '2026-09-04', title: 'Teambuilding: pikado in pizza', location: 'Hub' },
  { date: '2026-09-18', title: 'Teambuilding: pohod na Šmarno goro', location: 'Šmarna gora' },
  { date: '2026-10-02', title: 'Teambuilding: escape room', location: 'Escape Room Ljubljana' },
  { date: '2026-10-16', title: 'Teambuilding: večer družabnih iger', location: 'Hub' },
] as const;

/** Stable made-up status per member and evening: mostly there, some excused, a few no-shows. */
const statusFor = (memberId: string, index: number): AttendanceStatus => {
  let h = 7;
  for (const c of `${memberId}:${index}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = h % 20;
  if (r < 13) return 'present'; // 65 %
  if (r < 17) return 'excused'; // 20 %
  return 'missed'; // 15 %
};

export const seedTeambuildings = async (): Promise<{ meetings: number; records: number }> => {
  await db.meetingSeries.upsert({
    where: { id: TEAMBUILDING_SERIES.id },
    create: { ...TEAMBUILDING_SERIES, projectId: null },
    update: { name: TEAMBUILDING_SERIES.name },
  });

  const members = await db.member.findMany({ where: { active: true }, select: { id: true } });
  await db.seriesMember.createMany({
    data: members.map((m) => ({ seriesId: TEAMBUILDING_SERIES.id, memberId: m.id })),
    skipDuplicates: true,
  });

  let records = 0;
  for (const [i, t] of TEAMBUILDINGS.entries()) {
    const id = `${TEAMBUILDING_SERIES.id}-${t.date.replaceAll('-', '')}`;
    const data = {
      seriesId: TEAMBUILDING_SERIES.id, title: t.title, location: t.location,
      startsAt: zonedToUtc(t.date, '18:00'), endsAt: zonedToUtc(t.date, '21:00'), recorded: true,
    };
    await db.meeting.upsert({ where: { id }, create: { id, uid: `${id}@hub-pulse.sandbox`, ...data }, update: data });
    // Never overwrite attendance someone already recorded in the app.
    const res = await db.attendanceRecord.createMany({
      data: members.map((m) => ({ meetingId: id, memberId: m.id, status: statusFor(m.id, i), source: 'admin' as const })),
      skipDuplicates: true,
    });
    records += res.count;
  }
  return { meetings: TEAMBUILDINGS.length, records };
};

// Run directly: tsx src/seed/teambuildings.ts
if (process.argv[1]?.replaceAll('\\', '/').endsWith('seed/teambuildings.ts')) {
  seedTeambuildings()
    .then((r) => console.log(`Teambuildings: ${r.meetings} evenings, ${r.records} new attendance records`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
