import type {
  AttendanceRecord, AttendanceStatus, HistoryEntry, Meeting, MeetingSeries, Member, Priority, Project, Task, TaskStatus, TimeEntry,
} from './types';
import { CURRENT_WEEK, dateInWeek, fridayOf, fromMin, toMin } from './time';

/* ---------- Members (names from the Academy Project Miro board) ---------- */

export const MEMBERS: Member[] = [
  { id: 'marko', name: 'Marko', initials: 'MR', tier: 'Shapers Core', isAdmin: true, since: 'Feb 2023', picked: 0, ideas: 1, pastWeeks: [72, 75, 70, 66, 74, 78, 71] },
  { id: 'nik', name: 'Nik', initials: 'NI', tier: 'Shapers Impact', isAdmin: false, since: 'Apr 2025', picked: 3, ideas: 1, pastWeeks: [11, 10, 12, 9.5, 10, 11, 10] },
  { id: 'taj', name: 'Taj', initials: 'TA', tier: 'Shapers Impact', isAdmin: false, since: 'Jan 2026', picked: 0, ideas: 1, pastWeeks: [10, 9, 11, 8, 7, 6, 5] },
  { id: 'sergej', name: 'Sergej', initials: 'SE', tier: 'ShapersGO', isAdmin: false, since: 'Apr 2025', picked: 2, ideas: 0, pastWeeks: [5, 4, 4, 3, 4.5, 4, 4] },
  { id: 'domen', name: 'Domen', initials: 'DO', tier: 'Shapers Impact', isAdmin: false, since: 'Oct 2025', picked: 2, ideas: 0, pastWeeks: [9, 10, 8, 7, 9, 8, 7] },
  { id: 'ivona', name: 'Ivona', initials: 'IV', tier: 'ShapersGO', isAdmin: false, since: 'Sep 2026', picked: 0, ideas: 0, pastWeeks: [4, 3.5, 4, 2, 3, 1.5, 0] },
  { id: 'olga', name: 'Olga', initials: 'OL', tier: 'Shapers Impact', isAdmin: false, since: 'Oct 2024', picked: 4, ideas: 3, pastWeeks: [10, 10, 9, 11, 10, 12, 10] },
  { id: 'maja', name: 'Maja', initials: 'MA', tier: 'Shapers Impact', isAdmin: false, since: 'Mar 2025', picked: 1, ideas: 1, pastWeeks: [9, 11, 10, 6.5, 10, 12, 8] },
  { id: 'ursa', name: 'Urša', initials: 'UR', tier: 'Shapers Core', isAdmin: false, since: 'Jun 2024', picked: 1, ideas: 0, pastWeeks: [68, 72, 70, 55, 64, 71, 58] },
];

export const MEMBER_DEMO_USER = 'maja';
export const ADMIN_DEMO_USER = 'marko';

/* ---------- Projects and workstreams ---------- */

export const PROJECTS: Project[] = [
  {
    id: 'academy',
    name: 'Academy Project',
    workstreams: [
      { name: 'Pravni vidik', color: '#CDE8A6', lead: 'maja', doneEarlier: 6 },
      { name: 'Partnerji', color: '#F5A3A3', lead: 'marko', doneEarlier: 9 },
      { name: 'Kandidati', color: '#8EDC9A', lead: 'taj', doneEarlier: 4 },
      { name: 'Marketing', color: '#8FB4F0', lead: 'olga', doneEarlier: 7 },
      { name: 'Testing, Matching, Onboarding & Legal', color: '#F7E38A', lead: 'maja', doneEarlier: 3 },
      { name: 'Mobilnost (EYE)', color: '#A6E3F2', lead: 'ivona', doneEarlier: 2 },
      { name: 'Program & Logistika', color: '#F6B27A', lead: 'ursa', doneEarlier: 5 },
      { name: 'Retro', color: '#F7F0A6', lead: 'marko', doneEarlier: 0 },
    ],
  },
  {
    id: 'ops',
    name: 'Hub Operations',
    workstreams: [
      { name: 'Community', color: '#C9B8F0', lead: 'marko', doneEarlier: 12 },
      { name: 'Finance', color: '#B8E0D2', lead: 'ursa', doneEarlier: 8 },
      { name: 'Comms', color: '#F5B8D9', lead: 'olga', doneEarlier: 15 },
    ],
  },
];

