import sandboxJson from './sandbox.json';
import type {
  Area, AreaId, AttendanceRecord, AttendanceStatus, HistoryEntry, Meeting, MeetingSeries, Member, Priority, Project, Task,
  TaskStatus, Tier, TimeEntry, Workstream,
} from './types';
import { CURRENT_WEEK, DEMO_TODAY, dateInWeek, fridayOf, fromMin, toMin } from './time';
import { DEMO_NOW } from './rules';

/* ---------- Sandbox data (generated from ../material by scripts/import_sandbox.py) ---------- */

interface SandboxData {
  members: { id: string; name: string; email: string; initials: string; tier: Tier; isAdmin: boolean; series: string[]; pastWeeks: number[]; currentWeek: number }[];
  series: { id: string; name: string; invited: string[] }[];
  meetings: { id: string; seriesId: string; date: string; start: string; end: string }[];
  attendance: { meetingId: string; memberId: string; status: AttendanceStatus }[];
}

const sandbox = sandboxJson as SandboxData;

/* ---------- Areas (oddelki), from "PROJEKTI GS za Shapers GO" ---------- */

export const AREAS: Area[] = [
  { id: 'strategy', name: 'Shapers Strategy', about: 'Kdo smo, kam gremo in kako merimo uspeh.', work: 'Sodeluješ pri postavljanju ciljev in pregledu, kako nam gre.', color: '#C9B8F0', active: false, coreOnly: true },
  { id: 'money', name: 'Shapers Money', about: 'Pridobivanje sredstev: razpisi, sponzorji, donatorji.', work: 'Spremljaš razpise, pomagaš pisati prijave in iščeš sponzorje.', color: '#8EDC9A', active: false, coreOnly: false },
  { id: 'finance', name: 'Shapers Finance', about: 'Proračuni projektov in pregled nad sredstvi.', work: 'Pomagaš pri proračunih projektov in vodenju evidenc.', color: '#B8E0D2', active: false, coreOnly: true },
  { id: 'voice', name: 'Shapers Voice', about: 'Kako nas vidi svet: družbena omrežja, mediji, PR.', work: 'Snemaš in montiraš reele, oblikuješ grafike in pišeš objave.', color: '#F5A3A3', active: true, coreOnly: false },
  { id: 'recruiting', name: 'Shapers Recruiting', about: 'Pridobivanje novih mladih, ki želijo več.', work: 'Pripravljaš kampanje za nove člane in pomagaš pri izboru.', color: '#F7E38A', active: false, coreOnly: false },
  { id: 'culture', name: 'Shapers Culture', about: 'Skupnost, pripadnost in aktivnost članov.', work: 'Pripravljaš teambuildinge in druženja ter pomagaš pri uvajanju novih članov.', color: '#F6B27A', active: false, coreOnly: false },
  { id: 'tech', name: 'Shapers Tech', about: 'Lastna orodja, programska oprema in interni procesi.', work: 'Z AI gradiš orodja (aplikacije, avtomatizacije, landerje) in urejaš spletno stran.', color: '#8FB4F0', active: true, coreOnly: false },
];

export const areaById = (id: AreaId): Area => AREAS.find((a) => a.id === id) ?? AREAS[0];

/* ---------- Members: the 20 people from roster.xlsx ---------- */

const EXTRA: Record<string, { since: string; picked: number; ideas: number }> = {
  'ziga.krajnc': { since: 'Mar 2025', picked: 1, ideas: 1 },
  'nina.zupan': { since: 'Apr 2025', picked: 3, ideas: 1 },
  'rok.golob': { since: 'Oct 2025', picked: 2, ideas: 0 },
  'matic.kos': { since: 'Jan 2026', picked: 0, ideas: 2 },
  'sara.mlakar': { since: 'Oct 2024', picked: 2, ideas: 1 },
  'eva.vidmar': { since: 'Apr 2025', picked: 1, ideas: 0 },
  'zala.turk': { since: 'Sep 2026', picked: 2, ideas: 0 },
};

const SINCE_BY_TIER: Record<Tier, string> = { 'Shapers Core': 'Feb 2023', 'Shapers Impact': 'Sep 2025', ShapersGO: 'Sep 2026' };

