// Holidays and occasions ("příležitosti"). A recipe can belong to several; each occasion with at least MIN_RECIPES
// recipes gets a hub at /recepty/prilezitosti/<id>/. `season` decides when the home page shows it ("Teď se peče …").
// Pure module (no astro:content) so the season logic is unit tested.

export const OCCASION_IDS = [
  'vanoce', 'vanocni-cukrovi', 'velikonoce', 'svatomartinske', 'masopust', 'silvestr', 'valentyn', 'halloween', 'narozeniny', 'grilovani',
] as const;
export type OccasionId = (typeof OCCASION_IDS)[number];

/** Month-day window, both ends inclusive, as [month, day]. A window may wrap over New Year. */
type Window = { from: [number, number]; to: [number, number] };

export interface Occasion {
  label: string;
  h1: string;
  title: string;
  /** Home-page rail heading while the season runs. */
  rail: string;
  railNote: string;
  intro: string[];
  /** Fixed windows, or a function of the year for movable feasts (Easter, Shrovetide). */
  season: Window[] | ((year: number) => Window[]);
  /** Higher wins when two seasons overlap (cookies beat the general Christmas hub). */
  priority: number;
}

/** Gregorian Easter Sunday (anonymous algorithm), month 1-12. */
export function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

function shift(year: number, month: number, day: number, days: number): [number, number] {
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return [d.getUTCMonth() + 1, d.getUTCDate()];
}

function easterWindow(year: number, before: number, after: number): Window[] {
  const e = easterSunday(year);
  return [{ from: shift(year, e.month, e.day, -before), to: shift(year, e.month, e.day, after) }];
}

