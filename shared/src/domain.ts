/**
 * The data model shared by the frontend and the backend.
 * Moved here from frontend/src/lib/types.ts so both sides compile against the same shapes.
 */

export type Role = 'member' | 'admin';

export type Tier = 'ShapersGO' | 'Shapers Impact' | 'Shapers Core';

export const TIER_HOURS: Record<Tier, number> = {
  ShapersGO: 4,
  'Shapers Impact': 10,
  'Shapers Core': 70,
};

export interface Member {
  id: string;
  name: string;
  initials: string;
  tier: Tier;
  isAdmin: boolean;
  since: string;
  /** Open tasks this member picked up themselves this month. */
  picked: number;
  /** Ideas this member added this month. */
  ideas: number;
  /** Hours for the 7 finished weeks before the current one, oldest first. */
  pastWeeks: number[];
  /** Of those hours, how many were logged in the hub (the rest remote or unknown). Same order. */
  pastWeeksHub: number[];
  /** Tasks this member owned that were finished in each of those weeks. Same order. */
  pastTasksDone: number[];
  /** Areas (oddelki) the member joined directly, besides their projects. */
  areas: AreaId[];
  /** Set by the API. */
  email?: string;
  /** Inactive members are hidden from pickers but keep their history. Set by the API. */
  active?: boolean;
}

/** The organisation's areas ("oddelki"). Every project has one main area; its board rows are areas. */
export type AreaId = 'strategy' | 'money' | 'finance' | 'voice' | 'recruiting' | 'culture' | 'tech';

export interface Area {
  id: AreaId;
  name: string;
  /** What the area takes care of. */
  about: string;
  /** What you do there. */
  work: string;
  color: string;
  /** Only Voice and Tech meet on their own so far. */
  active: boolean;
  /** Only Shapers Core members can join. */
  coreOnly: boolean;
}

export const AREAS: Area[] = [
  { id: 'strategy', name: 'Shapers Strategy', about: 'Kdo smo, kam gremo in kako merimo uspeh.', work: 'Sodeluješ pri postavljanju ciljev in pregledu, kako nam gre.', color: '#C9B8F0', active: false, coreOnly: true },
  { id: 'money', name: 'Shapers Money', about: 'Pridobivanje sredstev: razpisi, sponzorji, donatorji.', work: 'Spremljaš razpise, pomagaš pisati prijave in iščeš sponzorje.', color: '#8EDC9A', active: false, coreOnly: false },
  { id: 'finance', name: 'Shapers Finance', about: 'Proračuni projektov in pregled nad sredstvi.', work: 'Pomagaš pri proračunih projektov in vodenju evidenc.', color: '#B8E0D2', active: false, coreOnly: true },
  { id: 'voice', name: 'Shapers Voice', about: 'Kako nas vidi svet: družbena omrežja, mediji, PR.', work: 'Snemaš in montiraš reele, oblikuješ grafike in pišeš objave.', color: '#F5A3A3', active: true, coreOnly: false },
  { id: 'recruiting', name: 'Shapers Recruiting', about: 'Pridobivanje novih mladih, ki želijo več.', work: 'Pripravljaš kampanje za nove člane in pomagaš pri izboru.', color: '#F7E38A', active: false, coreOnly: false },
  { id: 'culture', name: 'Shapers Culture', about: 'Skupnost, pripadnost in aktivnost članov.', work: 'Pripravljaš teambuildinge in druženja ter pomagaš pri uvajanju novih članov.', color: '#F6B27A', active: false, coreOnly: false },
  { id: 'tech', name: 'Shapers Tech', about: 'Lastna orodja, programska oprema in interni procesi.', work: 'Z AI gradiš orodja (aplikacije, avtomatizacije, landerje) in urejaš spletno stran.', color: '#8FB4F0', active: true, coreOnly: false },
];

export const AREA_IDS = AREAS.map((a) => a.id) as AreaId[];

export const areaById = (id: AreaId): Area => AREAS.find((a) => a.id === id) ?? AREAS[0];

/** The area whose name is a board row's name, if any. */
export const areaByName = (name: string): Area | undefined => AREAS.find((a) => a.name === name);

export type TaskStatus = 'priority' | 'progress' | 'validation' | 'done' | 'idea';
export type Priority = 'High' | 'Medium' | 'Low';

export interface HistoryEntry {
  id: string;
  who: string;
  text: string;
  /** From the API: ISO timestamp. */
  when: string;
  comment?: string;
}