/** Stable pseudo-random number in [0, 1) per string, so demo numbers don't change between reloads. */
const seeded = (s: string): number => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 100_003;
  return h / 100_003;
};

/**
 * The sandbox hours don't say where people worked, so for the demo each person gets a
 * typical share of hub time (35–85 %) that wobbles a little week to week.
 */
const hubShare = (memberId: string, week: number): number =>
  Math.min(1, Math.max(0, 0.35 + seeded(memberId) * 0.5 + (seeded(memberId + week) - 0.5) * 0.2));

const TASKS_PER_WEEK: Record<Tier, number> = { 'Shapers Core': 4, 'Shapers Impact': 2, ShapersGO: 1 };

export const MEMBERS: Member[] = sandbox.members.map((m) => ({
  id: m.id,
  name: m.name,
  email: m.email,
  initials: m.initials,
  tier: m.tier,
  isAdmin: m.isAdmin,
  since: EXTRA[m.id]?.since ?? SINCE_BY_TIER[m.tier],
  picked: EXTRA[m.id]?.picked ?? 0,
  ideas: EXTRA[m.id]?.ideas ?? 0,
  pastWeeks: m.pastWeeks,
  pastWeeksHub: m.pastWeeks.map((h, i) => Math.round(h * hubShare(m.id, i) * 2) / 2),
  pastTasksDone: m.pastWeeks.map((h, i) => (h === 0 ? 0 : Math.round(TASKS_PER_WEEK[m.tier] * (0.5 + seeded(m.id + 'tasks' + i))))),
  // Members of the Voice, Tech and Grants series count as members of those areas.
  areas: [
    ...(m.series.includes('shapers-voice') ? ['voice' as const] : []),
    ...(m.series.includes('shapers-tech') ? ['tech' as const] : []),
    ...(m.series.includes('grants') ? ['money' as const] : []),
  ],
}));

/** Demo logins from PLAN.md. */
export const MEMBER_DEMO_USER = 'ziga.krajnc';
export const ADMIN_DEMO_USER = 'ana.kovac';

const ANA = 'ana.kovac', LUKA = 'luka.novak', MAJA = 'maja.horvat', ZIGA = 'ziga.krajnc', NINA = 'nina.zupan', JAN = 'jan.potocnik';
const EVA = 'eva.vidmar', MATIC = 'matic.kos', SARA = 'sara.mlakar', ROK = 'rok.golob', ZALA = 'zala.turk', NEJC = 'nejc.kralj';
const TJASA = 'tjasa.bozic', ALJAZ = 'aljaz.hribar', PETRA = 'petra.jerman', BLAZ = 'blaz.bizjak', KATJA = 'katja.lesjak';
const URBAN = 'urban.petek', NEZA = 'neza.oblak', FILIP = 'filip.rozman';

/* ---------- Projects ---------- */

const rows = (lead: string, areas: AreaId[], doneEarlier: number[] = []): Workstream[] =>
  areas.map((id, i) => ({ name: areaById(id).name, color: areaById(id).color, lead, doneEarlier: doneEarlier[i] ?? 0 }));

const active = (p: Omit<Project, 'status' | 'interested'>): Project => ({ ...p, status: 'active', interested: [] });

const planned = (id: string, name: string, mainArea: AreaId, description: string, interested: string[] = []): Project => ({
  id, number: '', name, status: 'planned', mainArea, tags: [], description, roles: [], lead: '', members: [], interested, workstreams: [],
});