export const OCCASIONS: Record<OccasionId, Occasion> = {
  'vanocni-cukrovi': {
    label: 'Vánoční cukroví',
    h1: 'Vánoční cukroví: recepty krok za krokem',
    title: 'Vánoční cukroví – recepty na tradiční i nové druhy',
    rail: 'Teď se peče: vánoční cukroví',
    railNote: 'Těsto se dá odložit, Vánoce ne.',
    intro: [
      'Vanilkové rohlíčky, linecké, vosí hnízda, pracny nebo perníčky. U cukroví rozhoduje studené máslo, odpočinek těsta v lednici a teplota trouby, a proto u každého receptu píšeme, jak dlouho se čeká a jak poznat, že je hotovo.',
      'Většinu druhů upečeš s předstihem: kde se cukroví nechává měknout nebo jak dlouho vydrží v plechovce, najdeš přímo v receptu. Suroviny pošleš jedním tlačítkem do nákupního seznamu, včetně másla, kterého je vždycky potřeba víc, než se zdá.',
    ],
    season: [{ from: [11, 1], to: [12, 24] }],
    priority: 3,
  },
  vanoce: {
    label: 'Vánoce',
    h1: 'Vánoční recepty: od cukroví po štědrovečerní večeři',
    title: 'Vánoční recepty – kapr, salát, vánočka a punč',
    rail: 'Vánoce na talíři',
    railNote: 'Kapr, salát a vánočka. Doručíme pocit, že je hotovo.',
    intro: [
      'Štědrovečerní kapr a bramborový salát, rybí polévka, kuba, vánočka a štola, k tomu svařák nebo vaječný koňak. Vánoční recepty, které se vaří jednou za rok, a proto se hodí mít je napsané přesně.',
      'Bramborový salát potřebuje odležet přes noc a vánočka dvakrát vykynout. U receptů najdeš, co se dá připravit den předem, aby Štědrý den nepatřil jen kuchyni.',
    ],
    season: [{ from: [11, 25], to: [12, 26] }],
    priority: 2,
  },
  silvestr: {
    label: 'Silvestr',
    h1: 'Silvestrovské recepty: chlebíčky, jednohubky a drinky',
    title: 'Silvestrovské pohoštění – chlebíčky, jednohubky, punč',
    rail: 'Na silvestrovský stůl',
    railNote: 'Jednohubky, chlebíčky a půlnoc, která přijde včas.',
    intro: [
      'Obložené chlebíčky, jednohubky, slané pečivo, pomazánky a míchané drinky na silvestrovský večer. Recepty počítají s pohoštěním pro skupinu a s tím, co se dá připravit dopředu.',
      'Pomazánky a saláty vydrží v lednici do druhého dne, chlebíčky skládej až pár hodin před příchodem hostů, ať pečivo neprosákne.',
    ],
    season: [{ from: [12, 27], to: [12, 31] }],
    priority: 2,
  },
  masopust: {
    label: 'Masopust',
    h1: 'Masopustní recepty: koblihy, boží milosti a zabijačkové speciality',
    title: 'Masopustní recepty – koblihy, boží milosti, ovar',
    rail: 'Masopust: smaží se',
    railNote: 'Koblihy se nesmaží samy. Ty tady taky ne.',
    intro: [
      'Masopust je čas koblih, božích milostí a vydatných jídel před půstem. Smažené pečivo stojí na teplotě oleje: kolem 170 °C, jinak koblihy nasáknou nebo zůstanou syrové uvnitř.',
      'Recepty uvádějí, jak dlouho těsto kyne a kolik minut se smaží každá strana, abys u plotny nemusel hádat.',
    ],
    season: (y) => {
      const e = easterSunday(y);
      // Shrovetide season ends on Ash Wednesday (46 days before Easter); start from 6 January (Three Kings).
      return [{ from: [1, 6], to: shift(y, e.month, e.day, -46) }];
    },
    priority: 1,
  },
  valentyn: {
    label: 'Valentýn',
    h1: 'Recepty na Valentýna: dezerty a večeře pro dva',
    title: 'Valentýnské recepty – dezerty a večeře pro dva',
    rail: 'Na Valentýna',
    railNote: 'Romantická večeře, kterou neodveze nikdo.',
    intro: [
      'Čokoládový fondán, makronky, tiramisu nebo steak pro dva. Valentýnské recepty, které vypadají slavnostně, ale zvládneš je v běžné kuchyni za jeden večer.',
      'Porce si přepočítáš na dvě osoby jedním tlačítkem. U dezertů píšeme, co se dá připravit už ráno.',
    ],
    season: [{ from: [2, 1], to: [2, 14] }],
    priority: 2,
  },
  velikonoce: {
    label: 'Velikonoce',
    h1: 'Velikonoční recepty: mazanec, beránek, jidáše a nádivka',
    title: 'Velikonoční recepty – mazanec, beránek, nádivka',
    rail: 'Velikonoce na stole',
    railNote: 'Mazanec kyne, beránek čeká na formu.',
    intro: [
      'Mazanec, jidáše, velikonoční beránek, nádivka a zelená polévka ze zeleného listí. Tradiční velikonoční recepty s rozepsaným kynutím, pečením a chladnutím.',
      'Kynuté pečivo potřebuje teplo a čas, nádivka pevnou formu a vejce. Kdo nechce maso, najde u nádivky bezmasou variantu.',
    ],
    season: (y) => easterWindow(y, 21, 1),
    priority: 2,
  },
  grilovani: {
    label: 'Grilování',
    h1: 'Recepty na grilování: maso, zelenina a omáčky',
    title: 'Recepty na grilování – steaky, křidélka, zelenina',
    rail: 'Grilovací sezóna',
    railNote: 'Uhlí žhne, kurýr stojí ve stínu.',
    intro: [
      'Steaky, křidélka, burgery, grilovaná zelenina i omáčky a saláty k nim. Recepty uvádějí teplotu masa uvnitř, protože podle barvy se to odhadnout nedá.',
      'Drůbež peč na 75 °C uvnitř, hovězí steak podle stupně propečení. Teploměr do masa se vyplatí víc než nový gril.',
    ],
    season: [{ from: [5, 1], to: [8, 31] }],
    priority: 1,
  },
  halloween: {
    label: 'Halloween',
    h1: 'Recepty na Halloween: dýně, polévky a strašidelné dezerty',
    title: 'Halloweenské recepty – dýňová polévka a dezerty',
    rail: 'Na Halloween',
    railNote: 'Strašidelné je jen to, že kurýr neexistuje.',
    intro: [
      'Dýňová polévka, pečená dýně, perník a dezerty, které se hodí na halloweenskou párty. Dýně Hokkaido se nemusí loupat, to šetří nejvíc práce.',
      'Recepty počítají s běžnou troubou a s tím, že děti budou chtít pomáhat. Kroky, kde se pracuje s horkým, jsou v postupu jasně popsané.',
    ],
    season: [{ from: [10, 15], to: [10, 31] }],
    priority: 2,
  },
  svatomartinske: {
    label: 'Svatomartinské',
    h1: 'Svatomartinské recepty: husa, lokše, zelí a rohlíčky',
    title: 'Svatomartinská husa a recepty na sv. Martina',
    rail: 'Na svatého Martina',
    railNote: 'Husa se peče, bílý kůň zatím nedorazil.',
    intro: [
      'Pečená husa, lokše, červené zelí, knedlíky a svatomartinské rohlíčky. Svatomartinské recepty se vaří jednou za rok, a o to víc se hodí přesné časy a teploty.',
      'Husa se peče pomalu, několik hodin, a uvnitř stehna musí mít aspoň 75 °C. Výpek z husy schovej, hodí se na lokše i na chleba.',
    ],
    season: [{ from: [10, 25], to: [11, 12] }],
    priority: 2,
  },
  narozeniny: {
    label: 'Narozeniny a oslavy',
    h1: 'Recepty na narozeniny a oslavy: dorty, zákusky a pohoštění',
    title: 'Recepty na oslavu – narozeninový dort a pohoštění',
    rail: 'Na oslavu',
    railNote: 'Dort se tu sfoukne jen nanečisto.',
    intro: [
      'Narozeninové a dětské dorty, zákusky, muffiny, chlebíčky a další pohoštění na oslavu. Recepty mají rozepsané pečení korpusu, krém i čas, kdy musí dort odpočívat v lednici.',
      'Dort se nejlépe krájí den po složení. Kdo peče na poslední chvíli, najde tu i nepečené varianty.',
    ],
    season: [],
    priority: 0,
  },
};

function inWindow(month: number, day: number, w: Window): boolean {
  const v = month * 100 + day;
  const from = w.from[0] * 100 + w.from[1];
  const to = w.to[0] * 100 + w.to[1];
  return from <= to ? v >= from && v <= to : v >= from || v <= to;
}

/** Prague calendar date (the site and its readers are Czech; builds run in UTC). */
export function pragueDate(now: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** Occasions in season on `now`, best first. `available` limits the answer to occasions that have a hub. */
export function occasionsInSeason(now: Date, available?: readonly string[]): OccasionId[] {
  const { year, month, day } = pragueDate(now);
  return OCCASION_IDS.filter((id) => !available || available.includes(id))
    .filter((id) => {
      const s = OCCASIONS[id].season;
      return (typeof s === 'function' ? s(year) : s).some((w) => inWindow(month, day, w));
    })
    .sort((a, b) => OCCASIONS[b].priority - OCCASIONS[a].priority);
}
