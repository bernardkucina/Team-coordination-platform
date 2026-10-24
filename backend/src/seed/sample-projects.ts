/**
 * Sample projects and tasks. The sandbox package has none, so without these the task board and
 * "who finished what, and when" would be empty in the demo. Members match the roster and their series.
 */
import type { Priority, TaskStatus } from '@hub-pulse/shared';

export interface SampleProject {
  id: string;
  name: string;
  description: string;
  lead: string;
  workstreams: string[];
  /** Meeting series whose meeting time is logged on this project. */
  series: string[];
  created: string;
}

export interface SampleTask {
  project: string;
  workstream: string;
  title: string;
  status: TaskStatus;
  owner?: string;
  priority?: Priority;
  weeks?: [number, number];
  due?: string;
  helpers?: string[];
  /** Defaults to the project lead. */
  createdBy?: string;
  created: string;
  /** The owner took it themselves on this day (counts as initiative). */
  picked?: string;
  started?: string;
  done?: string;
}

export const SAMPLE_PROJECTS: SampleProject[] = [
  {
    id: 'ops', name: 'Hub Operations', description: 'Running the institute: community, finance and communication.',
    lead: 'ana-kovac', workstreams: ['Community', 'Finance', 'Comms'], series: ['shapers-tech', 'shapers-voice'], created: '2026-09-01',
  },
  {
    id: 'summer-school-2027', name: 'Summer School 2027', description: 'Programme, speakers, venue and participants for next summer.',
    lead: 'luka-novak', workstreams: ['Programme', 'Speakers', 'Logistics', 'Participants'], series: ['summer-school'], created: '2026-09-14',
  },
  {
    id: 'grant-applications', name: 'Grant applications', description: 'Erasmus+ and municipal grants for 2027.',
    lead: 'maja-horvat', workstreams: ['Research', 'Writing', 'Budget'], series: ['grants'], created: '2026-09-14',
  },
  {
    id: 'shape-talks-season', name: 'Shape Talks season', description: 'Monthly public talks, autumn and winter season.',
    lead: 'luka-novak', workstreams: ['Speakers', 'Venue & Production', 'Promotion'], series: ['shape-talks'], created: '2026-09-15',
  },
];