export const PROJECTS: Project[] = [
  active({
    id: 'p01', number: '01', name: 'Delavnice na srednjih šolah', mainArea: 'voice', tags: ['Družbeni učinek med dijaki', 'Sodelovanje s šolami'],
    description: 'Na srednjih šolah po Sloveniji, v okviru predmeta aktivno državljanstvo, izvajamo delavnice za dijake: delavnico divergentnega mišljenja, debato Shape Talk in delavnico o pametnejšem učenju z AI. Ob tem dijakom predstavimo tudi inštitut, naše iniciative in naš talent network.',
    roles: [
      { name: 'Izvajalec delavnice', description: 'V razredu vodiš delavnico ali debato z dijaki.' },
      { name: 'Stik s šolami', description: 'S profesorji se dogovoriš za termin in vrsto delavnice.' },
      { name: 'Priprava vsebine', description: 'Delavnico prilagodiš razredu in izbereš temo za debato.' },
      { name: 'Predstavitev inštituta', description: 'Dijakom poveš, kdo smo, in jih povabiš k sodelovanju.' },
    ],
    lead: MATIC, members: [MATIC, ZIGA, NEZA, PETRA], workstreams: rows(MATIC, ['voice', 'recruiting'], [3, 2]),
  }),
  active({
    id: 'p02', number: '02', name: 'Shape Talk', mainArea: 'voice', tags: ['Glas mladih v družbi', 'Skupnost okoli inštituta'],
    description: 'Shape Talk je moderirana debata za mlade o družbeno pomembnih temah, v kateri se udeleženci razdelijo na dve strani in izmenično argumentirajo. Debate pripravljamo kot večerne dogodke, okoli njih pa gradimo še aplikacijo za glasovanje in skupnost na Discordu ter pišemo povzetke na Substacku.',
    roles: [
      { name: 'Moderator', description: 'Vodiš debato, daješ besedo in skrbiš, da ostane spoštljiva.' },
      { name: 'Priprava trditev', description: 'Raziščeš temo in napišeš trditve, ki razdelijo dvorano.' },
      { name: 'Razvoj aplikacije', description: 'V aplikacijo za glasovanje dodaš novo funkcijo.' },
      { name: 'Skupnost na Discordu', description: 'Vsak teden objaviš vprašanje in spodbujaš pogovor.' },
    ],
    lead: LUKA, members: [LUKA, JAN, EVA, MATIC, PETRA], workstreams: rows(LUKA, ['voice', 'tech', 'culture'], [4, 2, 1]),
  }),
  active({
    id: 'p03', number: '03', name: 'Podjetniška/AI poletna šola', mainArea: 'recruiting', tags: ['Kultura in povezanost ekipe', 'Družbeni učinek'],
    description: 'Vsako poletje za mlade pripravimo brezplačno večdnevno podjetniško šolo z nočitvami. Udeleženci poslušajo predavanja, sodelujejo na delavnicah, v ekipah z mentorjem razvijejo podjetniško idejo in jo na koncu predstavijo žiriji.',
    roles: [
      { name: 'Program in predavatelji', description: 'Poiščeš predavatelje in sestaviš urnik šole.' },
      { name: 'Mentor ekipe', description: 'Ekipo vodiš od prve ideje do predstavitve pred žirijo.' },
      { name: 'Izbor udeležencev', description: 'Pregleduješ prijave in izbereš, kdo pride na šolo.' },
      { name: 'Logistika', description: 'Urediš lokacijo, prehrano, prevoz in prvo pomoč.' },
    ],
    lead: MAJA, members: [MAJA, LUKA, ZIGA, TJASA, ALJAZ, BLAZ], workstreams: rows(MAJA, ['recruiting', 'culture', 'money'], [5, 3, 1]),
  }),
  active({
    id: 'p04', number: '04', name: 'Mesečni dogodki', mainArea: 'voice', tags: ['Mreža strokovnjakov', 'Znanje za člane'],
    description: 'Vsak mesec pripravimo brezplačen dogodek za mlade in širšo javnost: predavanje ali moderiran pogovor z gostom iz podjetništva ali tehnologije, čemur sledijo vprašanja in mreženje. Za člane organiziramo še strokovne delavnice, na primer o AI in marketingu ali o projektnem vodenju.',
    roles: [
      { name: 'Iskanje gostov', description: 'Poiščeš zanimivega gosta ali strokovnjaka za interno delavnico in ga povabiš na dogodek.' },
      { name: 'Moderator pogovora', description: 'Pripraviš vprašanja in vodiš pogovor z gostom.' },
      { name: 'Organizacija na dogodku', description: 'Poskrbiš, da je prostor pripravljen, da mikrofoni in kamere delajo, ambient, odpiraš vrata zamudnikom.' },
      { name: 'Kratek video', description: 'Posnameš dogajanje in zmontiraš video za objavo.' },
    ],
    lead: NINA, members: [NINA, SARA, ROK, NEZA], workstreams: rows(NINA, ['voice', 'culture'], [6, 2]),
  }),
  active({
    id: 'p05', number: '05', name: 'AI delavnice', mainArea: 'money', tags: ['Znanje, ki ga šola ne da', 'Razvoj na področju AI'],
    description: 'Za mlade pripravljamo brezplačne vikend delavnice, kjer se naučijo vsega od promptinga in AI agentov do vibe codinga, na koncu pa se pomerijo na hekatonu. Tehnično podkovanim je namenjen še AI vikend z naprednimi agenti in hekatonom z nagradami. Planiramo izvajanje AI delavnic tudi za odrasle in podjetja.',
    roles: [
      { name: 'Predavatelj ali asistent', description: 'Razložiš sklop in udeležencem pomagaš pri vajah.' },
      { name: 'Promocija', description: 'Poskrbiš, da je na delavnici dovolj ljudi preko različnih načinov in kanalov.' },
      { name: 'Naloge za hekaton', description: 'Pripraviš izzive, ki jih udeleženci rešujejo na hekatonu.' },
      { name: 'Prijave', description: 'Urediš prijavnico, razporediš udeležence po terminih in jim pošlješ opomnik.' },
    ],
    lead: NINA, members: [NINA, ROK, ZALA, NEJC, URBAN], workstreams: rows(NINA, ['money', 'tech', 'voice'], [1, 4, 2]),
  }),
  active({
    id: 'p06', number: '06', name: 'Dogodek za Shaperje in partnerje', mainArea: 'culture', tags: ['Odnosi s partnerji', 'Skupnost in pripadnost'],
    description: 'Dvakrat na leto, decembra in junija, pripravimo dogodek, na katerem se srečajo Shaperji in partnerji inštituta. Partnerjem se zahvalimo za podporo in jim predstavimo, kaj smo naredili v zadnjem polletju, nato pa si vzamemo čas za druženje in nova poznanstva.',
    roles: [
      { name: 'Vabila partnerjem', description: 'Pripraviš seznam gostov in pošlješ osebna vabila. Po dogodku pa zahvale s fotografijami.' },
      { name: 'Predstavitev polletja', description: 'Zbereš dosežke projektov in jih predstaviš partnerjem.' },
      { name: 'Program večera', description: 'Vodiš večer in poskrbiš, da se gostje povežejo s Shaperji.' },
      { name: 'Organizacija', description: 'Prostor, finance, logistika, hrana, sponzorji.' },
    ],
    lead: ANA, members: [ANA, KATJA, FILIP], workstreams: rows(ANA, ['culture', 'money', 'finance'], [4, 1, 2]),
  }),
  active({
    id: 'p07', number: '07', name: 'Povezovanje talentov s podjetji', mainArea: 'money', tags: ['Sredstva za delovanje inštituta', 'Partnerstva s podjetji'],
    description: 'Podjetjem, ki iščejo mlad kader, svetujemo pri opredelitvi potreb in zanje poiščemo obetavne talente. Kandidate izbiramo iz naše mreže, ki jo gradimo na šolah, dogodkih in drugih projektih, in tako mladim odpiramo pot do priložnosti v podjetjih.',
    roles: [
      { name: 'Iskanje podjetij', description: 'Poiščeš podjetja, ki iščejo mlad kader, in jim predstaviš storitev.' },
      { name: 'Svetovanje podjetjem', description: 'S podjetjem opredeliš, kakšnega kandidata potrebuje.' },
      { name: 'Izbor kandidatov', description: 'Pregleduješ prijave in vodiš intervjuje s kandidati.' },
      { name: 'Mreža talentov', description: 'Ohranjaš stik z obetavnimi mladimi iz naših projektov.' },
    ],
    lead: MAJA, members: [MAJA, JAN, EVA, KATJA], workstreams: rows(MAJA, ['money', 'recruiting'], [3, 2]),
  }),
  active({
    id: 'academy', number: '', name: 'Academy Project', mainArea: 'recruiting', tags: ['Mobilnost (EYE)', 'Partnerji'],
    description: 'Akademija za mlade talente: kandidate pripravimo s programom in jih umestimo v podjetja. Taski so preneseni z Miro table.',
    roles: [
      { name: 'Partnerji', description: 'Outreach, closing in pogodbe s podjetji.' },
      { name: 'Kandidati', description: 'Iskanje in izbor udeležencev, job posti.' },
      { name: 'Mobilnost (EYE)', description: 'EYE proces, vize, status prostovoljca.' },
      { name: 'Program in logistika', description: 'Kurikulum, urnik, prostor in nastanitev.' },
    ],
    lead: ANA, members: [ANA, LUKA, MAJA, ZIGA, SARA, FILIP], workstreams: rows(ANA, ['strategy', 'money', 'recruiting', 'voice', 'culture'], [6, 9, 7, 7, 7]),
  }),
  planned('pl-inkubator', 'Inkubator', 'recruiting', 'Nadaljevanje poletne šole za ekipe, ki želijo idejo res izpeljati, z več dnevi dela z mentorji in stikom z investitorji.', [MAJA, TJASA]),
  planned('pl-hekatoni', 'Hekatoni na fakultetah in za podjetja', 'tech', 'Študenti rešujejo resnične izzive podjetij in rešitve z orodji AI in mentorstvom pripeljejo od ideje do prototipa.', [NEJC]),
  planned('pl-podjetja', 'Delavnice za podjetja in odrasle', 'money', 'Znanje iz AI delavnic prenesemo v podjetja in med odrasle, ki želijo AI uporabljati pri delu.'),
  planned('pl-sole', 'Nove šolske delavnice', 'voice', 'Finančna pismenost in podjetništvo za dijake.'),
  planned('pl-clash', 'Shape Clash', 'voice', 'Javno soočenje dveh znanih osebnosti z nasprotnima pogledoma na pomembno temo.', [MATIC, EVA]),
  planned('pl-cast', 'Shape Cast', 'voice', 'Podcast z gosti naših dogodkov, razrezan na kratke videe za družbena omrežja.', [NEZA]),
  planned('pl-book', 'Book club', 'culture', 'Bralni klub in skupna knjižnica za člane.'),
  planned('pl-prostovoljstvo', 'Prostovoljske akcije', 'culture', 'Akcije v lokalni skupnosti, na primer čiščenje okolja in pomoč starejšim.'),
];

