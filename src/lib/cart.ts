import type { Cart, CartItem, Catalog, CatalogDish, CheckoutOptions, Choices, OrderLine, Totals } from './types';
import { isInt, isObj, isStr } from './storage';

/** Simulated flat fee per order, in haléře. Charged once per order, like delivery. */
export const SERVICE_FEE = 1500;
export const MAX_QTY = 20;
export const TIPS = [0, 1000, 2000, 3000, 5000] as const;
export const DEFAULT_OPTIONS: CheckoutOptions = { mode: 'delivery', tip: 0, code: null };

/** Simulated promo codes. They change a simulated price; nothing is ever charged. */
export const PROMO_CODES: Record<string, { label: string; amount: number }> = {
  NIC: { label: 'Kód NIC', amount: 5000 },
  NANECISTO: { label: 'Kód NANECISTO', amount: 3000 },
};

export function normalizeCode(code: string | null | undefined): string | null {
  const c = (code ?? '').trim().toUpperCase();
  return c && PROMO_CODES[c] ? c : null;
}

export const emptyCart = (): Cart => ({ v: 1, restaurantId: null, items: [] });

/** Keeps only known groups/options and sorts ids so equal configurations compare equal. */
export function normalizeChoices(dish: CatalogDish, choices: Choices): Choices {
  const out: Choices = {};
  for (const group of dish.optionGroups) {
    const valid = new Set(group.options.map((o) => o.id));
    const picked = [...new Set(choices[group.id] ?? [])].filter((id) => valid.has(id)).sort();
    if (picked.length) out[group.id] = group.type === 'single' ? picked.slice(0, 1) : picked;
  }
  return out;
}

export function itemKey(dishId: string, choices: Choices): string {
  const parts = Object.keys(choices)
    .sort()
    .map((g) => `${g}=${(choices[g] ?? []).join('+')}`);
  return `${dishId}|${parts.join(';')}`;
}

/** Returns Czech messages for every unmet rule; empty array = configuration is valid. */
export function validateChoices(dish: CatalogDish, choices: Choices): string[] {
  const errors: string[] = [];
  for (const group of dish.optionGroups) {
    const n = (choices[group.id] ?? []).length;
    if (group.required && n === 0) errors.push(`Vyber: ${group.name}`);
    if (group.type === 'single' && n > 1) errors.push(`${group.name}: jen jedna možnost`);
    if (group.type === 'multi' && group.max !== undefined && n > group.max)
      errors.push(`${group.name}: nejvýš ${group.max}`);
  }
  return errors;
}

export function unitPrice(dish: CatalogDish, choices: Choices): number {
  let price = dish.price;
  for (const group of dish.optionGroups)
    for (const id of choices[group.id] ?? []) price += group.options.find((o) => o.id === id)?.priceDelta ?? 0;
  return Math.max(0, price);
}

export function optionNames(dish: CatalogDish, choices: Choices): string[] {
  const names: string[] = [];
  for (const group of dish.optionGroups)
    for (const id of choices[group.id] ?? []) {
      const opt = group.options.find((o) => o.id === id);
      if (opt) names.push(opt.name);
    }
  return names;
}

const clampQty = (n: number) => Math.min(MAX_QTY, Math.max(1, Math.round(n)));

export type AddResult =
  | { ok: true; cart: Cart }
  | { ok: false; reason: 'invalid'; errors: string[] }
  | { ok: false; reason: 'other-restaurant'; currentRestaurantId: string };

/**
 * Adds a configured dish. One restaurant per order: adding from another restaurant returns a conflict
 * and never touches the existing cart; the UI must ask before calling with `replace: true`.
 */
export function addItem(cart: Cart, dish: CatalogDish, rawChoices: Choices, qty = 1, replace = false): AddResult {
  const choices = normalizeChoices(dish, rawChoices);
  const errors = validateChoices(dish, choices);
  if (errors.length) return { ok: false, reason: 'invalid', errors };
  let base = cart;
  if (cart.restaurantId && cart.restaurantId !== dish.restaurantId && cart.items.length) {
    if (!replace) return { ok: false, reason: 'other-restaurant', currentRestaurantId: cart.restaurantId };
    base = emptyCart();
  }
  const key = itemKey(dish.id, choices);
  const existing = base.items.find((i) => i.key === key);
  const items = existing
    ? base.items.map((i) => (i.key === key ? { ...i, qty: clampQty(i.qty + qty) } : i))
    : [...base.items, { key, dishId: dish.id, qty: clampQty(qty), choices }];
  return { ok: true, cart: { v: 1, restaurantId: dish.restaurantId, items } };
}

export function setQty(cart: Cart, key: string, qty: number): Cart {
  if (qty <= 0) return removeItem(cart, key);
  return { ...cart, items: cart.items.map((i) => (i.key === key ? { ...i, qty: clampQty(qty) } : i)) };
}

export function removeItem(cart: Cart, key: string): Cart {
  const items = cart.items.filter((i) => i.key !== key);
  return { v: 1, restaurantId: items.length ? cart.restaurantId : null, items };
}

