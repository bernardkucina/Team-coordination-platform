/**
 * The gateway composes responses from several services, the way an API gateway would in front of
 * microservices. It holds no business rules of its own.
 */
import { Router } from 'express';
import type { AppData, Member, MeResponse } from '@hub-pulse/shared';
import { me } from '../core/auth';
import { localParts, now } from '../core/clock';
import { getMember, listMembers, toMember } from '../services/members';
import { listProjects, listTasks } from '../services/tasks';
import { listMeetingRows, listSeries, toMeeting } from '../services/meetings';
import { listRecords } from '../services/attendance';
import { getTimers, listEntries } from '../services/hours';
import { memberStats } from '../services/analytics';

export const gatewayRouter = Router();

const memberProfiles = async (): Promise<Member[]> => {
  const [members, stats] = await Promise.all([listMembers(), memberStats()]);
  return members.map((m) => toMember(m, stats.get(m.id)));
};

gatewayRouter.get('/me', async (req, res) => {
  const user = me(req);
  const [member, stats] = await Promise.all([getMember(user.id), memberStats()]);
  const body: MeResponse = { member: toMember(member, stats.get(user.id)), role: member.isAdmin ? 'admin' : 'member' };
  res.json(body);
});

gatewayRouter.get('/members', async (_req, res) => {
  res.json(await memberProfiles());
});

/** Everything the frontend store needs on load, in one request. */
gatewayRouter.get('/bootstrap', async (req, res) => {
  const user = me(req);
  const [members, projects, tasks, series, meetingRows, attendance, timeEntries, timers] = await Promise.all([
    memberProfiles(),
    listProjects(),
    listTasks(),
    listSeries(),
    listMeetingRows(),
    listRecords(),
    listEntries(user.isAdmin ? {} : { memberId: user.id }),
    getTimers(user.id),
  ]);
  const meProfile = members.find((m) => m.id === user.id) ?? toMember(await getMember(user.id));
  const body: AppData = {
    me: meProfile,
    role: user.isAdmin ? 'admin' : 'member',
    now: localParts(now()),
    members,
    projects,
    tasks,
    series,
    meetings: meetingRows.map(toMeeting),
    attendance,
    timeEntries,
    tracking: timers.tracking,
    workTimer: timers.workTimer,
  };
  res.json(body);
});
