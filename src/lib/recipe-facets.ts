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
  /** Folded searchable text: title, keywords, category. */
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
  sort: 'doporucene',
};

export const recipeFilterCount = (f: RecipeFilters): number =>
  (f.q.trim() ? 1 : 0) + f.meals.length + f.categories.length + f.families.length + f.diets.length + f.methods.length + f.occasions.length + f.difficulties.length +
  (f.maxMin !== null ? 1 : 0) + (f.maxAct !== null ? 1 : 0) + (f.maxCost !== null ? 1 : 0) + (f.alcohol !== 'any' ? 1 : 0) + (f.have.length ? 1 : 0);

export const foldText = fold;

/** How many of a recipe's non-staple ingredients are at home: matched count and total. */
export function haveMatch(r: RecipeSummary, have: string[]): { got: number; total: number } {
  const set = new Set(have);
  return { got: r.ing.filter((i) => set.has(i)).length, total: r.ing.length };
}

export function applyRecipeFilters(all: RecipeSummary[], f: RecipeFilters, now: Date): RecipeSummary[] {
  const words = fold(f.q).split(/\s+/).filter(Boolean);
  const out = all.filter((r) => {
    if (words.length && !words.every((w) => r.q.includes(w))) return false;
    if (f.meals.length && !f.meals.includes(r.meal)) return false;
    if (f.categories.length && !f.categories.includes(r.category)) return false;
    if (f.families.length && !(r.family && f.families.includes(r.family))) return false;
    if (f.diets.length && !f.diets.every((d) => r.diets.includes(d))) return false;
    if (f.methods.length && !f.methods.some((m) => r.methods.includes(m))) return false;
    if (f.occasions.length && !f.occasions.some((o) => r.occasions.includes(o))) return false;
    if (f.difficulties.length && !f.difficulties.includes(r.difficulty)) return false;
    if (f.maxMin !== null && r.min > f.maxMin) return false;
    if (f.maxAct !== null && r.act > f.maxAct) return false;
    if (f.maxCost !== null && r.cost > f.maxCost) return false;
    if (f.alcohol === 'no' && r.alcohol) return false;
    if (f.alcohol === 'only' && !r.alcohol) return false;
    if (f.have.length && haveMatch(r, f.have).got === 0) return false;
    return true;
  });
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

/** Counts per facet value among `all` (ignoring the facet's own filter is left to the UI; this is the plain total). */
export function countBy<T extends string>(all: RecipeSummary[], pick: (r: RecipeSummary) => T | T[] | null): Map<T, number> {
  const m = new Map<T, number>();
  for (const r of all) {
    const v = pick(r);
    for (const x of v === null ? [] : Array.isArray(v) ? v : [v]) m.set(x, (m.get(x) ?? 0) + 1);
  }
  return m;
}

// ---------------- URL state ----------------

const CSV = (v: string[]) => v.join(',');
const SPLIT = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);
const NUM = (v: string | null) => {
  const n = v === null ? NaN : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export function recipeFiltersToQuery(f: RecipeFilters): string {
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
  if (f.sort !== 'doporucene') p.set('razeni', f.sort);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function parseRecipeQuery(search: string): RecipeFilters {
  const p = new URLSearchParams(search);
  const sort = p.get('razeni');
  const alcohol = p.get('alkohol');
  const dietKeys = DIET_FACETS.map((d) => d.key) as string[];
  const methodKeys = METHOD_FACETS.map((m) => m.key) as string[];
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
    have: SPLIT(p.get('doma')).filter((x) => /^[a-z0-9-]+$/.test(x)).slice(0, 40),
    sort: RECIPE_SORTS.some((s) => s.key === sort) ? (sort as RecipeSort) : 'doporucene',
  };
}
