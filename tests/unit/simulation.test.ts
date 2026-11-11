import { describe, expect, it } from 'vitest';
import { LEGACY_SPEED, clock, msToNextStage, realDurationMs, simulate, stageTimes } from '@/lib/simulation';
import { cancelOrder, createOrder, emptyOrders, openDoor, parseOrders, pruneOrders, skipOrder, MAX_ORDERS, ORDER_TTL_MS } from '@/lib/orders';
import { addItem, emptyCart } from '@/lib/cart';
import type { Catalog } from '@/lib/types';

const MIN = 60_000;
const base = { createdAt: 1_000_000, etaMinutes: 30, skippedAt: null, cancelledAt: null, openedAt: null, speed: 1 };

describe('simulation (real time)', () => {
  it('runs in real time for new orders and 10× for old ones', () => {
    expect(realDurationMs(30, 1)).toBe(30 * MIN);
    expect(realDurationMs(30, LEGACY_SPEED)).toBe(3 * MIN);
  });

  it('derives the stage from elapsed time only', () => {
    expect(simulate(base, base.createdAt).stage.id).toBe('accepted');
    expect(simulate(base, base.createdAt + 5 * MIN).stage.id).toBe('preparing');
    expect(simulate(base, base.createdAt + 20 * MIN).stage.id).toBe('onTheWay');
    expect(simulate(base, base.createdAt + 28 * MIN).stage.id).toBe('nearby');
  });

  it('waits at the door until it is opened', () => {
    const atDoor = simulate(base, base.createdAt + 30 * MIN);
    expect(atDoor.status).toBe('atDoor');
    expect(atDoor.stage.id).toBe('atDoor');
    expect(atDoor.remainingMinutes).toBe(0);
    expect(atDoor.arrivalAt).toBe(base.createdAt + 30 * MIN);
    const done = simulate({ ...base, openedAt: base.createdAt + 31 * MIN }, base.createdAt + 31 * MIN);
    expect(done.status).toBe('done');
    expect(done.stage.id).toBe('done');
  });

  it('moves the courier only after pickup', () => {
    expect(simulate(base, base.createdAt + 10 * MIN).routeProgress).toBe(0);
    const mid = simulate(base, base.createdAt + 24 * MIN).routeProgress;
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    expect(simulate(base, base.createdAt + 99 * MIN).routeProgress).toBe(1);
  });

  it('counts down real minutes and seconds', () => {
    expect(simulate(base, base.createdAt).remainingMinutes).toBe(30);
    expect(simulate(base, base.createdAt + 15 * MIN).remainingMinutes).toBe(15);
    expect(clock(simulate(base, base.createdAt + 15 * MIN + 30_000).remainingMs)).toBe('14:30');
    expect(clock(0)).toBe('0:00');
  });

  it('skip goes to the door, cancel freezes', () => {
    expect(simulate({ ...base, skippedAt: base.createdAt + 10_000 }, base.createdAt + 10_000).status).toBe('atDoor');
    const c = simulate({ ...base, cancelledAt: base.createdAt + 6 * MIN }, base.createdAt + 50 * MIN);
    expect(c.status).toBe('cancelled');
    expect(c.progress).toBeCloseTo(0.2, 3);
  });

  it('survives a clock that went backwards', () => {
    expect(simulate(base, base.createdAt - 5000).progress).toBe(0);
  });

  it('lists stage times up to the arrival', () => {
    const t = stageTimes(base);
    expect(t[0]!.at).toBe(base.createdAt);
    expect(t.at(-1)!.stage.id).toBe('atDoor');
    expect(t.at(-1)!.at).toBe(base.createdAt + 30 * MIN);
    const skipped = stageTimes({ ...base, skippedAt: base.createdAt + MIN });
    expect(skipped.map((x) => x.stage.id)).toEqual(['accepted', 'atDoor']);
  });

  it('reports the next stage boundary', () => {
    expect(msToNextStage(base, base.createdAt)).toBeCloseTo(0.08 * 30 * MIN, 0);
    expect(msToNextStage(base, base.createdAt + 99 * MIN)).toBeNull();
  });
});

