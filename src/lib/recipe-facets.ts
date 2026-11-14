// Recipe filters: facet derivation (build time) and filtering/sorting (browser). Pure functions, no astro:content.
// Derived facets come from ingredient data (diet, allergens, family), so a recipe can never claim "vegan" or
// "bez lepku" that its own ingredients contradict. Every facet is a plain value in the static recipe index.
import { occasionsInSeason, type OccasionId } from './occasions';

export const MEAL_LABELS: Record<string, string> = {
  snidane: 'Snídaně',
  predkrm: 'Předkrmy a pomazánky',
  polevka: 'Polévky',
  salat: 'Saláty',
  hlavni: 'Hlavní jídla',
  priloha: 'Přílohy',
  omacka: 'Omáčky a dipy',
  pecivo: 'Pečivo a koláče',
  dezert: 'Dezerty a cukroví',
  dort: 'Dorty a zákusky',
  napoj: 'Nápoje',
};

export const FAMILY_LABELS: Record<string, string> = {
  kure: 'Kuřecí',
  veprove: 'Vepřové',
  hovezi: 'Hovězí',
  'husa-kachna': 'Husa a kachna',
  ryba: 'Ryby',
  'morske-plody': 'Mořské plody',
  vejce: 'Vejce',
  'syr-tvaroh': 'Sýr a tvaroh',
  lusteniny: 'Luštěniny a tofu',
  testoviny: 'Těstoviny a nudle',
  'ryze-obiloviny': 'Rýže a obiloviny',
  brambory: 'Brambory',
  houby: 'Houby',
  zelenina: 'Zelenina',
  ovoce: 'Ovoce',
  orechy: 'Ořechy',
  'testo-pecivo': 'Těsto a pečivo',
};

/** Order in which a recipe's "main ingredient" is chosen: proteins first, then staples, then the rest. */
const FAMILY_PRIORITY = ['hovezi', 'veprove', 'kure', 'husa-kachna', 'ryba', 'morske-plody', 'lusteniny', 'syr-tvaroh', 'vejce', 'houby', 'testoviny', 'ryze-obiloviny', 'brambory', 'zelenina', 'ovoce', 'orechy', 'testo-pecivo'];

export const DIET_FACETS = [
  { key: 'veg', label: 'Bez masa' },
  { key: 'vegan', label: 'Veganské' },
  { key: 'gf', label: 'Bez lepku' },
  { key: 'lf', label: 'Bez laktózy' },
  { key: 'ef', label: 'Bez vajec' },
  { key: 'nf', label: 'Bez ořechů a arašídů' },
] as const;
export type DietKey = (typeof DIET_FACETS)[number]['key'];

export const METHOD_FACETS = [
  { key: 'trouba', label: 'V troubě' },
  { key: 'panev', label: 'Na pánvi' },
  { key: 'hrnec', label: 'Vaření a dušení' },
  { key: 'smazeni', label: 'Smažení' },
  { key: 'gril', label: 'Na grilu' },
  { key: 'bez-tepla', label: 'Bez tepelné úpravy' },
] as const;
export type MethodKey = (typeof METHOD_FACETS)[number]['key'];

export const TIME_STEPS = [15, 30, 60, 120] as const;
export const COST_STEPS = [30, 60, 100] as const;
export const DIFFICULTIES = ['snadné', 'střední', 'náročnější'] as const;

export interface IngredientFacetInfo {
  diet: string;
  allergens: number[];
  family?: string;
  baseUnit: 'g' | 'ml' | 'ks';
  staple?: boolean;
}

export interface RecipeFacetInput {
  steps: string[];
  cookMinutes: number;
  /** Wine, beer and spirits are sometimes clarified with animal products, so alcoholic recipes are never labelled vegan. */
  alcohol?: boolean;
  /** Ingredient ids with amounts converted to base units (g, ml or ks) when possible, else 0. */
  ingredients: { id: string; base: number }[];
}