/* ---------- Tasks ---------- */

const STATUS_NAME: Record<TaskStatus, string> = {
  idea: 'Ideas', priority: 'Priority', progress: 'In progress', validation: 'Validation', done: 'Done',
};

const nameOf = (id: string): string => MEMBERS.find((m) => m.id === id)?.name ?? id;

const T = (
  id: number, projectId: string, title: string, workstream: string, status: TaskStatus, owner: string | null,
  start: number | null, end: number | null, priority: Priority = 'Medium', helpers: string[] = [],
): Task => {
  const history: HistoryEntry[] = [{ id: `${id}-1`, who: 'Marko', text: 'created this task', when: '12 Oct' }];
  if (owner) history.push({ id: `${id}-2`, who: 'Marko', text: `set the owner to ${nameOf(owner)}`, when: '13 Oct' });
  if (status === 'progress' || status === 'validation' || status === 'done') {
    history.push({ id: `${id}-3`, who: owner ? nameOf(owner) : 'Marko', text: `moved it to ${STATUS_NAME[status]}`, when: '20 Oct' });
  }
  return {
    id, projectId, title, workstream, status, owner, helpers, priority,
    startWeek: start, endWeek: end, due: end ? fridayOf(end) : null,
    notes: '', links: [], history: history.reverse(),
  };
};

const A = 'academy';
const TML = 'Testing, Matching, Onboarding & Legal';

