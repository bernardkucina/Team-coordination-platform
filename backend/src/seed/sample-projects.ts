/**
 * The institute's real projects ("PROJEKTI GS za Shapers GO": 01–07), the Academy Project from the old Miro
 * board, the planned projects people can say they are interested in, and Hub Operations (ops), where meeting
 * time and hub work outside projects is logged. Ported from the design prototype (the former hub-pulse/src/lib/data.ts).
 * Task dates are derived from their weeks; members match the roster.
 */
import type { AreaId, Priority, ProjectRole, ProjectStatus, TaskLink, TaskStatus } from '@hub-pulse/shared';

export interface SampleRow {
  area: AreaId;
  lead: string;
  /** Tasks finished before the platform existed (from the old Miro board). */
  doneEarlier: number;
}

export interface SampleProject {
  id: string;
  number: string;
  name: string;
  status: ProjectStatus;
  mainArea: AreaId;
  tags: string[];
  tagline: string;
  description: string;
  roles: ProjectRole[];
  lead: string;
  members: string[];
  interested: string[];
  rows: SampleRow[];
  /** Meeting series whose meeting time is logged on this project. */
  series: string[];
}

export interface SampleTask {
  project: string;
  /** Board row: an area of the project. */
  area: AreaId;
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
  notes?: string;
  links?: TaskLink[];
  /** Comments, oldest first. */
  comments?: { by: string; text: string; on: string }[];
}

const ANA = 'ana-kovac', LUKA = 'luka-novak', MAJA = 'maja-horvat', ZIGA = 'ziga-krajnc', NINA = 'nina-zupan', JAN = 'jan-potocnik';
const EVA = 'eva-vidmar', MATIC = 'matic-kos', SARA = 'sara-mlakar', ROK = 'rok-golob', ZALA = 'zala-turk', NEJC = 'nejc-kralj';
const TJASA = 'tjasa-bozic', ALJAZ = 'aljaz-hribar', PETRA = 'petra-jerman', BLAZ = 'blaz-bizjak', KATJA = 'katja-lesjak';
const URBAN = 'urban-petek', NEZA = 'neza-oblak', FILIP = 'filip-rozman';

/* ---------- Projects ---------- */

const rows = (lead: string, areas: AreaId[], doneEarlier: number[] = []): SampleRow[] =>
  areas.map((area, i) => ({ area, lead, doneEarlier: doneEarlier[i] ?? 0 }));

type ActiveInput = Omit<SampleProject, 'status' | 'interested' | 'tagline' | 'rows' | 'series'> & { workstreams: SampleRow[] };

const active = ({ workstreams, ...p }: ActiveInput): SampleProject =>
  ({ ...p, status: 'active', interested: [], tagline: '', rows: workstreams, series: [] });

const planned = (id: string, name: string, mainArea: AreaId, description: string, interested: string[] = []): SampleProject => ({
  id, number: '', name, status: 'planned', mainArea, tags: [], tagline: '', description, roles: [], lead: '', members: [], interested,
  rows: [], series: [],
});

const PROJECT_TAGLINES: Record<string, string> = {
  p01: 'Delavnice in debate za dijake pri predmetu aktivno državljanstvo.',
  p02: 'Moderirane debate za mlade o družbeno pomembnih temah.',
  p03: 'Brezplačna večdnevna podjetniška šola za mlade vsako poletje.',
  p04: 'Mesečni pogovori z gosti iz podjetništva in tehnologije.',
  p05: 'Vikend delavnice o AI, od promptinga do vibe codinga.',
  p06: 'Dvakrat na leto se srečamo s partnerji in se jim zahvalimo.',
  p07: 'Podjetjem poiščemo mlade talente iz naše mreže.',
  academy: 'Mlade talente pripravimo s programom in jih umestimo v podjetja.',
};

/** Series whose meeting time belongs to one project; the rest are hub-wide. */
const SERIES_PROJECT: Record<string, string> = { 'shape-talks': 'p02', 'summer-school': 'p03' };

const OPS: SampleProject = {
  id: 'ops', number: '', name: 'Hub Operations', status: 'active', mainArea: 'strategy', tags: [],
  tagline: 'Sestanki in delo v hubu, ki ni vezano na en projekt.',
  description: 'Sem se beležijo ure sestankov, ki ne spadajo k projektu, in delo za hub (Community, Grants, Shapers Voice, Shapers Tech).',
  roles: [], lead: ANA, members: [], interested: [], rows: rows(ANA, ['strategy']), series: [],
};

export const SAMPLE_PROJECTS: SampleProject[] = [
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
  OPS,
].map((p) => ({
  ...p,
  tagline: p.tagline || PROJECT_TAGLINES[p.id] || '',
  series: Object.entries(SERIES_PROJECT).filter(([, projectId]) => projectId === p.id).map(([series]) => series),
}));

/* ---------- Tasks ---------- */

/** Monday of 2026 ISO week 43 is 19 October. */
const mondayOf = (week: number): string => {
  const d = new Date(Date.UTC(2026, 9, 19 + (week - 43) * 7));
  return d.toISOString().slice(0, 10);
};
const plusDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
/** The demo's history stops before the hackathon weekend. */
const LAST_DAY = '2026-10-23';
const notAfter = (iso: string): string => (iso > LAST_DAY ? LAST_DAY : iso);

const T = (
  _id: number, project: string, title: string, area: AreaId, status: TaskStatus, owner: string | null,
  start: number | null, end: number | null, priority: Priority = 'Medium', helpers: string[] = [],
): SampleTask => {
  const created = start ? notAfter(plusDays(mondayOf(start), -7)) : '2026-10-12';
  const worked = status === 'progress' || status === 'validation' || status === 'done';
  return {
    project, area, title, status, ...(owner && { owner }), priority, helpers,
    ...(start && end && { weeks: [start, end] as [number, number] }),
    ...(end && { due: plusDays(mondayOf(end), 4) }),
    created,
    ...(worked && start && { started: notAfter(mondayOf(start) > created ? mondayOf(start) : plusDays(created, 1)) }),
    ...(status === 'done' && end && { done: notAfter(plusDays(mondayOf(end), 4)) }),
  };
};

const A = 'academy';

export const SAMPLE_TASKS: SampleTask[] = [
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

const nda = SAMPLE_TASKS.find((t) => t.project === A && t.title === 'NDA: med nami in participantom');
if (nda) {
  nda.notes = 'Use the template from the Preskok deal. Legal check with Ana before it goes out.';
  nda.links = [{ label: 'NDA template (Google Docs)', url: 'https://docs.google.com/' }];
  nda.comments = [{ by: ANA, text: 'Add the GDPR clause from the EYE brief.', on: '2026-10-22' }];
}