export interface RecipeFacets {
  diets: DietKey[];
  family: string | null;
  methods: MethodKey[];
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function deriveFacets(r: RecipeFacetInput, info: Record<string, IngredientFacetInfo>): RecipeFacets {
  const used = r.ingredients.map((i) => info[i.id]).filter((x): x is IngredientFacetInfo => !!x);
  const has = (pred: (i: IngredientFacetInfo) => boolean) => used.some(pred);
  const diets: DietKey[] = [];
  const meaty = has((i) => ['meat', 'fish', 'shellfish'].includes(i.diet));
  if (!meaty) diets.push('veg');
  if (!meaty && !r.alcohol && !has((i) => ['dairy', 'egg', 'honey'].includes(i.diet))) diets.push('vegan');
  if (!has((i) => i.allergens.includes(1))) diets.push('gf');
  if (!has((i) => i.allergens.includes(7))) diets.push('lf');
  if (!has((i) => i.allergens.includes(3))) diets.push('ef');
  if (!has((i) => i.allergens.includes(5) || i.allergens.includes(8))) diets.push('nf');

  // main ingredient: the highest-priority family that makes up a real share of the dish (>= 80 g or 1 piece of meat/fish)
  const grams = new Map<string, number>();
  for (const i of r.ingredients) {
    const f = info[i.id]?.family;
    if (f) grams.set(f, (grams.get(f) ?? 0) + i.base);
  }
  const family =
    FAMILY_PRIORITY.find((f) => (grams.get(f) ?? 0) >= (f === 'vejce' ? 3 : f === 'orechy' ? 150 : 80)) ??
    FAMILY_PRIORITY.find((f) => grams.has(f)) ??
    null;

  const text = fold(r.steps.join(' '));
  const methods: MethodKey[] = [];
  if (/\btroub|\bpec(e|te|ou|i)\b|\bpeceme|\bupec|plech/.test(text)) methods.push('trouba');
  if (/panev|\bopec|osmaz|restuj|\bpodus/.test(text)) methods.push('panev');
  if (/\bvar(it|i|\b)|\buvar|vareni|\bdus(it|i|te)|probublav|vroucí|vrouci|\bpovar/.test(text)) methods.push('hrnec');
  if (/\bsmaz|fritez|\bvysmaz|trojobal/.test(text)) methods.push('smazeni');
  if (/\bgril/.test(text)) methods.push('gril');
  if (r.cookMinutes === 0 && !methods.some((m) => m !== 'panev')) methods.push('bez-tepla');
  return { diets, family, methods };
}

// ---------------- index shape and filtering ----------------

export interface RecipeSummary {
  id: string;
  title: string;
  /** Folded searchable text: title, keywords, category, ingredient names and synonyms. */
  q: string;
  category: string;
  categoryLabel: string;
  meal: string;
  family: string | null;
  /** Total minutes (work + cooking + waiting) and hands-on minutes. */
  min: number;
  act: number;
  difficulty: string;
  servings: number;
  diets: DietKey[];
  methods: MethodKey[];
  alcohol: boolean;
  occasions: string[];
  /** Estimated cost of one serving in whole crowns (illustrative ingredient prices). */
  cost: number;
  /** Ingredient ids without staples (water, salt, oil…), for the "co mám doma" matcher. */
  ing: string[];
  /** Quality weight for the default sort: more content = higher. */
  w: number;
  img: { src: string; srcset: string; alt: string } | null;
}

export type RecipeSort = 'doporucene' | 'nejrychlejsi' | 'nejlevnejsi' | 'nejmene-prace' | 'abeceda';

export const RECIPE_SORTS: { key: RecipeSort; label: string }[] = [
  { key: 'doporucene', label: 'Doporučené' },
  { key: 'nejrychlejsi', label: 'Nejrychlejší' },
  { key: 'nejmene-prace', label: 'Nejméně práce' },
  { key: 'nejlevnejsi', label: 'Nejlevnější na porci' },
  { key: 'abeceda', label: 'Podle abecedy' },
];

export interface RecipeFilters {
  q: string;
  meals: string[];
  categories: string[];
  families: string[];
  diets: DietKey[];
  methods: MethodKey[];
  occasions: string[];
  difficulties: string[];
  maxMin: number | null;
  maxAct: number | null;
  maxCost: number | null;
  alcohol: 'any' | 'no' | 'only';
  have: string[];
  /** With "have": at most this many ingredients may be missing. */
  maxMissing: number | null;
  sort: RecipeSort;
}

export const EMPTY_RECIPE_FILTERS: RecipeFilters = {
  q: '',
  meals: [],
  categories: [],
  families: [],
  diets: [],
  methods: [],
  occasions: [],
  difficulties: [],
  maxMin: null,
  maxAct: null,
  maxCost: null,
  alcohol: 'any',
  have: [],
  maxMissing: null,
  sort: 'doporucene',
};

export const recipeFilterCount = (f: RecipeFilters): number =>
  (f.q.trim() ? 1 : 0) + f.meals.length + f.categories.length + f.families.length + f.diets.length + f.methods.length + f.occasions.length + f.difficulties.length +
  (f.maxMin !== null ? 1 : 0) + (f.maxAct !== null ? 1 : 0) + (f.maxCost !== null ? 1 : 0) + (f.alcohol !== 'any' ? 1 : 0) + (f.have.length ? 1 : 0);

export const foldText = fold;

/** Words people type that are not in the recipe text, appended to the search text by the index builder. */
export const SYNONYMS: Record<string, string> = {
  kure: 'kure kureci drubez maso',
  veprove: 'vepro veprove veprovy maso',
  hovezi: 'hovezi hovezi maso',
  'husa-kachna': 'husa kachna drubez',
  ryba: 'ryba ryby rybi',
  'morske-plody': 'morske plody krevety',
  veg: 'bezmasa bezmasa vegetarianske vegetarian',
  vegan: 'vegansky vegansko vegan rostlinne',
  gf: 'bezlepkove bezlepku',
  lf: 'bezlaktozove bezlaktozy',
};

/** How many of a recipe's non-staple ingredients are at home: matched count and total. */
export function haveMatch(r: RecipeSummary, have: string[]): { got: number; total: number } {
  const set = new Set(have);
  return { got: r.ing.filter((i) => set.has(i)).length, total: r.ing.length };
}

/** Edit distance up to 1 (substitution, insertion or deletion); cheap, used only for words of 5+ letters. */
function withinOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    // two neighbouring letters swapped counts as one typo ("svickvoa")
    const d: number[] = [];
    for (let k = 0; k < a.length && d.length < 3; k++) if (a[k] !== b[k]) d.push(k);
    if (d.length === 2 && d[1] === d[0]! + 1 && a[d[0]!] === b[d[1]!] && a[d[1]!] === b[d[0]!]) return true;
  }
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** A word matches when it is part of the recipe text or, for words of 5+ letters, one typo away from a word of it. */
export function wordMatches(q: string, word: string): boolean {
  if (q.includes(word)) return true;
  if (word.length < 5) return false;
  return q.split(' ').some((t) => t.length >= 4 && (withinOne(t, word) || (word.length >= 6 && t.length >= 6 && withinOne(t.slice(0, word.length), word))));
}

