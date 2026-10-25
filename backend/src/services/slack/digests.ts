/** The daily summary for project leads and the monthly report for everyone. Read only. */
import { addDays, today, zonedToUtc } from '../../core/clock';
import { commitmentOf, listMembers } from '../members';
import { listProjects, taskOutcomes } from '../tasks';
import { listMeetingRows, listSeries } from '../meetings';
import { listRecords } from '../attendance';
import { listEntries } from '../hours';
import { slackEnabled } from './client';
import { dailySummaryMessage, monthlyMessage, type MonthlyNumbers } from './blocks';
import { sendDm } from './users';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const minutes = (e: { start: string; end: string }) => {
  const [sh, sm] = e.start.split(':').map(Number);
  const [eh, em] = e.end.split(':').map(Number);
  return eh * 60 + em - (sh * 60 + sm);
};
const round = (h: number) => Math.round(h * 100) / 100;

/** To every project lead: who logged hours on their projects on `day` (default yesterday). */
export const sendDailySummary = async (day = addDays(today(), -1)): Promise<{ day: string; sent: number }> => {
  if (!slackEnabled()) return { day, sent: 0 };
  const [entries, projects, members] = await Promise.all([listEntries({ from: day, to: day }), listProjects(), listMembers({ includeInactive: true })]);
  const name = (id: string) => members.find((m) => m.id === id)?.name ?? id;

  const byLead = new Map<string, { name: string; rows: { name: string; hours: number }[] }[]>();
  for (const p of projects) {
    if (!p.lead) continue;
    const perMember = new Map<string, number>();
    for (const e of entries.filter((x) => x.projectId === p.id)) perMember.set(e.memberId, (perMember.get(e.memberId) ?? 0) + minutes(e) / 60);
    if (!perMember.size) continue;
    const rows = [...perMember].map(([id, hours]) => ({ name: name(id), hours: round(hours) })).sort((a, b) => b.hours - a.hours);
    byLead.set(p.lead, [...(byLead.get(p.lead) ?? []), { name: p.name, rows }]);
  }

  const d = new Date(`${day}T12:00:00Z`);
  const label = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  let sent = 0;
  for (const [lead, list] of byLead) if (await sendDm(lead, dailySummaryMessage(label, list))) sent++;
  return { day, sent };
};

/** Last month's numbers to every member, plus the hub's numbers to admins. `month` is "YYYY-MM". */
export const sendMonthlyReports = async (month?: string): Promise<{ month: string; sent: number }> => {
  const thisMonthStart = `${today().slice(0, 7)}-01`;
  const first = month ? `${month}-01` : `${addDays(thisMonthStart, -1).slice(0, 7)}-01`;
  const nextFirst = (() => {
    const [y, m] = first.split('-').map(Number);
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  })();
  const last = addDays(nextFirst, -1);
  const label = `${MONTHS[Number(first.slice(5, 7)) - 1]} ${first.slice(0, 4)}`;
  if (!slackEnabled()) return { month: first.slice(0, 7), sent: 0 };

  const [members, entries, projects, tasks, meetings, series] = await Promise.all([
    listMembers(), listEntries({ from: first, to: last }), listProjects(), taskOutcomes(),
    listMeetingRows({ from: zonedToUtc(first), to: zonedToUtc(nextFirst) }), listSeries(),
  ]);
  const records = await listRecords({ meetingIds: meetings.map((m) => m.id) });
  const weeks = (Number(last.slice(8, 10))) / 7;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? id;
  const monthStart = zonedToUtc(first);
  const monthEnd = zonedToUtc(nextFirst);

  const numbersFor = (ids: string[]): MonthlyNumbers => {
    const mine = entries.filter((e) => ids.includes(e.memberId));
    const byProject = new Map<string, number>();
    for (const e of mine) byProject.set(e.projectId, (byProject.get(e.projectId) ?? 0) + minutes(e) / 60);
    let counted = 0;
    let attended = 0;
    for (const m of meetings.filter((x) => x.endsAt.getTime() <= Date.now())) {
      const invited = series.find((s) => s.id === m.seriesId)?.invited ?? [];
      for (const id of ids.filter((x) => invited.includes(x))) {
        const status = records.find((r) => r.meetingId === m.id && r.memberId === id)?.status;
        if (status === 'excused' || (!status && !m.recorded)) continue;
        counted++;
        if (status === 'present' || status === 'remote') attended++;
      }
    }
    return {
      hours: round(mine.reduce((a, e) => a + minutes(e), 0) / 60),
      commitment: round(members.filter((m) => ids.includes(m.id)).reduce((a, m) => a + commitmentOf(m.tier), 0) * weeks),
      byProject: [...byProject].map(([id, hours]) => ({ name: projectName(id), hours: round(hours) })).sort((a, b) => b.hours - a.hours),
      hubHours: round(mine.filter((e) => e.location === 'hub').reduce((a, e) => a + minutes(e), 0) / 60),
      remoteHours: round(mine.filter((e) => e.location === 'remote').reduce((a, e) => a + minutes(e), 0) / 60),
      tasksDone: tasks.filter((t) => t.ownerId && ids.includes(t.ownerId) && t.doneAt && t.doneAt >= monthStart && t.doneAt < monthEnd).length,
      meetings: { attended, counted },
    };
  };

  const hub = { ...numbersFor(members.map((m) => m.id)), members: members.length };
  let sent = 0;
  for (const m of members) {
    if (await sendDm(m.id, monthlyMessage(label, numbersFor([m.id]), m.isAdmin ? hub : undefined))) sent++;
  }
  return { month: first.slice(0, 7), sent };
};
