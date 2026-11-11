import { describe, expect, it } from 'vitest';
import { EMPTY_FILTERS, activeCount, applyFilters, parseQuery, toQuery, type RestaurantSummary } from '@/lib/filters';
import { etaRange, isOpen, slots } from '@/lib/hours';

const r = (id: string, over: Partial<RestaurantSummary> = {}): RestaurantSummary => ({
  id, name: id, category: 'pizza', categoryLabel: 'Pizza', cuisine: '', etaMinutes: 30, deliveryFee: 3900, minOrder: 0, priceLevel: 2,
  hours: { open: '00:00', close: '00:00' }, pickup: true, tags: [], promoLabel: null, freeDelivery: false, isNew: false, order: 1,
  logo: { text: 'X', color: '#000000', ink: 'light' }, img: null, ...over,
});
const items = [
  r('a', { etaMinutes: 20, order: 3 }),
  r('b', { category: 'sushi', freeDelivery: true, promoLabel: 'Dopravné 0 Kč', order: 1 }),
  r('c', { category: 'sushi', priceLevel: 3, tags: ['bez masa'], minOrder: 30000, order: 2, hours: { open: '07:00', close: '08:00' } }),
];
const noon = Date.UTC(2026, 10, 11, 11, 0); // 12:00 in Prague (CET)

describe('filters', () => {
  it('round-trips through the URL', () => {
    const f = { ...EMPTY_FILTERS, categories: ['sushi', 'pizza'], maxEta: 30, freeDelivery: true, tags: ['bez masa'], sort: 'nejrychlejsi' as const };
    expect(parseQuery(toQuery(f))).toEqual(f);
    expect(toQuery(EMPTY_FILTERS)).toBe('');
    expect(parseQuery('?do=999&cena=7&razeni=x').maxEta).toBeNull();
  });
  it('filters and counts', () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, categories: ['sushi'] }, noon).map((x) => x.id)).toEqual(['b', 'c']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, maxEta: 20 }, noon).map((x) => x.id)).toEqual(['a']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, freeDelivery: true }, noon).map((x) => x.id)).toEqual(['b']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, tags: ['bez masa'] }, noon).map((x) => x.id)).toEqual(['c']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, noMinimum: true }, noon).map((x) => x.id)).toEqual(['b', 'a']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, openNow: true }, noon).map((x) => x.id)).toEqual(['b', 'a']);
    expect(activeCount({ ...EMPTY_FILTERS, categories: ['a', 'b'], promo: true })).toBe(3);
  });
  it('keeps the static order by default and sorts closed restaurants last otherwise', () => {
    expect(applyFilters(items, EMPTY_FILTERS, noon).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, sort: 'abeceda' }, noon).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(applyFilters(items, { ...EMPTY_FILTERS, sort: 'nejrychlejsi' }, noon)[0]!.id).toBe('a');
  });
});

describe('hours', () => {
  it('handles past-midnight closing', () => {
    const late = { open: '18:00', close: '02:00' };
    expect(isOpen(late, Date.UTC(2026, 10, 11, 23, 30))).toBe(true); // 00:30 Prague
    expect(isOpen(late, noon)).toBe(false);
  });
  it('builds slots inside opening hours', () => {
    const s = slots({ open: '11:00', close: '13:00' }, 30, noon);
    expect(s.length).toBeGreaterThan(0);
    expect(s.every((x) => x.label >= '12:00' && x.label < '13:00')).toBe(true);
    expect(etaRange(30)).toBe('25–35 min');
  });
});