const catalog: Catalog = {
  dishes: { w: { id: 'w', slug: 'w', name: 'Voda', restaurantId: 'a', price: 3500, image: '', recipe: null, page: false, optionGroups: [] } },
  restaurants: { a: { id: 'a', slug: 'a', name: 'A', etaMinutes: 30, deliveryFee: 3900, minOrder: 0, pickup: true, hours: { open: '00:00', close: '23:59' }, promo: null } },
};
const r = addItem(emptyCart(), catalog.dishes.w!, {}, 2);
const cart = r.ok ? r.cart : emptyCart();

describe('orders', () => {
  it('creates exactly one order per id', () => {
    const first = createOrder(emptyOrders(), { id: 'abc', cart, catalog, city: 'Praha', dropPoint: 'X', now: 5 })!;
    const again = createOrder(first.state, { id: 'abc', cart, catalog, city: 'Praha', dropPoint: 'X', now: 6 })!;
    expect(first.created).toBe(true);
    expect(again.created).toBe(false);
    expect(again.state.orders).toHaveLength(1);
  });

  it('stores an immutable snapshot of prices', () => {
    const o = createOrder(emptyOrders(), { id: 'abc', cart, catalog, city: 'Praha', dropPoint: 'X', now: 5 })!.order;
    catalog.dishes.w!.price = 9900;
    expect(o.lines[0]!.unitPrice).toBe(3500);
    expect(o.totals.subtotal).toBe(7000);
    catalog.dishes.w!.price = 3500;
  });

  it('refuses an empty cart', () => {
    expect(createOrder(emptyOrders(), { id: 'x', cart: emptyCart(), catalog, city: 'Praha', dropPoint: 'X', now: 1 })).toBeNull();
  });

  it('skip and cancel are one-way', () => {
    const s = createOrder(emptyOrders(), { id: 'abc', cart, catalog, city: 'Praha', dropPoint: 'X', now: 5 })!.state;
    const skipped = skipOrder(s, 'abc', 10);
    expect(skipped.orders[0]!.skippedAt).toBe(10);
    expect(skipOrder(skipped, 'abc', 20).orders[0]!.skippedAt).toBe(10);
    expect(cancelOrder(skipped, 'abc', 30).orders[0]!.cancelledAt).toBeNull();
  });

  it('new orders run in real time and the door opens once', () => {
    const s = createOrder(emptyOrders(), { id: 'abc', cart, catalog, city: 'Praha', dropPoint: 'X', now: 5 })!.state;
    expect(s.orders[0]!.speed).toBe(1);
    expect(s.orders[0]!.openedAt).toBeNull();
    const opened = openDoor(s, 'abc', 50);
    expect(opened.orders[0]!.openedAt).toBe(50);
    expect(openDoor(opened, 'abc', 90).orders[0]!.openedAt).toBe(50);
    expect(openDoor(cancelOrder(s, 'abc', 10), 'abc', 20).orders[0]!.openedAt).toBeNull();
  });

  it('reads orders saved before real-time tracking as fast and already opened', () => {
    const s = createOrder(emptyOrders(), { id: 'old', cart, catalog, city: 'Praha', dropPoint: 'X', now: 5 })!.state;
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.orders[0].speed;
    delete legacy.orders[0].openedAt;
    const o = parseOrders(legacy)!.orders[0]!;
    expect(o.speed).toBe(LEGACY_SPEED);
    expect(o.openedAt).toBe(5);
  });

  it('keeps at most MAX_ORDERS and drops expired ones', () => {
    let s = emptyOrders();
    for (let i = 0; i < MAX_ORDERS + 5; i++) s = createOrder(s, { id: `o${i}`, cart, catalog, city: 'Praha', dropPoint: 'X', now: i })!.state;
    expect(s.orders).toHaveLength(MAX_ORDERS);
    expect(pruneOrders(s, ORDER_TTL_MS + 100).orders).toHaveLength(0);
  });

  it('validates stored data', () => {
    const s = createOrder(emptyOrders(), { id: 'abc', cart, catalog, city: 'Praha', dropPoint: 'X', now: 5 })!.state;
    expect(parseOrders(JSON.parse(JSON.stringify(s)))).not.toBeNull();
    expect(parseOrders({ v: 1, orders: [{ id: 'x' }] })).toBeNull();
    expect(parseOrders('nonsense')).toBeNull();
  });
});
