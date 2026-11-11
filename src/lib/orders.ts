import type { Cart, Catalog, CheckoutOptions, OrderSnapshot } from './types';
import { DEFAULT_OPTIONS, toOrderLines, totals } from './cart';
import { realDurationMs } from './simulation';
import { isInt, isObj, isStr } from './storage';

export const MAX_ORDERS = 20;
/** Local order records older than this are dropped on load. */
export const ORDER_TTL_MS = 90 * 24 * 3600 * 1000;

export interface OrdersState {
  v: 1;
  orders: OrderSnapshot[];
}

export const emptyOrders = (): OrdersState => ({ v: 1, orders: [] });

export function newOrderId(random: () => number = Math.random): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let id = '';
  for (let i = 0; i < 8; i++) id += alphabet[Math.floor(random() * alphabet.length)];
  return id;
}

/**
 * Creates exactly one order per id: a second call with the same id (double click, repeated submit)
 * returns the existing record and leaves the history untouched.
 */
export function createOrder(
  state: OrdersState,
  args: {
    id: string;
    cart: Cart;
    catalog: Catalog;
    city: string;
    dropPoint: string;
    now: number;
    opts?: CheckoutOptions;
    payment?: string;
    courierNote?: string | null;
    /** Scheduled delivery: the simulation starts so that it ends at this time. */
    scheduledFor?: number | null;
  },
): { state: OrdersState; order: OrderSnapshot; created: boolean } | null {
  const existing = state.orders.find((o) => o.id === args.id);
  if (existing) return { state, order: existing, created: false };
  const restaurant = args.cart.restaurantId ? args.catalog.restaurants[args.cart.restaurantId] : undefined;
  const lines = toOrderLines(args.cart, args.catalog);
  if (!restaurant || !lines.length) return null;
  const opts = args.opts ?? DEFAULT_OPTIONS;
  const duration = realDurationMs(restaurant.etaMinutes);
  const start = args.scheduledFor && args.scheduledFor - duration > args.now ? Math.round(args.scheduledFor - duration) : args.now;
  const order: OrderSnapshot = {
    v: 1,
    id: args.id,
    createdAt: start,
    city: args.city,
    dropPoint: args.dropPoint,
    restaurant: { id: restaurant.id, slug: restaurant.slug, name: restaurant.name, etaMinutes: restaurant.etaMinutes },
    lines,
    totals: totals(args.cart, args.catalog, opts),
    mode: opts.mode,
    payment: args.payment ?? 'Demo peněženka DámeNic',
    courierNote: args.courierNote ?? null,
    skippedAt: null,
    cancelledAt: null,
  };
  return { state: { v: 1, orders: [order, ...state.orders].slice(0, MAX_ORDERS) }, order, created: true };
}

export function findOrder(state: OrdersState, id: string): OrderSnapshot | undefined {
  return state.orders.find((o) => o.id === id);
}

function patch(state: OrdersState, id: string, change: (o: OrderSnapshot) => OrderSnapshot): OrdersState {
  return { v: 1, orders: state.orders.map((o) => (o.id === id ? change(o) : o)) };
}

/** Skipping and cancelling are one-way and idempotent. */
export function skipOrder(state: OrdersState, id: string, now: number): OrdersState {
  return patch(state, id, (o) => (o.skippedAt !== null || o.cancelledAt !== null ? o : { ...o, skippedAt: now }));
}

export function cancelOrder(state: OrdersState, id: string, now: number): OrdersState {
  return patch(state, id, (o) => (o.skippedAt !== null || o.cancelledAt !== null ? o : { ...o, cancelledAt: now }));
}

export function pruneOrders(state: OrdersState, now: number): OrdersState {
  const orders = state.orders.filter((o) => now - o.createdAt < ORDER_TTL_MS).slice(0, MAX_ORDERS);
  return orders.length === state.orders.length ? state : { v: 1, orders };
}

export function parseOrders(raw: unknown): OrdersState | null {
  if (!isObj(raw) || raw.v !== 1 || !Array.isArray(raw.orders)) return null;
  const orders: OrderSnapshot[] = [];
  for (const o of raw.orders) {
    if (!isObj(o) || o.v !== 1 || !isStr(o.id) || !isInt(o.createdAt) || !isStr(o.city) || !isStr(o.dropPoint)) return null;
    const r = o.restaurant;
    const t = o.totals;
    if (!isObj(r) || !isStr(r.id) || !isStr(r.slug) || !isStr(r.name) || !isInt(r.etaMinutes) || r.etaMinutes <= 0) return null;
    if (!isObj(t) || ![t.subtotal, t.delivery, t.fee, t.total, t.count].every(isInt)) return null;
    if (!Array.isArray(o.lines) || !o.lines.length) return null;
    for (const l of o.lines) {
      if (!isObj(l) || !isStr(l.dishId) || !isStr(l.dishSlug) || !isStr(l.name) || !isInt(l.qty) || !isInt(l.unitPrice)) return null;
      if (!Array.isArray(l.options) || !l.options.every(isStr) || !isStr(l.image) || typeof l.page !== 'boolean') return null;
      if (l.recipe !== null && !isStr(l.recipe)) return null;
    }
    if (o.skippedAt !== null && !isInt(o.skippedAt)) return null;
    if (o.cancelledAt !== null && !isInt(o.cancelledAt)) return null;
    // Orders saved before v2 lack these fields: fill neutral defaults instead of dropping them.
    const totalsV2 = { discount: 0, tip: 0, missingToMin: 0, applied: [], ...(t as object) };
    orders.push({
      ...(o as unknown as OrderSnapshot),
      totals: totalsV2 as OrderSnapshot['totals'],
      mode: o.mode === 'pickup' ? 'pickup' : 'delivery',
      payment: isStr(o.payment) ? o.payment : 'Demo peněženka DámeNic',
      courierNote: isStr(o.courierNote) ? o.courierNote : null,
    });
  }
  return { v: 1, orders };
}
