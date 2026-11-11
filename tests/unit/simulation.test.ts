import { describe, expect, it } from 'vitest';
import { SPEED, msToNextStage, realDurationMs, simulate } from '@/lib/simulation';
import { cancelOrder, createOrder, emptyOrders, parseOrders, pruneOrders, skipOrder, MAX_ORDERS, ORDER_TTL_MS } from '@/lib/orders';
import { addItem, emptyCart } from '@/lib/cart';
import type { Catalog } from '@/lib/types';

const base = { createdAt: 1_000_000, etaMinutes: 30, skippedAt: null, cancelledAt: null };

describe('simulation', () => {
  it('runs SPEED times faster than the virtual clock', () => {
    expect(realDurationMs(30)).toBe((30 * 60_000) / SPEED);
    expect(realDurationMs(30)).toBe(180_000);
  });

  it('derives the stage from elapsed time only', () => {
    expect(simulate(base, base.createdAt).stage.id).toBe('accepted');
    expect(simulate(base, base.createdAt + 30_000).stage.id).toBe('preparing');
    expect(simulate(base, base.createdAt + 120_000).stage.id).toBe('onTheWay');
    const end = simulate(base, base.createdAt + 180_000);
    expect(end.status).toBe('done');
    expect(end.stage.id).toBe('done');
    expect(end.remainingMinutes).toBe(0);
  });

  it('moves the courier only after pickup', () => {
    expect(simulate(base, base.createdAt + 60_000).routeProgress).toBe(0);
    const mid = simulate(base, base.createdAt + 144_000).routeProgress;
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
    expect(simulate(base, base.createdAt + 999_999).routeProgress).toBe(1);
  });

  it('counts down virtual minutes', () => {
    expect(simulate(base, base.createdAt).remainingMinutes).toBe(30);
    expect(simulate(base, base.createdAt + 90_000).remainingMinutes).toBe(15);
  });

  it('finishes immediately when skipped and freezes when cancelled', () => {
    expect(simulate({ ...base, skippedAt: base.createdAt + 10_000 }, base.createdAt + 10_000).status).toBe('done');
    const c = simulate({ ...base, cancelledAt: base.createdAt + 60_000 }, base.createdAt + 500_000);
    expect(c.status).toBe('cancelled');
    expect(c.progress).toBeCloseTo(60_000 / 180_000, 3);
  });

  it('survives a clock that went backwards', () => {
    expect(simulate(base, base.createdAt - 5000).progress).toBe(0);
  });

  it('reports the next stage boundary', () => {
    expect(msToNextStage(base, base.createdAt)).toBeCloseTo(0.08 * 180_000, 0);
    expect(msToNextStage(base, base.createdAt + 999_999)).toBeNull();
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
