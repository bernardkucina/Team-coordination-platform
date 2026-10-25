/**
 * slack service: optional notifications (the brief's extras). The core platform never depends on it:
 * without SLACK_BOT_TOKEN nothing is sent, and a Slack failure never fails a change.
 */
import { on } from '../../core/events';
import { getMember } from '../members';
import { listProjects, getTask } from '../tasks';
import { config } from '../../core/config';
import { slackEnabled } from './client';
import { addedMessage, missedMessage } from './blocks';
import { sendDm } from './users';
import { resyncMember, scheduleMeetingMessages } from './schedule';

export { slackRouter } from './routes';
export { scheduleMeetingMessages } from './schedule';
export { sendDailySummary, sendMonthlyReports } from './digests';
export { verifySlackSignature } from './interactions';

let registered = false;

/** Reacts to what happens in the other services. Called once when the app starts. */
export const registerSlackListeners = (): void => {
  if (registered) return;
  registered = true;

  on('project.memberAdded', async (e) => {
    if (!slackEnabled()) return;
    const [actor, project] = await Promise.all([getMember(e.actorId), listProjects().then((ps) => ps.find((p) => p.id === e.projectId))]);
    const task = e.taskId ? await getTask(e.taskId) : undefined;
    await sendDm(e.memberId, addedMessage({ actor: actor.name, role: e.role, project: project?.name ?? e.projectId, task: task?.title }, config.appUrl));
  });

  on('attendance.self', async (e) => {
    await resyncMember(e.meetingId, e.memberId);
  });

  on('attendance.missed', async (e) => {
    if (!slackEnabled()) return;
    const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
    await sendDm(e.memberId, missedMessage({ series: e.series, when: day(e.date), due: day(e.dueOn) }, config.appUrl));
  });

  on('calendar.synced', async () => {
    if (slackEnabled()) await scheduleMeetingMessages();
  });
};
