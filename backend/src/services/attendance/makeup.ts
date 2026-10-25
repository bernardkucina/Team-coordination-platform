/**
 * Make-up duty: a member who missed a meeting owes one General task, picked within MAKEUP_DAYS.
 * It starts when an admin records them as missed, or when they answer "I didn't attend" themselves;
 * "can't come" before the meeting does not count. Recording them present again removes a duty not yet picked.
 */
import type { MakeupDuty as DbDuty } from '@prisma/client';
import { GENERAL_PROJECT, MAKEUP_DAYS, type MakeupDuty } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { addDays, fromDbDate, localParts, toDbDate } from '../../core/clock';
import { badRequest, conflict, notFound } from '../../core/errors';
import { emit } from '../../core/events';
import type { SessionMember } from '../../core/auth';
import { getMeetingRow, getSeries } from '../meetings';
import { getTask, updateTask } from '../tasks';

const toDuty = (d: DbDuty): MakeupDuty => ({ meetingId: d.meetingId, memberId: d.memberId, dueOn: fromDbDate(d.dueOn), taskId: d.taskId });

export const listMakeups = async (memberId?: string): Promise<MakeupDuty[]> =>
  (await db.makeupDuty.findMany({ where: memberId ? { memberId } : {}, orderBy: { dueOn: 'asc' } })).map(toDuty);

/** Starts a duty unless there is one already; announces it (Slack) only when it is new. */
export const ensureMakeup = async (meetingId: string, memberId: string, announce = true): Promise<void> => {
  if (await db.makeupDuty.findUnique({ where: { meetingId_memberId: { meetingId, memberId } } })) return;
  const meeting = await getMeetingRow(meetingId);
  const ended = localParts(meeting.endsAt);
  const dueOn = addDays(ended.date, MAKEUP_DAYS);
  await db.makeupDuty.create({ data: { meetingId, memberId, dueOn: toDbDate(dueOn) } });
  if (!announce) return;
  const series = await getSeries(meeting.seriesId);
  await emit('attendance.missed', { meetingId, memberId, series: series.name, date: localParts(meeting.startsAt).date, dueOn });
};

/** The member was there after all: forget a duty they have not picked a task for yet. */
export const dropMakeup = async (meetingId: string, memberId: string): Promise<void> => {
  await db.makeupDuty.deleteMany({ where: { meetingId, memberId, taskId: null } });
};

/** The member picks an open General task for a missed meeting and becomes its owner. */
export const takeMakeup = async (meetingId: string, actor: SessionMember, taskId: number): Promise<MakeupDuty> => {
  const duty = await db.makeupDuty.findUnique({ where: { meetingId_memberId: { meetingId, memberId: actor.id } } });
  if (!duty) throw notFound('You have no make-up task for this meeting.');
  if (duty.taskId) throw badRequest('You already picked a task for this meeting.');
  const task = await getTask(taskId);
  if (task.projectId !== GENERAL_PROJECT) throw badRequest('Pick one of the General tasks.');
  if (task.status === 'done') throw badRequest('That task is already done.');
  if (task.owner && task.owner !== actor.id) throw conflict('Someone already took that task.');
  await updateTask(taskId, { owner: actor.id, ...(task.due ? {} : { due: fromDbDate(duty.dueOn) }) }, actor);
  return toDuty(await db.makeupDuty.update({ where: { meetingId_memberId: { meetingId, memberId: actor.id } }, data: { taskId } }));
};