/* ---------- Tasks ---------- */

const STATUS_NAME: Record<TaskStatus, string> = {
  idea: 'Ideas', priority: 'Priority', progress: 'In progress', validation: 'Validation', done: 'Done',
};

const nameOf = (id: string): string => MEMBERS.find((m) => m.id === id)?.name.split(' ')[0] ?? id;

const T = (
  id: number, projectId: string, title: string, area: AreaId, status: TaskStatus, owner: string | null,
  start: number | null, end: number | null, priority: Priority = 'Medium', helpers: string[] = [],
): Task => {
  const creator = nameOf(PROJECTS.find((p) => p.id === projectId)?.lead ?? ANA);
  const history: HistoryEntry[] = [{ id: `${id}-1`, who: creator, text: 'created this task', when: '12 Oct' }];
  if (owner) history.push({ id: `${id}-2`, who: creator, text: `set the owner to ${nameOf(owner)}`, when: '13 Oct' });
  if (status === 'progress' || status === 'validation' || status === 'done') {
    history.push({ id: `${id}-3`, who: owner ? nameOf(owner) : creator, text: `moved it to ${STATUS_NAME[status]}`, when: '20 Oct' });
  }
  return {
    id, projectId, title, workstream: areaById(area).name, status, owner, helpers, priority,
    startWeek: start, endWeek: end, due: end ? fridayOf(end) : null,
    doneAt: status === 'done' && end ? fridayOf(end) : null,
    notes: '', links: [], history: history.reverse(),
  };
};

