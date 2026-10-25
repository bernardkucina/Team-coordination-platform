/** What the Slack messages say. Pure functions, so they are easy to test and to change. */

type Block = Record<string, unknown>;

const section = (text: string): Block => ({ type: 'section', text: { type: 'mrkdwn', text } });

const button = (text: string, actionId: string, value: string, style?: 'primary' | 'danger'): Block => ({
  type: 'button', text: { type: 'plain_text', text }, action_id: actionId, value, ...(style && { style }),
});

const linkButton = (text: string, url: string): Block => ({ type: 'button', text: { type: 'plain_text', text }, url, action_id: 'open_app' });

export const hoursText = (h: number): string => `${Math.round(h * 10) / 10} h`.replace('.', ',');

/** 10 minutes before a meeting. */
export const reminderMessage = (m: { meetingId: string; series: string; start: string }, appUrl: string) => {
  const text = `${m.series} starts at ${m.start}, in 10 minutes.`;
  return {
    text,
    blocks: [
      section(`:alarm_clock: *${m.series}* starts at *${m.start}*, in 10 minutes.`),
      { type: 'actions', elements: [
        button("I'm here", 'clockin_present', m.meetingId, 'primary'),
        button('Joining online', 'clockin_remote', m.meetingId),
        linkButton('Open Hub Pulse', `${appUrl}/today`),
      ] },
    ],
  };
};

/** When a meeting ends, to members who did not clock in. */
export const followupMessage = (m: { meetingId: string; series: string; when: string }) => {
  const text = `Did you attend ${m.series} (${m.when})?`;
  return {
    text,
    blocks: [
      section(`:wave: Did you attend *${m.series}* (${m.when})?`),
      { type: 'actions', elements: [
        button('In person', 'attend_present', m.meetingId, 'primary'),
        button('Online', 'attend_remote', m.meetingId),
        button("I didn't attend", 'attend_absent', m.meetingId),
      ] },
    ],
  };
};

/** The form that asks why someone could not come. */
export const reasonModal = (meta: { meetingId: string; responseUrl: string }, series: string) => ({
  type: 'modal',
  callback_id: 'absent_reason',
  private_metadata: JSON.stringify(meta),
  title: { type: 'plain_text', text: "Didn't attend" },
  submit: { type: 'plain_text', text: 'Send' },
  close: { type: 'plain_text', text: 'Cancel' },
  blocks: [
    section(`You missed *${series}*. Tell the admins why; it counts as excused.`),
    { type: 'input', block_id: 'reason', label: { type: 'plain_text', text: "Why couldn't you come?" }, element: { type: 'plain_text_input', action_id: 'value', multiline: true, max_length: 500 } },
  ],
});

export const doneMessage = (text: string) => ({ text, blocks: [section(text)] });

const ROLE_TEXT = { owner: 'the owner of', helper: 'a helper on', lead: 'the lead of' } as const;

/** Someone added you to a project or task. */
export const addedMessage = (a: { actor: string; role: keyof typeof ROLE_TEXT; project: string; task?: string }, appUrl: string) => {
  const what = a.task ? `*${a.task}* in *${a.project}*` : `*${a.project}*`;
  const text = `${a.actor} made you ${ROLE_TEXT[a.role]} ${a.task ? `${a.task} in ${a.project}` : a.project}.`;
  return {
    text,
    blocks: [
      section(`:sparkles: *${a.actor}* made you ${ROLE_TEXT[a.role]} ${what}.`),
      { type: 'actions', elements: [linkButton('Open the project', `${appUrl}/projects`)] },
    ],
  };
};

/** Daily, to a project lead: who logged hours on their projects yesterday. */
export const dailySummaryMessage = (day: string, projects: { name: string; rows: { name: string; hours: number }[] }[]) => {
  const parts = projects.map((p) => {
    const total = p.rows.reduce((a, r) => a + r.hours, 0);
    return `*${p.name}*: ${hoursText(total)}\n${p.rows.map((r) => `• ${r.name}: ${hoursText(r.hours)}`).join('\n')}`;
  });
  const text = `Hours logged on your projects on ${day}`;
  return { text, blocks: [section(`:bar_chart: *Hours logged on your projects on ${day}*`), ...parts.map(section)] };
};

export interface MonthlyNumbers {
  hours: number;
  commitment: number;
  byProject: { name: string; hours: number }[];
  hubHours: number;
  remoteHours: number;
  tasksDone: number;
  meetings: { attended: number; counted: number };
}

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)} %` : '–');

const numbersText = (n: MonthlyNumbers) => [
  `*Hours:* ${hoursText(n.hours)} of ${hoursText(n.commitment)} committed (${pct(n.hours, n.commitment)})`,
  `*Where:* ${hoursText(n.hubHours)} in the hub · ${hoursText(n.remoteHours)} remote`,
  `*Tasks finished:* ${n.tasksDone}`,
  `*Meetings:* ${n.meetings.attended} of ${n.meetings.counted} attended (${pct(n.meetings.attended, n.meetings.counted)})`,
  n.byProject.length ? `*By project:*\n${n.byProject.map((p) => `• ${p.name}: ${hoursText(p.hours)}`).join('\n')}` : '',
].filter(Boolean).join('\n');

/** On the 1st of the month: your numbers for last month (and the hub's, for admins). */
export const monthlyMessage = (month: string, mine: MonthlyNumbers, hub?: MonthlyNumbers & { members: number }) => {
  const text = `Your Hub Pulse report for ${month}`;
  return {
    text,
    blocks: [
      section(`:calendar: *Your report for ${month}*`),
      section(numbersText(mine)),
      ...(hub ? [section(`:office: *The hub in ${month}* (${hub.members} members)`), section(numbersText(hub))] : []),
    ],
  };
};