/** Changes the configuration of one line; merges into an existing identical line. */
export function updateChoices(cart: Cart, key: string, dish: CatalogDish, rawChoices: Choices): AddResult {
  const choices = normalizeChoices(dish, rawChoices);
  const errors = validateChoices(dish, choices);
  if (errors.length) return { ok: false, reason: 'invalid', errors };
  const current = cart.items.find((i) => i.key === key);
  if (!current) return { ok: true, cart };
  const newKey = itemKey(dish.id, choices);
  if (newKey === key) return { ok: true, cart };
  const twin = cart.items.find((i) => i.key === newKey);
  const items: CartItem[] = [];
  for (const item of cart.items) {
    if (item.key === newKey) continue; // merged into the edited line below
    if (item.key === key) items.push({ ...item, key: newKey, choices, qty: clampQty(item.qty + (twin?.qty ?? 0)) });
    else items.push(item);
  }
  return { ok: true, cart: { ...cart, items } };
}

/**
 * Simulated price of the order. Delivery, the service fee and the tip are counted once per order.
 * Pickup removes delivery and tip. Discounts never push the food value below zero.
 */
export function totals(cart: Cart, catalog: Catalog, opts: CheckoutOptions = DEFAULT_OPTIONS): Totals {
  let subtotal = 0;
  let count = 0;
  for (const item of cart.items) {
    const dish = catalog.dishes[item.dishId];
    if (!dish) continue;
    subtotal += unitPrice(dish, item.choices) * item.qty;
    count += item.qty;
  }
  const restaurant = cart.restaurantId ? catalog.restaurants[cart.restaurantId] : undefined;
  const pickup = opts.mode === 'pickup' && restaurant?.pickup !== false;
  const applied: string[] = [];
  let delivery = count && !pickup ? (restaurant?.deliveryFee ?? 0) : 0;
  let discount = 0;
  const promo = restaurant?.promo ?? null;
  if (count && promo) {
    if (promo.type === 'free-delivery' && delivery > 0) {
      delivery = 0;
      applied.push(promo.label);
    }
    if (promo.type === 'percent' && subtotal >= promo.minSubtotal) {
      discount += Math.round((subtotal * promo.percent) / 100);
      applied.push(promo.label);
    }
  }
  const code = normalizeCode(opts.code);
  if (count && code) {
    discount += PROMO_CODES[code]!.amount;
    applied.push(PROMO_CODES[code]!.label);
  }
  discount = Math.min(discount, subtotal);
  const fee = count ? SERVICE_FEE : 0;
  const tip = count && !pickup ? Math.max(0, Math.round(opts.tip)) : 0;
  const missingToMin = count ? Math.max(0, (restaurant?.minOrder ?? 0) - subtotal) : 0;
  return { subtotal, delivery, fee, discount, tip, total: subtotal + delivery + fee + tip - discount, count, missingToMin, applied };
}

export function countItems(cart: Cart): number {
  return cart.items.reduce((n, i) => n + i.qty, 0);
}

/**
 * Reconciles a stored cart with the current catalogue: drops dishes that no longer exist and
 * configurations that are no longer valid. Returns how many lines were dropped so the UI can say so.
 */
export function sanitizeCart(cart: Cart, catalog: Catalog): { cart: Cart; dropped: number } {
  const merged = new Map<string, CartItem>();
  let dropped = 0;
  for (const item of cart.items) {
    const dish = catalog.dishes[item.dishId];
    if (!dish || dish.restaurantId !== cart.restaurantId) {
      dropped++;
      continue;
    }
    const choices = normalizeChoices(dish, item.choices);
    if (validateChoices(dish, choices).length) {
      dropped++;
      continue;
    }
    const key = itemKey(dish.id, choices);
    const prev = merged.get(key);
    merged.set(key, { key, dishId: dish.id, choices, qty: clampQty(item.qty + (prev?.qty ?? 0)) });
  }
  const items = [...merged.values()];
  const restaurantOk = cart.restaurantId !== null && catalog.restaurants[cart.restaurantId] !== undefined;
  return { cart: { v: 1, restaurantId: items.length && restaurantOk ? cart.restaurantId : null, items: restaurantOk ? items : [] }, dropped };
}

/** Structural validation of whatever came out of localStorage. */
export function parseCart(raw: unknown): Cart | null {
  if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.items)) return null;
  if (raw.restaurantId !== null && !isStr(raw.restaurantId)) return null;
  const items: CartItem[] = [];
  for (const it of raw.items) {
    if (!isObj(it) || !isStr(it.key) || !isStr(it.dishId) || !isInt(it.qty) || it.qty < 1 || !isObj(it.choices)) return null;
    const choices: Choices = {};
    for (const [g, ids] of Object.entries(it.choices)) {
      if (!Array.isArray(ids) || !ids.every(isStr)) return null;
      choices[g] = ids;
    }
    items.push({ key: it.key, dishId: it.dishId, qty: it.qty, choices });
  }
  return { v: 1, restaurantId: raw.restaurantId, items };
}

export function toOrderLines(cart: Cart, catalog: Catalog): OrderLine[] {
  const lines: OrderLine[] = [];
  for (const item of cart.items) {
    const dish = catalog.dishes[item.dishId];
    if (!dish) continue;
    lines.push({
      dishId: dish.id,
      dishSlug: dish.slug,
      page: dish.page,
      name: dish.name,
      qty: item.qty,
      unitPrice: unitPrice(dish, item.choices),
      options: optionNames(dish, item.choices),
      recipe: dish.recipe,
      image: dish.image,
    });
  }
  return lines;
}
