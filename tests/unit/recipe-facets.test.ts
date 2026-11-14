import { describe, expect, it } from 'vitest';
import {
  EMPTY_RECIPE_FILTERS,
  activeFilters,
  applyRecipeFilters,
  facetCounts,
  removalSuggestions,
  suggestTitles,
  wordMatches,
  deriveFacets,
  haveMatch,
  pagerItems,
  parsePageParam,
  parseRecipeQuery,
  recipeFilterCount,
  recipeFiltersToQuery,
  type IngredientFacetInfo,
  type RecipeSummary,
} from '@/lib/recipe-facets';

const info: Record<string, IngredientFacetInfo> = {
  mouka: { diet: 'plant', allergens: [1], family: 'testo-pecivo', baseUnit: 'g' },
  maslo: { diet: 'dairy', allergens: [7], baseUnit: 'g' },
  vejce: { diet: 'egg', allergens: [3], family: 'vejce', baseUnit: 'ks' },
  kure: { diet: 'meat', allergens: [], family: 'kure', baseUnit: 'g' },
  rajce: { diet: 'plant', allergens: [], family: 'zelenina', baseUnit: 'g' },
  olej: { diet: 'plant', allergens: [], baseUnit: 'ml' },
  mandle: { diet: 'plant', allergens: [8], family: 'orechy', baseUnit: 'g' },
};

describe('deriveFacets', () => {
  it('marks a plant-only recipe as vegan, gluten-free and lactose-free', () => {
    const f = deriveFacets({ steps: ['Rajčata duš na pánvi 10 minut.'], cookMinutes: 10, ingredients: [{ id: 'rajce', base: 500 }, { id: 'olej', base: 30 }] }, info);
    expect(f.diets).toEqual(expect.arrayContaining(['veg', 'vegan', 'gf', 'lf', 'ef', 'nf']));
    expect(f.family).toBe('zelenina');
  });
  it('never calls a recipe with butter vegan, or with flour gluten-free', () => {
    const f = deriveFacets({ steps: ['Upeč v troubě.'], cookMinutes: 20, ingredients: [{ id: 'mouka', base: 300 }, { id: 'maslo', base: 100 }, { id: 'vejce', base: 2 }] }, info);
    expect(f.diets).toContain('veg');
    expect(f.diets).not.toContain('vegan');
    expect(f.diets).not.toContain('gf');
    expect(f.diets).not.toContain('lf');
    expect(f.diets).not.toContain('ef');
    expect(f.methods).toContain('trouba');
  });
  it('picks the protein as the main ingredient and removes vegetarian', () => {
    const f = deriveFacets({ steps: ['Maso osmaž na pánvi a smaž v oleji.'], cookMinutes: 15, ingredients: [{ id: 'kure', base: 500 }, { id: 'rajce', base: 300 }] }, info);
    expect(f.family).toBe('kure');
    expect(f.diets).not.toContain('veg');
    expect(f.methods).toEqual(expect.arrayContaining(['panev', 'smazeni']));
  });
  it('never labels alcoholic recipes vegan', () => {
    const f = deriveFacets({ steps: ['Zahřej.'], cookMinutes: 10, alcohol: true, ingredients: [{ id: 'rajce', base: 500 }] }, info);
    expect(f.diets).toContain('veg');
    expect(f.diets).not.toContain('vegan');
  });
  it('flags nut recipes and no-heat recipes', () => {
    const f = deriveFacets({ steps: ['Vše rozmixuj a promíchej.'], cookMinutes: 0, ingredients: [{ id: 'mandle', base: 200 }, { id: 'rajce', base: 100 }] }, info);
    expect(f.diets).not.toContain('nf');
    expect(f.methods).toEqual(['bez-tepla']);
  });
});

const r = (p: Partial<RecipeSummary> & { id: string; title: string }): RecipeSummary => ({
  q: p.title.toLowerCase(),
  category: 'ceska',
  categoryLabel: 'Česká kuchyně',
  meal: 'hlavni',
  family: null,
  min: 60,
  act: 30,
  difficulty: 'snadné',
  servings: 4,
  diets: [],
  methods: [],
  alcohol: false,
  occasions: [],
  cost: 50,
  ing: [],
  w: 0,
  img: null,
  ...p,
});

describe('applyRecipeFilters', () => {
  const all = [
    r({ id: 'a', title: 'Svíčková', min: 150, cost: 90, family: 'hovezi' }),
    r({ id: 'b', title: 'Aglio olio', min: 15, act: 10, cost: 20, diets: ['veg', 'vegan'], ing: ['spagety', 'cesnek'] }),
    r({ id: 'c', title: 'Svařák', meal: 'napoj', alcohol: true, occasions: ['vanoce'], min: 20, cost: 40 }),
  ];
  const now = new Date('2026-06-15T12:00:00+02:00');
  it('combines facets with AND across groups', () => {
    expect(applyRecipeFilters(all, { ...EMPTY_RECIPE_FILTERS, maxMin: 30 }, now).map((x) => x.id).sort()).toEqual(['b', 'c']);
    expect(applyRecipeFilters(all, { ...EMPTY_RECIPE_FILTERS, maxMin: 30, diets: ['vegan'] }, now).map((x) => x.id)).toEqual(['b']);
    expect(applyRecipeFilters(all, { ...EMPTY_RECIPE_FILTERS, alcohol: 'no' }, now).map((x) => x.id).sort()).toEqual(['a', 'b']);
    expect(applyRecipeFilters(all, { ...EMPTY_RECIPE_FILTERS, alcohol: 'only' }, now).map((x) => x.id)).toEqual(['c']);
  });
  it('searches without diacritics', () => {
    const one = [r({ id: 'x', title: 'Svíčková', q: 'svickova na smetane' })];
    expect(applyRecipeFilters(one, { ...EMPTY_RECIPE_FILTERS, q: 'Svíčková' }, now)).toHaveLength(1);
    expect(applyRecipeFilters(one, { ...EMPTY_RECIPE_FILTERS, q: 'svickova smetane' }, now)).toHaveLength(1);
    expect(applyRecipeFilters(one, { ...EMPTY_RECIPE_FILTERS, q: 'gulas' }, now)).toHaveLength(0);
  });
  it('sorts by what is missing when ingredients are at home', () => {
    const f = { ...EMPTY_RECIPE_FILTERS, have: ['spagety', 'cesnek'] };
    const out = applyRecipeFilters(all, f, now);
    expect(out.map((x) => x.id)).toEqual(['b']);
    expect(haveMatch(all[1]!, f.have)).toEqual({ got: 2, total: 2 });
  });
  it('sorts by speed and price', () => {
    expect(applyRecipeFilters(all, { ...EMPTY_RECIPE_FILTERS, sort: 'nejrychlejsi' }, now)[0]!.id).toBe('b');
    expect(applyRecipeFilters(all, { ...EMPTY_RECIPE_FILTERS, sort: 'nejlevnejsi' }, now)[0]!.id).toBe('b');
  });
  it('puts the recipes of the current season first', () => {
    const winter = new Date('2026-12-10T12:00:00+01:00');
    expect(applyRecipeFilters(all, EMPTY_RECIPE_FILTERS, winter)[0]!.id).toBe('c');
  });
});