export type FilterGroup = 'meal' | 'category' | 'family' | 'diet' | 'method' | 'occasion' | 'difficulty' | 'time' | 'act' | 'cost' | 'alcohol';

/** Does the recipe pass every active filter except those of the `skip` group? (Used for faceted counts.) */
export function passes(r: RecipeSummary, f: RecipeFilters, words: string[], skip?: FilterGroup): boolean {
  if (words.length && !words.every((w) => wordMatches(r.q, w))) return false;
  if (skip !== 'meal' && f.meals.length && !f.meals.includes(r.meal)) return false;
  if (skip !== 'category' && f.categories.length && !f.categories.includes(r.category)) return false;
  if (skip !== 'family' && f.families.length && !(r.family && f.families.includes(r.family))) return false;
  if (skip !== 'diet' && f.diets.length && !f.diets.every((d) => r.diets.includes(d))) return false;
  if (skip !== 'method' && f.methods.length && !f.methods.some((m) => r.methods.includes(m))) return false;
  if (skip !== 'occasion' && f.occasions.length && !f.occasions.some((o) => r.occasions.includes(o))) return false;
  if (skip !== 'difficulty' && f.difficulties.length && !f.difficulties.includes(r.difficulty)) return false;
  if (skip !== 'time' && f.maxMin !== null && r.min > f.maxMin) return false;
  if (skip !== 'act' && f.maxAct !== null && r.act > f.maxAct) return false;
  if (skip !== 'cost' && f.maxCost !== null && r.cost > f.maxCost) return false;
  if (skip !== 'alcohol') {
    if (f.alcohol === 'no' && r.alcohol) return false;
    if (f.alcohol === 'only' && !r.alcohol) return false;
  }
  if (f.have.length) {
    const m = haveMatch(r, f.have);
    if (m.got === 0) return false;
    if (f.maxMissing !== null && m.total - m.got > f.maxMissing) return false;
  }
  return true;
}