export const TASKS: Task[] = [
  T(1, A, 'Spiši participant agreement contract', 'Pravni vidik', 'validation', 'marko', 41, 43, 'High', ['maja']),
  T(2, A, 'NDA: med nami in participantom', 'Pravni vidik', 'progress', 'maja', 43, 44, 'High'),
  T(3, A, 'NDA: participant in firma', 'Pravni vidik', 'progress', 'maja', 43, 44),
  T(4, A, 'Volunteer status', 'Pravni vidik', 'priority', 'ursa', 44, 45),
  T(5, A, 'Davčna optimizacija', 'Pravni vidik', 'idea', null, null, null, 'Low'),
  T(6, A, 'Close Preskok', 'Partnerji', 'done', 'marko', 41, 42),
  T(7, A, 'Close Gatom', 'Partnerji', 'progress', 'marko', 42, 44, 'High', ['nik']),
  T(8, A, 'Close Finančna neodvisnost', 'Partnerji', 'progress', 'nik', 43, 45),
  T(9, A, 'Lime booking: proposal za custom deal', 'Partnerji', 'progress', 'taj', 43, 45),
  T(10, A, 'Rimske terme: senior za sales', 'Partnerji', 'priority', null, 45, 46),
  T(11, A, 'Ciper: Finančna neodvisnost d.o.o.', 'Partnerji', 'idea', null, null, null, 'Low'),
  T(12, A, 'Masovno kontaktiranje shaperjev po svetu (regijsko)', 'Kandidati', 'priority', null, 44, 46, 'High'),
  T(13, A, 'Najdi lokalne job posting site', 'Kandidati', 'priority', 'sergej', 43, 44),
  T(14, A, 'Job post na Eures', 'Kandidati', 'progress', 'sergej', 43, 44),
  T(15, A, 'AIESEC ljudje: najdi in kontaktiraj na LinkedIn', 'Kandidati', 'progress', 'taj', 42, 45, 'Medium', ['nik']),
  T(16, A, 'Template za poste: academy prosta mesta', 'Kandidati', 'validation', 'sergej', 42, 43),
  T(17, A, 'Identificiranje potencialnih participantov', 'Kandidati', 'progress', 'nik', 42, 46),
  T(18, A, 'Grafika + slideshow', 'Marketing', 'progress', 'marko', 43, 44, 'Medium', ['olga']),
  T(19, A, 'Announcement podjetij', 'Marketing', 'progress', 'nik', 44, 45),
  T(20, A, 'LinkedIn helper kampanija: Preskok copy', 'Marketing', 'progress', 'olga', 43, 45),
  T(21, A, 'Plan za kasnejši marketing (različni kanali)', 'Marketing', 'idea', null, null, null, 'Low'),
  T(22, A, 'Piktalent: plačamo ja/ne', 'Marketing', 'priority', 'olga', 43, 44),
  T(23, A, 'Check the assessment tests', TML, 'progress', 'maja', 43, 44),
  T(24, A, 'Match', TML, 'priority', null, 46, 47),
  T(25, A, 'Vibe-check intervjuji pred podjetjem', TML, 'done', 'taj', 41, 42, 'Medium', ['marko', 'nik']),
  T(26, A, 'Onboarding proces: online?', TML, 'idea', null, null, null, 'Low'),
  T(27, A, '5.1 EYE process mapping', 'Mobilnost (EYE)', 'progress', 'ivona', 43, 45),
  T(28, A, '5.2 Finaliziraj host EYE application brief', 'Mobilnost (EYE)', 'validation', 'olga', 42, 43),
  T(29, A, '5.3 Obvesti udeležence o EYE zahtevah', 'Mobilnost (EYE)', 'priority', 'ivona', 45, 46),
  T(30, A, '5.4 Pripravi welcome package za incomers', 'Mobilnost (EYE)', 'priority', 'domen', 46, 47),
  T(31, A, '6.1 Finaliziraj 4-modularni kurikulum z Uršo', 'Program & Logistika', 'progress', 'maja', 41, 43, 'High', ['ursa']),
  T(32, A, 'Definiraj learning outcomes po modulu', 'Program & Logistika', 'progress', 'ursa', 43, 45),
  T(33, A, '6.2 Nastavi urnik treninga', 'Program & Logistika', 'priority', null, 47, 48),
  T(34, A, '6.3 Format oddaje case studyja za podjetja', 'Program & Logistika', 'validation', 'domen', 42, 44),
  T(35, A, 'Housing za udeležence: varščina', 'Program & Logistika', 'progress', 'domen', 44, 47),
  T(36, A, 'Drive urediti vsi skupaj', 'Retro', 'priority', null, 43, 44),
  T(37, A, 'Placement success rates', 'Retro', 'idea', null, null, null, 'Low'),
  T(38, A, 'Participant satisfaction surveys', 'Retro', 'idea', null, null, null, 'Low'),
  T(101, 'ops', 'Q4 member survey', 'Community', 'progress', 'maja', 42, 42, 'Low'),
  T(102, 'ops', 'Welcome pack za nove Shaperje', 'Community', 'priority', 'sergej', 44, 45),
  T(103, 'ops', 'Q4 budget review', 'Finance', 'progress', 'ursa', 43, 44, 'High'),
  T(104, 'ops', 'Instagram recap Hub Assembly', 'Comms', 'done', 'olga', 43, 43),
  T(105, 'ops', 'November newsletter', 'Comms', 'idea', null, null, null, 'Low'),
];

const nda = TASKS.find((t) => t.id === 2);
if (nda) {
  nda.notes = 'Use the template from the Preskok deal. Legal check with Urša before it goes out.';
  nda.links = [{ label: 'NDA template (Google Docs)', url: 'https://docs.google.com/' }];
  nda.history = [
    { id: '2-c', who: 'Urša', text: 'commented', when: 'yesterday', comment: 'Add the GDPR clause from the EYE brief.' },
    { id: '2-d', who: 'Maja', text: 'changed the deadline from 24 Oct to 30 Oct', when: '21 Oct' },
    ...nda.history,
  ];
}

/* ---------- Meetings (read from Google Calendar in the real app) ---------- */

const everyone = MEMBERS.map((m) => m.id);

