import type { IngredientInfo, RecipeIngredient } from './types';
import { scaleAmount, toBase } from './units';

// Three different numbers that must never be mixed up:
//  A) simulated delivery value  – what the fictional order "costs"
//  B) consumed ingredients      – the share of each pack the recipe actually uses
//  C) whole packs to buy        – what the till would show if you had nothing at home
// All ingredient prices are illustrative estimates until a verified shop feed exists.

export interface IngredientCost {
  ingredientId: string;
  /** Amount in the ingredient's base unit. */
  base: number;
  consumed: number;
  packs: number;
  packsCost: number;
}

export interface RecipeCost {
  servings: number;
  lines: IngredientCost[];
  /** B: cost of what is actually used, haléře. */
  consumed: number;
  /** C: cost of whole packs, haléře. */
  packs: number;
  /** Ingredients whose unit could not be converted (excluded from sums). */
  unpriced: string[];
}

export function recipeCost(
  ingredients: RecipeIngredient[],
  baseServings: number,
  servings: number,
  info: Record<string, IngredientInfo>,
  have: Record<string, true> = {},
): RecipeCost {
  const lines: IngredientCost[] = [];
  const unpriced: string[] = [];
  const byId = new Map<string, number>();
  for (const ri of ingredients) {
    const ing = info[ri.ingredient];
    if (!ing) {
      unpriced.push(ri.ingredient);
      continue;
    }
    const scaled = scaleAmount(ri.amount, ri.unit, baseServings, servings);
    const base = toBase(scaled, ri.unit, ing);
    if (base === null) {
      unpriced.push(ri.ingredient);
      continue;
    }
    byId.set(ri.ingredient, (byId.get(ri.ingredient) ?? 0) + base);
  }
  let consumed = 0;
  let packs = 0;
  for (const [id, base] of byId) {
    const ing = info[id]!;
    const c = Math.round((base / ing.pack.size) * ing.pack.price);
    // "Mám doma" lowers what you need to buy (C) but the food you use still has a value (B).
    const n = have[id] ? 0 : Math.max(1, Math.ceil(base / ing.pack.size - 1e-9));
    lines.push({ ingredientId: id, base, consumed: c, packs: n, packsCost: n * ing.pack.price });
    consumed += c;
    packs += n * ing.pack.price;
  }
  return { servings, lines, consumed, packs, unpriced };
}

export interface Comparison {
  servings: number;
  /** A: dish price × portions + delivery and fee counted once. */
  delivery: number;
  deliveryParts: { food: number; delivery: number; fee: number };
  /** B */
  home: number;
  /** A − B. Negative when cooking at home comes out more expensive. */
  difference: number;
}

/** Compares the same number of portions. Delivery and the service fee are counted once per order. */
export function compare(
  dishUnitPrice: number,
  servings: number,
  deliveryFee: number,
  serviceFee: number,
  homeConsumed: number,
): Comparison {
  const food = dishUnitPrice * servings;
  const delivery = food + deliveryFee + serviceFee;
  return {
    servings,
    delivery,
    deliveryParts: { food, delivery: deliveryFee, fee: serviceFee },
    home: homeConsumed,
    difference: delivery - homeConsumed,
  };
}