const searchWords = (q: string) => fold(q).split(/\s+/).filter(Boolean);

export function applyRecipeFilters(all: RecipeSummary[], f: RecipeFilters, now: Date): RecipeSummary[] {
  const words = searchWords(f.q);
  const out = all.filter((r) => passes(r, f, words));
  const season = new Set<string>(occasionsInSeason(now));
  const seasonal = (r: RecipeSummary) => (r.occasions.some((o) => season.has(o)) ? 1 : 0);
  const byTitle = (a: RecipeSummary, b: RecipeSummary) => a.title.localeCompare(b.title, 'cs');
  if (f.have.length && f.sort === 'doporucene') {
    // "co mám doma": the fewest missing ingredients first
    const miss = (r: RecipeSummary) => {
      const m = haveMatch(r, f.have);
      return m.total - m.got;
    };
    return out.sort((a, b) => miss(a) - miss(b) || byTitle(a, b));
  }
  switch (f.sort) {
    case 'nejrychlejsi':
      return out.sort((a, b) => a.min - b.min || byTitle(a, b));
    case 'nejmene-prace':
      return out.sort((a, b) => a.act - b.act || byTitle(a, b));
    case 'nejlevnejsi':
      return out.sort((a, b) => a.cost - b.cost || byTitle(a, b));
    case 'abeceda':
      return out.sort(byTitle);
    default:
      return out.sort((a, b) => seasonal(b) - seasonal(a) || b.w - a.w || byTitle(a, b));
  }
}

export interface FacetCounts {
  meal: Record<string, number>;
  category: Record<string, number>;
  family: Record<string, number>;
  diet: Record<string, number>;
  method: Record<string, number>;
  occasion: Record<string, number>;
  difficulty: Record<string, number>;
  /** Cumulative: how many recipes would remain with "max N minutes" (keys are the step values). */
  time: Record<number, number>;
  act: Record<number, number>;
  cost: Record<number, number>;
  alcohol: { no: number; only: number };
}

export const ACT_STEPS = [10, 20, 30] as const;

/**
 * Faceted counts: for every value, how many recipes the result would contain if that value were chosen, with all the
 * other groups' filters applied but the value's own group ignored. Zero means the choice would be a dead end.
 */
export function facetCounts(all: RecipeSummary[], f: RecipeFilters): FacetCounts {
  const words = searchWords(f.q);
  const out: FacetCounts = { meal: {}, category: {}, family: {}, diet: {}, method: {}, occasion: {}, difficulty: {}, time: {}, act: {}, cost: {}, alcohol: { no: 0, only: 0 } };
  const bump = (m: Record<string, number>, k: string | null | undefined) => {
    if (k) m[k] = (m[k] ?? 0) + 1;
  };
  for (const r of all) {
    if (passes(r, f, words, 'meal')) bump(out.meal, r.meal);
    if (passes(r, f, words, 'category')) bump(out.category, r.category);
    if (passes(r, f, words, 'family')) bump(out.family, r.family);
    if (passes(r, f, words, 'difficulty')) bump(out.difficulty, r.difficulty);
    if (passes(r, f, words, 'diet')) for (const d of r.diets) bump(out.diet, d);
    if (passes(r, f, words, 'method')) for (const m of r.methods) bump(out.method, m);
    if (passes(r, f, words, 'occasion')) for (const o of r.occasions) bump(out.occasion, o);
    if (passes(r, f, words, 'time')) for (const s of TIME_STEPS) if (r.min <= s) out.time[s] = (out.time[s] ?? 0) + 1;
    if (passes(r, f, words, 'act')) for (const s of ACT_STEPS) if (r.act <= s) out.act[s] = (out.act[s] ?? 0) + 1;
    if (passes(r, f, words, 'cost')) for (const s of COST_STEPS) if (r.cost <= s) out.cost[s] = (out.cost[s] ?? 0) + 1;
    if (passes(r, f, words, 'alcohol')) out.alcohol[r.alcohol ? 'only' : 'no']++;
  }
  return out;
}