export const SERIES: MeetingSeries[] = [
  { id: 'ha', name: 'Hub Assembly', projectId: null, invited: everyone },
  { id: 'lb', name: 'Leadership Board', projectId: null, invited: ['marko', 'ursa', 'olga'] },
  { id: 'aw', name: 'Academy Weekly', projectId: 'academy', invited: everyone },
  { id: 'pls', name: 'Project Leads Sync', projectId: null, invited: ['marko', 'maja', 'nik', 'ursa', 'olga'] },
  { id: 'oc', name: 'Onboarding Circle', projectId: null, invited: ['sergej', 'ivona', 'maja'] },
  { id: 'cs', name: 'Community Social', projectId: null, invited: everyone },
];

/** How reliably each person shows up per series (percent), used only to generate believable history. */
const SHOW_RATE: Record<string, Partial<Record<string, number>>> = {
  marko: { ha: 100, lb: 100, aw: 96, pls: 92, cs: 75 },
  maja: { ha: 88, aw: 75, pls: 92, oc: 100, cs: 50 },
  nik: { ha: 88, aw: 94, pls: 92, cs: 63 },
  taj: { ha: 63, aw: 69, cs: 38 },
  sergej: { ha: 88, aw: 81, oc: 88, cs: 75 },
  domen: { ha: 75, aw: 81, cs: 50 },
  ivona: { ha: 50, aw: 56, oc: 63, cs: 25 },
  olga: { ha: 100, lb: 94, aw: 88, pls: 83, cs: 63 },
  ursa: { ha: 88, lb: 88, aw: 88, pls: 92, cs: 38 },
};

const hash = (s: string): number => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100_003;
  return h;
};

const meeting = (seriesId: string, week: number, weekday: number, start: string, minutes: number, suffix = '', recorded = true): Meeting => ({
  id: `${seriesId}-${week}${suffix}`,
  seriesId,
  date: dateInWeek(week, weekday),
  start,
  end: fromMin(toMin(start) + minutes),
  recorded,
});

const pastMeetings: Meeting[] = [];
for (let w = 36; w < CURRENT_WEEK; w++) {
  pastMeetings.push(meeting('aw', w, 2, '12:30', 45, 'a'), meeting('aw', w, 4, '12:30', 45, 'b'), meeting('pls', w, 4, '09:00', 30));
  if (w % 2 === 1) pastMeetings.push(meeting('lb', w, 3, '19:00', 90), meeting('oc', w, 1, '18:00', 60));
}
pastMeetings.push(meeting('ha', 39, 0, '18:00', 120), meeting('cs', 38, 4, '18:00', 120));

export const MEETINGS: Meeting[] = [
  ...pastMeetings,
  meeting('ha', 43, 0, '18:00', 120),
  meeting('oc', 43, 1, '18:00', 60, '', false),
  meeting('aw', 43, 2, '12:30', 45, 'a', false),
  meeting('lb', 43, 3, '19:00', 90),
  meeting('pls', 43, 4, '09:00', 30, '', false),
  meeting('aw', 43, 4, '12:30', 45, 'b', false),
  meeting('cs', 43, 4, '18:00', 120, '', false),
  meeting('aw', 44, 2, '12:30', 45, 'a', false),
  meeting('aw', 44, 4, '12:30', 45, 'b', false),
  meeting('pls', 44, 4, '09:00', 30, '', false),
  meeting('lb', 45, 3, '19:00', 90, '', false),
];

const generated = (m: Meeting): AttendanceRecord[] => {
  const series = SERIES.find((s) => s.id === m.seriesId);
  if (!series) return [];
  return series.invited.map((memberId) => {
    const rate = SHOW_RATE[memberId]?.[m.seriesId] ?? 80;
    const roll = hash(memberId + m.id) % 100;
    let status: AttendanceStatus;
    if (roll < rate) status = roll % 5 === 0 ? 'remote' : 'present';
    else status = roll % 2 === 0 ? 'excused' : 'missed';
    return { meetingId: m.id, memberId, status, source: 'admin' };
  });
};