describe('recipe filter URL state', () => {
  it('round-trips and ignores junk', () => {
    const f = { ...EMPTY_RECIPE_FILTERS, q: 'dort', meals: ['dort'], diets: ['gf' as const], maxMin: 60, alcohol: 'no' as const, have: ['vejce'] };
    expect(parseRecipeQuery(recipeFiltersToQuery(f))).toEqual(f);
    const junk = parseRecipeQuery('?typ=neexistuje&dieta=xx&cas=-5&alkohol=jo&razeni=cokoli&doma=<script>');
    expect(junk).toEqual(EMPTY_RECIPE_FILTERS);
    expect(recipeFilterCount(f)).toBe(6);
  });
});

describe('faceted counts and dead-end help', () => {
  const all = [
    r({ id: 'a', title: 'Svíčková', meal: 'hlavni', min: 150, diets: [] }),
    r({ id: 'b', title: 'Aglio olio', meal: 'hlavni', min: 15, diets: ['veg', 'vegan'] }),
    r({ id: 'c', title: 'Gazpacho', meal: 'polevka', min: 10, diets: ['veg', 'vegan'] }),
    r({ id: 'd', title: 'Tiramisu', meal: 'dezert', min: 40, diets: ['veg'] }),
  ];
  const labels = { categories: {}, occasions: {}, ingredients: {} };
  const now = new Date('2026-06-15T12:00:00+02:00');
  it('ignores the value\'s own group, applies the others', () => {
    const f = { ...EMPTY_RECIPE_FILTERS, meals: ['hlavni'], diets: ['vegan' as const] };
    const c = facetCounts(all, f);
    expect(c.meal).toEqual({ hlavni: 1, polevka: 1 }); // meals ignore the meal filter, but keep the vegan one
    expect(c.diet.vegan).toBe(1); // diets ignore the diet filter, keep meal = hlavni
    expect(c.diet.veg).toBe(1);
    expect(c.time[15]).toBe(1);
  });
  it('shows cumulative time counts and alcohol split', () => {
    const c = facetCounts(all, EMPTY_RECIPE_FILTERS);
    expect(c.time[15]).toBe(2);
    expect(c.time[60]).toBe(3);
    expect(c.alcohol).toEqual({ no: 4, only: 0 });
  });
  it('suggests which filter to drop on a dead end', () => {
    const f = { ...EMPTY_RECIPE_FILTERS, meals: ['dezert'], maxMin: 15 };
    expect(applyRecipeFilters(all, f, now)).toHaveLength(0);
    const help = removalSuggestions(all, f, labels, now);
    expect(help.length).toBe(2);
    expect(help[0]!.count).toBeGreaterThan(0);
    expect(activeFilters(f, labels).map((a) => a.id)).toEqual(['meals:dezert', 'maxMin']);
  });
  it('forgives one typo in longer words and suggests titles', () => {
    expect(wordMatches('svickova na smetane', 'svickvoa')).toBe(true); // swapped letters
    expect(wordMatches('svickova na smetane', 'svickoba')).toBe(true);
    expect(wordMatches('svickova na smetane', 'smetana')).toBe(true);
    expect(wordMatches('gulas', 'guly')).toBe(false); // short words must match exactly
    expect(suggestTitles(all, 'tira').map((x) => x.id)).toEqual(['d']);
  });
});

describe('paging', () => {
  it('builds a compact pager with gaps', () => {
    expect(pagerItems(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pagerItems(1, 32)).toEqual([1, 2, 0, 32]);
    expect(pagerItems(10, 32)).toEqual([1, 0, 9, 10, 11, 0, 32]);
    expect(pagerItems(32, 32)).toEqual([1, 0, 31, 32]);
  });
  it('keeps the page in the URL and ignores junk', () => {
    expect(recipeFiltersToQuery(EMPTY_RECIPE_FILTERS, 3)).toBe('?strana=3');
    expect(recipeFiltersToQuery(EMPTY_RECIPE_FILTERS, 1)).toBe('');
    expect(parsePageParam('?strana=4&cas=30')).toBe(4);
    expect(parsePageParam('?strana=-2')).toBe(1);
    expect(parsePageParam('?strana=abc')).toBe(1);
    expect(parsePageParam('')).toBe(1);
  });
});