// ---------------- active filters, dead-end help, suggestions ----------------

export interface ActiveFilter {
  id: string;
  label: string;
  /** The filters with just this one removed. */
  without: (f: RecipeFilters) => RecipeFilters;
}

export interface FilterLabels {
  categories: Record<string, string>;
  occasions: Record<string, string>;
  ingredients: Record<string, string>;
}

export function activeFilters(f: RecipeFilters, labels: FilterLabels): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const list = <T extends string>(key: keyof RecipeFilters, values: T[], label: (v: T) => string) => {
    for (const v of values) out.push({ id: `${String(key)}:${v}`, label: label(v), without: (g) => ({ ...g, [key]: (g[key] as T[]).filter((x) => x !== v) }) as RecipeFilters });
  };
  if (f.q.trim()) out.push({ id: 'q', label: `„${f.q.trim()}“`, without: (g) => ({ ...g, q: '' }) });
  list('meals', f.meals, (v) => MEAL_LABELS[v] ?? v);
  list('categories', f.categories, (v) => labels.categories[v] ?? v);
  list('families', f.families, (v) => FAMILY_LABELS[v] ?? v);
  list('diets', f.diets, (v) => DIET_FACETS.find((d) => d.key === v)?.label ?? v);
  list('methods', f.methods, (v) => METHOD_FACETS.find((m) => m.key === v)?.label ?? v);
  list('occasions', f.occasions, (v) => labels.occasions[v] ?? v);
  list('difficulties', f.difficulties, (v) => v[0]!.toUpperCase() + v.slice(1));
  if (f.maxMin !== null) out.push({ id: 'maxMin', label: f.maxMin < 60 ? `Do ${f.maxMin} min` : `Do ${f.maxMin / 60} h`, without: (g) => ({ ...g, maxMin: null }) });
  if (f.maxAct !== null) out.push({ id: 'maxAct', label: `Práce do ${f.maxAct} min`, without: (g) => ({ ...g, maxAct: null }) });
  if (f.maxCost !== null) out.push({ id: 'maxCost', label: `Do ${f.maxCost} Kč na porci`, without: (g) => ({ ...g, maxCost: null }) });
  if (f.alcohol !== 'any') out.push({ id: 'alcohol', label: f.alcohol === 'no' ? 'Bez alkoholu' : 'S alkoholem', without: (g) => ({ ...g, alcohol: 'any' }) });
  if (f.have.length) out.push({ id: 'have', label: `Doma: ${f.have.map((i) => labels.ingredients[i] ?? i).slice(0, 3).join(', ')}${f.have.length > 3 ? ` +${f.have.length - 3}` : ''}`, without: (g) => ({ ...g, have: [], maxMissing: null }) });
  return out;
}