export const ATTENDANCE: AttendanceRecord[] = [
  ...MEETINGS.filter((m) => m.recorded).flatMap(generated),
  { meetingId: 'oc-43', memberId: 'sergej', status: 'present', source: 'self', at: '17:56' },
  { meetingId: 'aw-43a', memberId: 'maja', status: 'excused', source: 'admin' },
  { meetingId: 'aw-43a', memberId: 'olga', status: 'present', source: 'self', at: '12:28' },
  { meetingId: 'pls-43', memberId: 'maja', status: 'present', source: 'self', at: '08:57' },
  { meetingId: 'pls-43', memberId: 'nik', status: 'remote', source: 'self', at: '09:01' },
  { meetingId: 'pls-43', memberId: 'marko', status: 'present', source: 'admin' },
  { meetingId: 'pls-43', memberId: 'ursa', status: 'present', source: 'admin' },
  { meetingId: 'aw-43b', memberId: 'nik', status: 'present', source: 'self', at: '12:29' },
  { meetingId: 'aw-43b', memberId: 'olga', status: 'remote', source: 'self', at: '12:33' },
];

/* ---------- Time entries for the current week ---------- */

const WEEK_HOURS: Record<string, number> = { marko: 52, nik: 8, taj: 3.5, sergej: 4.5, domen: 6, ivona: 1, olga: 11, ursa: 38 };

const generatedEntries: TimeEntry[] = [];
let entryId = 100;
for (const [memberId, total] of Object.entries(WEEK_HOURS)) {
  const cap = total > 20 ? 11 : 3;
  let left = total;
  let day = 0;
  while (left > 0) {
    const chunk = Math.min(left, cap);
    const start = total > 20 ? 9 * 60 : 17 * 60;
    generatedEntries.push({
      id: entryId++, memberId, projectId: day % 2 ? 'ops' : 'academy', date: dateInWeek(CURRENT_WEEK, day % 5),
      start: fromMin(start), end: fromMin(start + Math.round(chunk * 60)), note: '', source: 'manual',
    });
    left -= chunk;
    day++;
  }
}

export const TIME_ENTRIES: TimeEntry[] = [
  { id: 1, memberId: 'maja', projectId: 'academy', date: dateInWeek(CURRENT_WEEK, 3), start: '18:00', end: '20:00', note: 'Kurikulum z Uršo', source: 'manual' },
  { id: 2, memberId: 'maja', projectId: 'academy', date: dateInWeek(CURRENT_WEEK, 2), start: '19:30', end: '21:00', note: 'NDA osnutek', source: 'manual' },
  { id: 3, memberId: 'maja', projectId: 'ops', date: dateInWeek(CURRENT_WEEK, 1), start: '17:00', end: '18:00', note: 'Member survey', source: 'manual' },
  { id: 4, memberId: 'maja', projectId: 'academy', date: dateInWeek(CURRENT_WEEK, 0), start: '16:00', end: '19:00', note: 'Assessment tests', source: 'manual' },
  ...generatedEntries,
];

/* ---------- Per-member project history for analytics (before this app existed) ---------- */

export interface PastProject {
  name: string;
  when: string;
  role: string;
  hours: number;
  tasks: number;
  active: boolean;
}

export const MAJA_PROJECTS: PastProject[] = [
  { name: 'Academy Project', when: 'Jun 2026 to now', role: 'Pravni vidik + Testing workstreams', hours: 118, tasks: 14, active: true },
  { name: 'Hub Operations', when: 'Mar 2025 to now', role: 'Community', hours: 98, tasks: 31, active: true },
  { name: 'Climate Talks 2026', when: 'Mar to Sep 2026', role: 'Speaker coordination', hours: 72, tasks: 21, active: false },
  { name: 'Mentorship Programme 2025', when: 'Mar to Jun 2025', role: 'Mentor matching', hours: 48, tasks: 15, active: false },
  { name: 'Fundraising Gala 2025', when: 'Sep to Dec 2025', role: 'Sponsorships', hours: 39, tasks: 11, active: false },
];