export const SAMPLE_TASKS: SampleTask[] = [
  // Summer School 2027
  { project: 'summer-school-2027', workstream: 'Programme', title: 'Draft the 2027 programme outline', status: 'done', owner: 'luka-novak', priority: 'High', weeks: [38, 40], helpers: ['maja-horvat'], created: '2026-09-14', started: '2026-09-16', done: '2026-10-01' },
  { project: 'summer-school-2027', workstream: 'Programme', title: 'Collect feedback from the 2026 participants', status: 'done', owner: 'tjasa-bozic', weeks: [38, 39], created: '2026-09-14', started: '2026-09-17', done: '2026-09-25' },
  { project: 'summer-school-2027', workstream: 'Programme', title: 'Pick three themes for 2027', status: 'validation', owner: 'maja-horvat', priority: 'High', weeks: [42, 44], created: '2026-10-05', started: '2026-10-12' },
  { project: 'summer-school-2027', workstream: 'Speakers', title: 'Long list of speakers', status: 'progress', owner: 'aljaz-hribar', weeks: [42, 45], created: '2026-10-05', started: '2026-10-14' },
  { project: 'summer-school-2027', workstream: 'Speakers', title: 'Write the speaker invitation email', status: 'priority', weeks: [44, 45], created: '2026-10-12' },
  { project: 'summer-school-2027', workstream: 'Logistics', title: 'Ask three venues for quotes', status: 'progress', owner: 'blaz-bizjak', priority: 'High', weeks: [43, 45], due: '2026-11-06', created: '2026-10-12', started: '2026-10-20' },
  { project: 'summer-school-2027', workstream: 'Logistics', title: 'Budget estimate for venue and catering', status: 'priority', owner: 'ziga-krajnc', weeks: [45, 46], created: '2026-10-12' },
  { project: 'summer-school-2027', workstream: 'Logistics', title: 'Book the room for the kick-off meeting', status: 'done', owner: 'luka-novak', weeks: [41, 42], created: '2026-10-02', started: '2026-10-06', done: '2026-10-16' },
  { project: 'summer-school-2027', workstream: 'Participants', title: 'Open the application form', status: 'priority', priority: 'Low', weeks: [46, 47], created: '2026-10-12' },
  { project: 'summer-school-2027', workstream: 'Participants', title: 'Alumni buddy for each participant', status: 'idea', createdBy: 'tjasa-bozic', created: '2026-10-13' },

  // Grant applications
  { project: 'grant-applications', workstream: 'Research', title: 'Map open EU youth grants for 2027', status: 'done', owner: 'eva-vidmar', priority: 'High', weeks: [38, 40], created: '2026-09-14', started: '2026-09-15', done: '2026-09-30' },
  { project: 'grant-applications', workstream: 'Research', title: 'Check eligibility for Erasmus+ KA1', status: 'done', owner: 'jan-potocnik', weeks: [40, 41], created: '2026-09-28', started: '2026-09-30', done: '2026-10-09' },
  { project: 'grant-applications', workstream: 'Writing', title: 'Draft the Erasmus+ project description', status: 'progress', owner: 'maja-horvat', priority: 'High', weeks: [42, 45], due: '2026-11-04', helpers: ['katja-lesjak'], created: '2026-10-09', started: '2026-10-13' },
  { project: 'grant-applications', workstream: 'Writing', title: 'Collect partner letters of support', status: 'priority', owner: 'katja-lesjak', priority: 'High', weeks: [43, 44], due: '2026-10-30', created: '2026-10-09' },
  { project: 'grant-applications', workstream: 'Budget', title: 'Build the grant budget sheet', status: 'validation', owner: 'filip-rozman', helpers: ['ana-kovac'], weeks: [42, 43], created: '2026-10-09', started: '2026-10-14' },
  { project: 'grant-applications', workstream: 'Budget', title: 'Get the co-financing confirmation', status: 'priority', owner: 'ana-kovac', priority: 'High', weeks: [45, 46], due: '2026-11-13', created: '2026-10-09' },
  { project: 'grant-applications', workstream: 'Writing', title: 'Proofread the municipal grant report', status: 'done', owner: 'eva-vidmar', priority: 'Low', weeks: [43, 43], created: '2026-10-16', picked: '2026-10-19', done: '2026-10-21' },
  { project: 'grant-applications', workstream: 'Research', title: "Apply to the city's youth fund in spring", status: 'idea', createdBy: 'filip-rozman', created: '2026-10-06' },

  // Shape Talks season
  { project: 'shape-talks-season', workstream: 'Speakers', title: 'Confirm the October speaker', status: 'done', owner: 'matic-kos', priority: 'High', weeks: [38, 40], created: '2026-09-15', started: '2026-09-16', done: '2026-10-02' },
  { project: 'shape-talks-season', workstream: 'Speakers', title: 'Confirm the November speaker', status: 'progress', owner: 'petra-jerman', priority: 'High', weeks: [42, 45], due: '2026-11-06', created: '2026-10-05', picked: '2026-10-06', started: '2026-10-13' },
  { project: 'shape-talks-season', workstream: 'Venue & Production', title: 'Test the streaming setup', status: 'done', owner: 'eva-vidmar', weeks: [41, 42], created: '2026-10-01', started: '2026-10-07', done: '2026-10-14' },
  { project: 'shape-talks-season', workstream: 'Promotion', title: 'Instagram posts for the November talk', status: 'priority', weeks: [44, 45], created: '2026-10-19' },
  { project: 'shape-talks-season', workstream: 'Promotion', title: 'Newsletter announcement', status: 'progress', owner: 'matic-kos', weeks: [43, 44], created: '2026-10-12', picked: '2026-10-15', started: '2026-10-19' },
  { project: 'shape-talks-season', workstream: 'Venue & Production', title: 'Book the room for December', status: 'priority', owner: 'jan-potocnik', priority: 'Low', weeks: [46, 47], created: '2026-10-19' },
  { project: 'shape-talks-season', workstream: 'Speakers', title: 'A talk on volunteering and burnout', status: 'idea', createdBy: 'petra-jerman', created: '2026-10-20' },
  { project: 'shape-talks-season', workstream: 'Speakers', title: 'Speaker swap with a neighbouring hub', status: 'idea', createdBy: 'petra-jerman', created: '2026-10-22' },

  // Hub Operations
  { project: 'ops', workstream: 'Community', title: 'Plan the November community evening', status: 'progress', owner: 'nina-zupan', weeks: [42, 45], created: '2026-10-05', picked: '2026-10-07', started: '2026-10-12' },
  { project: 'ops', workstream: 'Community', title: 'Welcome pack for new GO! members', status: 'done', owner: 'sara-mlakar', weeks: [40, 41], created: '2026-09-28', picked: '2026-10-01', done: '2026-10-08' },
  { project: 'ops', workstream: 'Finance', title: 'Reimburse September expenses', status: 'done', owner: 'ana-kovac', priority: 'High', weeks: [40, 41], created: '2026-09-30', started: '2026-10-01', done: '2026-10-05' },
  { project: 'ops', workstream: 'Comms', title: 'Update the team page on the website', status: 'priority', owner: 'rok-golob', priority: 'Low', weeks: [46, 47], due: '2026-11-20', created: '2026-10-14' },
  { project: 'ops', workstream: 'Comms', title: 'Write the Q3 activity report', status: 'priority', owner: 'zala-turk', weeks: [43, 44], created: '2026-10-14', picked: '2026-10-19' },
  { project: 'ops', workstream: 'Comms', title: 'Monthly member spotlight on LinkedIn', status: 'idea', createdBy: 'neza-oblak', created: '2026-10-12' },
  { project: 'ops', workstream: 'Community', title: 'A Slack channel for each meeting series', status: 'idea', createdBy: 'sara-mlakar', created: '2026-10-16' },
];