const A = 'academy';

export const TASKS: Task[] = [
  // 01 Delavnice na srednjih šolah
  T(101, 'p01', 'Dogovor s profesorji za novembrske termine', 'recruiting', 'progress', MATIC, 43, 44, 'High'),
  T(102, 'p01', 'Prilagodi delavnico divergentnega mišljenja za 3. letnik', 'voice', 'progress', ZIGA, 43, 44),
  T(103, 'p01', 'Izberi temo za Shape Talk debato v razredu', 'voice', 'validation', PETRA, 42, 43),
  T(104, 'p01', 'Predstavitev inštituta: nov slide deck', 'voice', 'progress', NEZA, 43, 45, 'Medium', [ZIGA]),
  T(105, 'p01', 'Delavnica o učenju z AI na Gimnaziji Bežigrad', 'recruiting', 'done', MATIC, 41, 42),
  T(106, 'p01', 'Seznam šol za pomladni krog', 'recruiting', 'idea', null, null, null, 'Low'),
  // 02 Shape Talk
  T(201, 'p02', 'Trditve za novembrsko debato', 'voice', 'progress', EVA, 43, 44, 'High'),
  T(202, 'p02', 'Aplikacija za glasovanje: rezultati v živo', 'tech', 'progress', LUKA, 42, 45, 'Medium', [JAN]),
  T(203, 'p02', 'Tedensko vprašanje na Discordu', 'culture', 'priority', PETRA, 43, 43),
  T(204, 'p02', 'Povzetek oktobrske debate na Substacku', 'voice', 'validation', JAN, 42, 43),
  T(205, 'p02', 'Rezervacija dvorane za decembrsko debato', 'culture', 'priority', null, 44, 45),
  T(206, 'p02', 'Moderator za decembrsko debato', 'voice', 'idea', null, null, null, 'Low'),
  // 03 Podjetniška/AI poletna šola
  T(301, 'p03', 'Seznam predavateljev 2027', 'recruiting', 'progress', MAJA, 43, 46, 'Medium', [LUKA]),
  T(302, 'p03', 'Prijavnica za udeležence', 'recruiting', 'priority', TJASA, 44, 45),
  T(303, 'p03', 'Lokacija in nočitve: zberi ponudbe', 'culture', 'progress', ALJAZ, 43, 45),
  T(304, 'p03', 'Povabila mentorjem ekip', 'recruiting', 'priority', ZIGA, 44, 45),
  T(305, 'p03', 'Sponzor za prehrano', 'money', 'priority', BLAZ, 45, 47),
  T(306, 'p03', 'Retro poletne šole 2026', 'culture', 'done', MAJA, 41, 42),
  // 04 Mesečni dogodki
  T(401, 'p04', 'Gost za novembrsko predavanje', 'voice', 'progress', NINA, 43, 44, 'High'),
  T(402, 'p04', 'Vprašanja za moderiran pogovor', 'voice', 'priority', SARA, 44, 44),
  T(403, 'p04', 'Strokovna delavnica: AI in marketing', 'culture', 'priority', ROK, 45, 46),
  T(404, 'p04', 'Kratek video z oktobrskega dogodka', 'voice', 'validation', NEZA, 42, 43),
  T(405, 'p04', 'Preveri mikrofone in kamere', 'culture', 'done', ROK, 42, 42),
  // 05 AI delavnice
  T(501, 'p05', 'Naloge za hekaton', 'tech', 'progress', ZALA, 43, 45, 'Medium', [NEJC]),
  T(502, 'p05', 'Prijavnica in razporeditev po terminih', 'tech', 'priority', URBAN, 44, 44),
  T(503, 'p05', 'Promocija vikend delavnice', 'voice', 'progress', ROK, 43, 44),
  T(504, 'p05', 'Razpis za sofinanciranje AI delavnic', 'money', 'priority', null, 45, 47, 'High'),
  T(505, 'p05', 'Sklop AI agenti: predavanje', 'tech', 'validation', NEJC, 42, 43),
  T(506, 'p05', 'AI delavnice za podjetja', 'money', 'idea', null, null, null, 'Low'),
  // 06 Dogodek za Shaperje in partnerje
  T(601, 'p06', 'Seznam gostov in osebna vabila', 'culture', 'progress', KATJA, 43, 46),
  T(602, 'p06', 'Predstavitev polletja: zberi dosežke projektov', 'culture', 'priority', ANA, 46, 49),
  T(603, 'p06', 'Proračun decembrskega dogodka', 'finance', 'progress', FILIP, 43, 44, 'High'),
  T(604, 'p06', 'Sponzor za catering', 'money', 'priority', null, 45, 47),
  T(605, 'p06', 'Rezervacija prostora', 'culture', 'done', KATJA, 42, 42),
  // 07 Povezovanje talentov s podjetji
  T(701, 'p07', 'Seznam podjetij, ki iščejo mlad kader', 'money', 'progress', JAN, 43, 45),
  T(702, 'p07', 'Profil kandidata za prvo podjetje', 'money', 'priority', EVA, 44, 45),
  T(703, 'p07', 'Intervjuji s kandidati', 'recruiting', 'progress', MAJA, 43, 46, 'Medium', [EVA]),
  T(704, 'p07', 'Mreža talentov: kontakti s poletne šole', 'recruiting', 'priority', KATJA, 44, 46),
  T(705, 'p07', 'Ponudba storitve za podjetja', 'money', 'validation', JAN, 42, 43),
  // Academy Project (from the Miro board; workstreams mapped onto areas)
  T(1, A, 'Spiši participant agreement contract', 'strategy', 'validation', ANA, 41, 43, 'High', [MAJA]),
  T(2, A, 'NDA: med nami in participantom', 'strategy', 'progress', MAJA, 43, 44, 'High'),
  T(3, A, 'NDA: participant in firma', 'strategy', 'progress', MAJA, 43, 44),
  T(5, A, 'Davčna optimizacija', 'strategy', 'idea', null, null, null, 'Low'),
  T(6, A, 'Close Preskok', 'money', 'done', ANA, 41, 42),
  T(7, A, 'Close Gatom', 'money', 'progress', ANA, 42, 44, 'High', [LUKA]),
  T(8, A, 'Close Finančna neodvisnost', 'money', 'progress', LUKA, 43, 45),
  T(9, A, 'Lime booking: proposal za custom deal', 'money', 'progress', ZIGA, 43, 45),
  T(10, A, 'Rimske terme: senior za sales', 'money', 'priority', null, 45, 46),
  T(12, A, 'Masovno kontaktiranje shaperjev po svetu (regijsko)', 'recruiting', 'priority', null, 44, 46, 'High'),
  T(13, A, 'Najdi lokalne job posting site', 'recruiting', 'priority', FILIP, 43, 44),
  T(14, A, 'Job post na Eures', 'recruiting', 'progress', FILIP, 43, 44),
  T(15, A, 'AIESEC ljudje: najdi in kontaktiraj na LinkedIn', 'recruiting', 'progress', ZIGA, 42, 45, 'Medium', [LUKA]),
  T(16, A, 'Template za poste: academy prosta mesta', 'recruiting', 'validation', FILIP, 42, 43),
  T(18, A, 'Grafika + slideshow', 'voice', 'progress', ANA, 43, 44, 'Medium', [SARA]),
  T(20, A, 'LinkedIn helper kampanija: Preskok copy', 'voice', 'progress', SARA, 43, 45),
  T(21, A, 'Plan za kasnejši marketing (različni kanali)', 'voice', 'idea', null, null, null, 'Low'),
  T(23, A, 'Check the assessment tests', 'recruiting', 'progress', MAJA, 43, 44),
  T(25, A, 'Vibe-check intervjuji pred podjetjem', 'recruiting', 'done', ZIGA, 41, 42, 'Medium', [ANA, LUKA]),
  T(27, A, '5.1 EYE process mapping', 'culture', 'progress', ZIGA, 43, 45),
  T(28, A, '5.2 Finaliziraj host EYE application brief', 'culture', 'validation', SARA, 42, 43),
  T(31, A, '6.1 Finaliziraj 4-modularni kurikulum', 'culture', 'progress', MAJA, 41, 43, 'High'),
  T(35, A, 'Housing za udeležence: varščina', 'culture', 'progress', SARA, 44, 47),
  T(36, A, 'Drive urediti vsi skupaj', 'strategy', 'priority', null, 43, 44),
];

