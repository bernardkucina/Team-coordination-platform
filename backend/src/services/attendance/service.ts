import type { AttendanceRecord as DbRecord } from '@prisma/client';
import type { AttendanceRecord, AttendanceStatus, BulkAttendanceRequest, MeetingDetail } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { localParts, now } from '../../core/clock';
import { badRequest, forbidden } from '../../core/errors';
import type { SessionMember } from '../../core/auth';
import { getMeetingRow, getSeries, isInvited, setRecorded, toMeeting } from '../meetings';
import { canClockIn, canExcuse } from './rules';

export const toRecord = (r: DbRecord): AttendanceRecord => ({
  meetingId: r.meetingId,
  memberId: r.memberId,
  status: r.status,
  source: r.source,
  ...(r.clockedInAt ? { at: localParts(r.clockedInAt).time } : {}),
});

export const listRecords = async (filter: { meetingIds?: string[]; memberId?: string } = {}): Promise<AttendanceRecord[]> =>
  (
    await db.attendanceRecord.findMany({
      where: { ...(filter.meetingIds && { meetingId: { in: filter.meetingIds } }), ...(filter.memberId && { memberId: filter.memberId }) },
    })
  ).map(toRecord);

export const meetingDetail = async (meetingId: string): Promise<MeetingDetail> => {
  const meeting = await getMeetingRow(meetingId);
  return { meeting: toMeeting(meeting), series: await getSeries(meeting.seriesId), attendance: await listRecords({ meetingIds: [meetingId] }) };
};

/**
 * A member marks their own attendance: "I'm here" or "Remote" while clock-in is open,
 * or "can't come" (excused) before the meeting starts.
 */
export const markSelf = async (meetingId: string, member: SessionMember, status: 'present' | 'remote' | 'excused'): Promise<AttendanceRecord> => {
  const meeting = await getMeetingRow(meetingId);
  if (!(await isInvited(meeting, member.id))) throw forbidden('You are not invited to this meeting.');
  const at = now();
  if (status === 'excused' && !canExcuse(meeting, at)) throw badRequest('You can only say you cannot come before the meeting starts.');
  if (status !== 'excused' && !canClockIn(meeting, at)) throw badRequest('Clock-in is open from 10 minutes before the meeting until it ends.');

  const existing = await db.attendanceRecord.findUnique({ where: { meetingId_memberId: { meetingId, memberId: member.id } } });
  const clockedInAt = status === 'excused' ? null : (existing?.clockedInAt ?? at);
  const record = await db.attendanceRecord.upsert({
    where: { meetingId_memberId: { meetingId, memberId: member.id } },
    create: { meetingId, memberId: member.id, status, source: 'self', clockedInAt },
    update: { status, source: 'self', clockedInAt },
  });
  return toRecord(record);
};

/** An admin records or corrects a whole meeting at once. */
export const recordMeeting = async (meetingId: string, input: BulkAttendanceRequest): Promise<MeetingDetail> => {
  const meeting = await getMeetingRow(meetingId);
  const series = await getSeries(meeting.seriesId);
  const outsiders = input.records.filter((r) => !series.invited.includes(r.memberId)).map((r) => r.memberId);
  if (outsiders.length) throw badRequest('Some members are not invited to this meeting.', outsiders);

  await db.$transaction([
    ...input.records.map((r) =>
      db.attendanceRecord.upsert({
        where: { meetingId_memberId: { meetingId, memberId: r.memberId } },
        create: { meetingId, memberId: r.memberId, status: r.status, source: 'admin' },
        update: { status: r.status, source: 'admin' },
      }),
    ),
    ...(input.recorded !== undefined ? [setRecorded(meetingId, input.recorded)] : []),
  ]);
  return meetingDetail(meetingId);
};

/** "Mark the rest present": every invited member without a record becomes present. */
export const fillPresent = async (meetingId: string): Promise<MeetingDetail> => {
  const meeting = await getMeetingRow(meetingId);
  const series = await getSeries(meeting.seriesId);
  const marked = new Set((await listRecords({ meetingIds: [meetingId] })).map((r) => r.memberId));
  await db.attendanceRecord.createMany({
    data: series.invited.filter((id) => !marked.has(id)).map((memberId) => ({ meetingId, memberId, status: 'present' as AttendanceStatus, source: 'admin' as const })),
    skipDuplicates: true,
  });
  return meetingDetail(meetingId);
};

/** For the hours service: a meeting timer switches between in person and remote. */
export const setSelfMode = async (meetingId: string, memberId: string, mode: 'present' | 'remote'): Promise<void> => {
  await db.attendanceRecord.update({ where: { meetingId_memberId: { meetingId, memberId } }, data: { status: mode } });
};
