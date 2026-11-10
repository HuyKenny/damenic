import type { IngredientInfo, RecipeLite, ShoppingState } from './types';
import { scaleAmount, toBase } from './units';
import { isInt, isObj, isStr } from './storage';

export const DEPARTMENTS = [
  'Ovoce a zelenina',
  'Maso a ryby',
  'Mléčné a chlazené',
  'Pečivo',
  'Trvanlivé',
  'Koření a dochucovadla',
  'Ostatní',
] as const;

export const emptyShopping = (): ShoppingState => ({ v: 1, recipes: [], have: {}, checked: {} });

export const MAX_SERVINGS = 12;
const clampServings = (n: number) => Math.min(MAX_SERVINGS, Math.max(1, Math.round(n)));

export function addRecipe(state: ShoppingState, slug: string, servings: number): ShoppingState {
  const exists = state.recipes.some((r) => r.slug === slug);
  const recipes = exists
    ? state.recipes.map((r) => (r.slug === slug ? { slug, servings: clampServings(servings) } : r))
    : [...state.recipes, { slug, servings: clampServings(servings) }];
  return { ...state, recipes };
}

export function setServings(state: ShoppingState, slug: string, servings: number): ShoppingState {
  return { ...state, recipes: state.recipes.map((r) => (r.slug === slug ? { slug, servings: clampServings(servings) } : r)) };
}

export function removeRecipe(state: ShoppingState, slug: string): ShoppingState {
  return { ...state, recipes: state.recipes.filter((r) => r.slug !== slug) };
}

function toggle(map: Record<string, true>, id: string): Record<string, true> {
  const next = { ...map };
  if (next[id]) delete next[id];
  else next[id] = true;
  return next;
}

export const toggleHave = (s: ShoppingState, id: string): ShoppingState => ({ ...s, have: toggle(s.have, id) });
export const toggleChecked = (s: ShoppingState, id: string): ShoppingState => ({ ...s, checked: toggle(s.checked, id) });

export interface ShoppingLine {
  ingredientId: string;
  name: string;
  department: string;
  baseUnit: IngredientInfo['baseUnit'];
  /** Total needed across all recipes, in the base unit. */
  amount: number;
  /** Whole packs to buy (0 when marked as at home). */
  packs: number;
  packLabel: string;
  packsCost: number;
  /** Value of what the recipes consume, regardless of "Mám doma". */
  consumedCost: number;
  have: boolean;
  checked: boolean;
  recipes: string[];
  illustrative: boolean;
}

export interface ShoppingSummary {
  groups: { department: string; lines: ShoppingLine[] }[];
  /** C: whole packs still to buy. */
  toBuy: number;
  /** B: value of everything the recipes consume. */
  consumed: number;
  /** Ingredients that could not be merged because of incompatible units. */
  skipped: string[];
  missingRecipes: string[];
}

/** Merges the same ingredient from several recipes after converting to its base unit. */
export function buildShoppingList(
  state: ShoppingState,
  recipes: Record<string, RecipeLite>,
  info: Record<string, IngredientInfo>,
): ShoppingSummary {
  const merged = new Map<string, { amount: number; recipes: Set<string> }>();
  const skipped = new Set<string>();
  const missingRecipes: string[] = [];
  for (const sel of state.recipes) {
    const recipe = recipes[sel.slug];
    if (!recipe) {
      missingRecipes.push(sel.slug);
      continue;
    }
    for (const ri of recipe.ingredients) {
      const ing = info[ri.ingredient];
      const scaled = scaleAmount(ri.amount, ri.unit, recipe.servings, sel.servings);
      const base = ing ? toBase(scaled, ri.unit, ing) : null;
      if (ing && ing.pack.price === 0) continue; // tap water and the like: nothing to buy
      if (!ing || base === null) {
        skipped.add(ing?.name ?? ri.ingredient);
        continue;
      }
      const entry = merged.get(ing.id) ?? { amount: 0, recipes: new Set<string>() };
      entry.amount += base;
      entry.recipes.add(recipe.title);
      merged.set(ing.id, entry);
    }
  }
  const lines: ShoppingLine[] = [];
  for (const [id, entry] of merged) {
    const ing = info[id]!;
    const have = state.have[id] === true;
    const packs = have ? 0 : Math.max(1, Math.ceil(entry.amount / ing.pack.size - 1e-9));
    lines.push({
      ingredientId: id,
      name: ing.name,
      department: ing.department,
      baseUnit: ing.baseUnit,
      amount: entry.amount,
      packs,
      packLabel: ing.pack.label,
      packsCost: packs * ing.pack.price,
      consumedCost: Math.round((entry.amount / ing.pack.size) * ing.pack.price),
      have,
      checked: state.checked[id] === true,
      recipes: [...entry.recipes],
      illustrative: ing.priceSource !== 'verified',
    });
  }
  const order = (d: string) => {
    const i = (DEPARTMENTS as readonly string[]).indexOf(d);
    return i === -1 ? DEPARTMENTS.length : i;
  };
  const groups = new Map<string, ShoppingLine[]>();
  for (const line of lines.sort((a, b) => a.name.localeCompare(b.name, 'cs'))) {
    const list = groups.get(line.department) ?? [];
    list.push(line);
    groups.set(line.department, list);
  }
  return {
    groups: [...groups.entries()].sort((a, b) => order(a[0]) - order(b[0])).map(([department, l]) => ({ department, lines: l })),
    toBuy: lines.reduce((s, l) => s + l.packsCost, 0),
    consumed: lines.reduce((s, l) => s + l.consumedCost, 0),
    skipped: [...skipped],
    missingRecipes,
  };
}

export function parseShopping(raw: unknown): ShoppingState | null {
  if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.recipes) || !isObj(raw.have) || !isObj(raw.checked)) return null;
  const recipes: ShoppingState['recipes'] = [];
  for (const r of raw.recipes) {
    if (!isObj(r) || !isStr(r.slug) || !isInt(r.servings) || r.servings < 1 || r.servings > MAX_SERVINGS) return null;
    recipes.push({ slug: r.slug, servings: r.servings });
  }
  const flags = (o: Record<string, unknown>) => {
    const out: Record<string, true> = {};
    for (const [k, v] of Object.entries(o)) if (v === true) out[k] = true;
    return out;
  };
  return { v: 1, recipes, have: flags(raw.have), checked: flags(raw.checked) };
}