const nda = TASKS.find((t) => t.id === 2);
if (nda) {
  nda.notes = 'Use the template from the Preskok deal. Legal check with Ana before it goes out.';
  nda.links = [{ label: 'NDA template (Google Docs)', url: 'https://docs.google.com/' }];
  nda.history = [
    { id: '2-c', who: 'Ana', text: 'commented', when: 'yesterday', comment: 'Add the GDPR clause from the EYE brief.' },
    ...nda.history,
  ];
}

/* ---------- Meetings and attendance: meetings.ics + attendance flat.xlsx ---------- */

/** Series that belong to one project; the rest are hub-wide. */
const SERIES_PROJECT: Record<string, string> = { 'shape-talks': 'p02', 'summer-school': 'p03' };

export const SERIES: MeetingSeries[] = sandbox.series.map((s) => ({ ...s, projectId: SERIES_PROJECT[s.id] ?? null }));

const hasEnded = (m: { date: string; end: string }): boolean =>
  m.date < DEMO_TODAY || (m.date === DEMO_TODAY && toMin(m.end) <= toMin(DEMO_NOW));

/** Left open on purpose so the admin view has something to record. */
const NOT_YET_RECORDED = 'grants-20261021';

export const MEETINGS: Meeting[] = sandbox.meetings.map((m) => ({ ...m, recorded: hasEnded(m) && m.id !== NOT_YET_RECORDED }));