/** For a dead end: which single filter, once removed, brings back the most recipes. */
export function removalSuggestions(all: RecipeSummary[], f: RecipeFilters, labels: FilterLabels, now: Date, limit = 3): { filter: ActiveFilter; count: number }[] {
  return activeFilters(f, labels)
    .map((filter) => ({ filter, count: applyRecipeFilters(all, filter.without(f), now).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Title suggestions while typing: titles with a word that starts with the typed text, best first. */
export function suggestTitles(all: RecipeSummary[], text: string, limit = 6): RecipeSummary[] {
  const t = fold(text.trim());
  if (t.length < 2) return [];
  const starts = (r: RecipeSummary) => fold(r.title).split(/[\s,()-]+/).some((w) => w.startsWith(t));
  return all
    .filter((r) => fold(r.title).includes(t))
    .sort((a, b) => Number(starts(b)) - Number(starts(a)) || b.w - a.w || a.title.localeCompare(b.title, 'cs'))
    .slice(0, limit);
}

// ---------------- URL state ----------------

const CSV = (v: string[]) => v.join(',');
const SPLIT = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const NUM = (v: string | null) => {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function recipeFiltersToQuery(f: RecipeFilters, page = 1): string {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.meals.length) p.set('typ', CSV(f.meals));
  if (f.categories.length) p.set('kuchyne', CSV(f.categories));
  if (f.families.length) p.set('surovina', CSV(f.families));
  if (f.diets.length) p.set('dieta', CSV(f.diets));
  if (f.methods.length) p.set('priprava', CSV(f.methods));
  if (f.occasions.length) p.set('svatek', CSV(f.occasions));
  if (f.difficulties.length) p.set('obtiznost', CSV(f.difficulties));
  if (f.maxMin !== null) p.set('cas', String(f.maxMin));
  if (f.maxAct !== null) p.set('prace', String(f.maxAct));
  if (f.maxCost !== null) p.set('cena', String(f.maxCost));
  if (f.alcohol !== 'any') p.set('alkohol', f.alcohol);
  if (f.have.length) p.set('doma', CSV(f.have));
  if (f.have.length && f.maxMissing !== null) p.set('chybi', String(f.maxMissing));
  if (f.sort !== 'doporucene') p.set('razeni', f.sort);
  if (page > 1) p.set('strana', String(page));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function parseRecipeQuery(search: string): RecipeFilters {
  const p = new URLSearchParams(search);
  const sort = p.get('razeni');
  const alcohol = p.get('alkohol');
  const dietKeys = DIET_FACETS.map((d) => d.key) as string[];
  const methodKeys = METHOD_FACETS.map((m) => m.key) as string[];
  const have = SPLIT(p.get('doma')).filter((x) => /^[a-z0-9-]+$/.test(x)).slice(0, 40);
  const missing = p.get('chybi');
  return {
    q: (p.get('q') ?? '').slice(0, 80),
    meals: SPLIT(p.get('typ')).filter((x) => x in MEAL_LABELS),
    categories: SPLIT(p.get('kuchyne')).filter((x) => /^[a-z]+$/.test(x)),
    families: SPLIT(p.get('surovina')).filter((x) => x in FAMILY_LABELS),
    diets: SPLIT(p.get('dieta')).filter((x) => dietKeys.includes(x)) as DietKey[],
    methods: SPLIT(p.get('priprava')).filter((x) => methodKeys.includes(x)) as MethodKey[],
    occasions: SPLIT(p.get('svatek')).filter((x) => /^[a-z-]+$/.test(x)) as OccasionId[],
    difficulties: SPLIT(p.get('obtiznost')).filter((x) => (DIFFICULTIES as readonly string[]).includes(x)),
    maxMin: NUM(p.get('cas')),
    maxAct: NUM(p.get('prace')),
    maxCost: NUM(p.get('cena')),
    alcohol: alcohol === 'no' || alcohol === 'only' ? alcohol : 'any',
    have,
    maxMissing: have.length && missing !== null && /^[0-9]$/.test(missing) ? Number(missing) : null,
    sort: RECIPE_SORTS.some((s) => s.key === sort) ? (sort as RecipeSort) : 'doporucene',
  };
}

/** Page number from `?strana=`; anything that is not a sane positive integer means page 1. */
export function parsePageParam(search: string): number {
  const v = new URLSearchParams(search).get('strana');
  return v !== null && /^[0-9]{1,3}$/.test(v) && Number(v) >= 1 ? Number(v) : 1;
}

/** Page numbers to show in the pager: first, last and a window around the current page, with 0 standing for "…". */
export function pagerItems(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: number[] = [];
  for (const n of sorted) {
    if (out.length && n - out[out.length - 1]! > 1) out.push(0);
    out.push(n);
  }
  return out;
}