export interface TaskLink {
  label: string;
  url: string;
}

export interface Task {
  id: number;
  projectId: string;
  title: string;
  workstream: string;
  status: TaskStatus;
  /** Member id of the single owner, or null when nobody owns it yet. */
  owner: string | null;
  /** Other members working on it. */
  helpers: string[];
  priority: Priority;
  startWeek: number | null;
  endWeek: number | null;
  /** ISO date (YYYY-MM-DD). */
  due: string | null;
  notes: string;
  links: TaskLink[];
  /** Newest first. */
  history: HistoryEntry[];
  /** ISO timestamp of when the task was last moved to done. Set by the API. */
  doneAt?: string | null;
  /** Position in the project's to-do list once someone has reordered it (PUT /api/tasks/order). */
  rank?: number | null;
}

/** A board row inside a project. Rows are the areas that work on the project (name = area name). */
export interface Workstream {
  name: string;
  color: string;
  lead: string;
  doneEarlier: number;
}

/** A role people can take in a project, shown on the project card. */
export interface ProjectRole {
  name: string;
  description: string;
}

export type ProjectStatus = 'active' | 'planned';

export interface Project {
  id: string;
  /** "01" … "07" as in the projects document; empty for projects added later. */
  number: string;
  name: string;
  /** Planned projects have no board yet; members can say they are interested. */
  status: ProjectStatus;
  mainArea: AreaId;
  /** Short labels under the title. */
  tags: string[];
  /** One line for the overview card; empty = use the description. */
  tagline: string;
  description: string;
  roles: ProjectRole[];
  /** Member id of the project lead, or '' when there is none. */
  lead: string;
  /** Member ids in the project team (Join / Leave). */
  members: string[];
  /** Planned projects only: who said "I'm interested". */
  interested: string[];
  workstreams: Workstream[];
  /** ISO date the project should be finished by. */
  deadline: string | null;
}

/** Where work happened: in the hub (Impact Hub) or remotely. */
export type WorkLocation = 'hub' | 'remote';

/** A running "Track time" stopwatch for regular work (not a meeting). */
export interface WorkTimer {
  memberId: string;
  projectId: string;
  /** HH:MM */
  at: string;
  /** Epoch ms, for the live clock. */
  startedAt: number;
  location?: WorkLocation | null;
}

export interface TimeEntry {
  id: number;
  memberId: string;
  projectId: string;
  /** ISO date. */
  date: string;
  /** HH:MM */
  start: string;
  /** HH:MM */
  end: string;
  note: string;
  source: 'manual' | 'meeting';
  /** null for imported hours that did not record it. */
  location?: WorkLocation | null;
}

export type AttendanceStatus = 'present' | 'remote' | 'excused' | 'missed';

export interface MeetingSeries {
  id: string;
  name: string;
  /** null = hub-wide. */
  projectId: string | null;
  invited: string[];
}

export interface Meeting {
  id: string;
  seriesId: string;
  date: string;
  start: string;
  end: string;
  /** An admin confirmed the attendance list. */
  recorded: boolean;
  /** Google Meet link from the calendar event, when it has one. */
  meetUrl?: string;
}

/** The project that holds General tasks: small jobs anyone can pick, e.g. to make up for a missed meeting. */
export const GENERAL_PROJECT = 'general';

/** A member missed a meeting and owes one General task, picked by `dueOn`. */
export interface MakeupDuty {
  meetingId: string;
  memberId: string;
  /** YYYY-MM-DD. */
  dueOn: string;
  /** The General task they picked; null while it is still owed. */
  taskId: number | null;
}

/** Where this request comes from. Only on the Impact Hub wifi can members log time "in the hub". */
export interface HubNetwork {
  /** False when no hub wifi address is saved: then everyone may choose "in the hub". */
  checked: boolean;
  atHub: boolean;
  /** The address the server sees. */
  ip: string;
}

export interface AttendanceRecord {
  meetingId: string;
  memberId: string;
  status: AttendanceStatus;
  source: 'self' | 'admin';
  /** HH:MM clock-in time for self clock-ins. */
  at?: string;
  /** Why the member could not come. */
  reason?: string;
}

export interface Tracking {
  meetingId: string;
  memberId: string;
  mode: 'present' | 'remote';
  /** HH:MM */
  at: string;
  /** Epoch ms, for the live clock. */
  startedAt: number;
}