export const ATTENDANCE: AttendanceRecord[] = [
  ...sandbox.attendance
    .filter((r) => {
      const m = MEETINGS.find((x) => x.id === r.meetingId);
      return m && hasEnded(m) && r.meetingId !== NOT_YET_RECORDED;
    })
    .map((r) => ({ ...r, source: 'admin' as const })),
  { meetingId: NOT_YET_RECORDED, memberId: JAN, status: 'present', source: 'self', at: '17:26' },
  { meetingId: NOT_YET_RECORDED, memberId: KATJA, status: 'remote', source: 'self', at: '17:31' },
  // The Shapers Voice meeting is happening now; two people already clocked in.
  { meetingId: 'shapers-voice-20261022', memberId: NINA, status: 'present', source: 'self', at: '18:56' },
  { meetingId: 'shapers-voice-20261022', memberId: SARA, status: 'remote', source: 'self', at: '19:02' },
];

/* ---------- Time entries for the current week, from hours.xlsx ---------- */

const projectsOf = (memberId: string): string[] =>
  PROJECTS.filter((p) => p.status === 'active' && p.members.includes(memberId)).map((p) => p.id);

const DAYS_SO_FAR = 4; // Monday to Thursday
let entryId = 100;

export const TIME_ENTRIES: TimeEntry[] = sandbox.members.flatMap((m) => {
  const total = Math.round(m.currentWeek * 4) / 4;
  if (!total) return [];
  const projects = projectsOf(m.id);
  const perDay = Math.floor((total / DAYS_SO_FAR) * 4) / 4;
  const dayEnd = (m.tier === 'Shapers Core' ? 19 : 18) * 60;
  const hubDays = Math.round(DAYS_SO_FAR * hubShare(m.id, CURRENT_WEEK));
  return Array.from({ length: DAYS_SO_FAR }, (_, day) => {
    const hours = day === DAYS_SO_FAR - 1 ? total - perDay * (DAYS_SO_FAR - 1) : perDay;
    const minutes = Math.round(hours * 60);
    return {
      id: entryId++,
      memberId: m.id,
      projectId: projects[day % Math.max(1, projects.length)] ?? 'p01',
      date: dateInWeek(CURRENT_WEEK, day),
      start: fromMin(dayEnd - minutes),
      end: fromMin(dayEnd),
      note: '',
      source: 'manual' as const,
      place: day < hubDays ? ('hub' as const) : ('remote' as const),
    };
  }).filter((e) => toMin(e.end) > toMin(e.start));
});

/* ---------- The demo member's project history (before this app existed) ---------- */

export interface PastProject {
  name: string;
  when: string;
  role: string;
  hours: number;
  tasks: number;
  active: boolean;
}

export const DEMO_MEMBER_HISTORY: PastProject[] = [
  { name: 'Podjetniška/AI poletna šola', when: 'Mar 2025 to now', role: 'Mentor ekipe', hours: 96, tasks: 18, active: true },
  { name: 'Delavnice na srednjih šolah', when: 'Sep 2025 to now', role: 'Izvajalec delavnice', hours: 64, tasks: 12, active: true },
  { name: 'Academy Project', when: 'Jun 2026 to now', role: 'Kandidati + Mobilnost (EYE)', hours: 58, tasks: 9, active: true },
  { name: 'Shape Talk sezona 2025/26', when: 'Sep 2025 to Jun 2026', role: 'Priprava trditev', hours: 41, tasks: 10, active: false },
];
