// Restaurant list filters and sorting. Pure functions; state lives in the URL query (?k=pizza&do=30…).
import { isOpen } from './hours';

export interface RestaurantSummary {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  cuisine: string;
  etaMinutes: number;
  deliveryFee: number;
  minOrder: number;
  priceLevel: number;
  hours: { open: string; close: string };
  pickup: boolean;
  tags: string[];
  promoLabel: string | null;
  freeDelivery: boolean;
  isNew: boolean;
  order: number;
  logo: { text: string; color: string; ink: 'light' | 'dark' };
  /** Pre-built responsive image for the card. */
  img: { src: string; srcset: string; width: number; height: number; alt: string } | null;
}

export type SortKey = 'doporucene' | 'nejrychlejsi' | 'doprava' | 'minimum' | 'abeceda';

export interface FilterState {
  categories: string[];
  maxEta: number | null;
  priceLevels: number[];
  freeDelivery: boolean;
  promo: boolean;
  openNow: boolean;
  pickup: boolean;
  isNew: boolean;
  noMinimum: boolean;
  tags: string[];
  sort: SortKey;
}

export const EMPTY_FILTERS: FilterState = {
  categories: [],
  maxEta: null,
  priceLevels: [],
  freeDelivery: false,
  promo: false,
  openNow: false,
  pickup: false,
  isNew: false,
  noMinimum: false,
  tags: [],
  sort: 'doporucene',
};

export const SORTS: { key: SortKey; label: string }[] = [
  { key: 'doporucene', label: 'Doporučené' },
  { key: 'nejrychlejsi', label: 'Nejrychlejší doručení' },
  { key: 'doprava', label: 'Nejlevnější dopravné' },
  { key: 'minimum', label: 'Nejnižší minimum' },
  { key: 'abeceda', label: 'Podle abecedy' },
];

export const ETA_STEPS = [20, 30, 45] as const;
export const DIET_TAGS = ['bez masa', 'veganské', 'pikantní', 'bezlepkové možnosti'] as const;

const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

export function parseQuery(search: string): FilterState {
  const q = new URLSearchParams(search);
  const sort = q.get('razeni') as SortKey | null;
  const eta = Number(q.get('do'));
  return {
    categories: list(q.get('k')),
    maxEta: (ETA_STEPS as readonly number[]).includes(eta) ? eta : null,
    priceLevels: list(q.get('cena')).map(Number).filter((n) => n >= 1 && n <= 3),
    freeDelivery: q.get('doprava') === '0',
    promo: q.has('akce'),
    openNow: q.has('otevreno'),
    pickup: q.has('odber'),
    isNew: q.has('nove'),
    noMinimum: q.has('bezminima'),
    tags: list(q.get('dieta')).filter((t) => (DIET_TAGS as readonly string[]).includes(t)),
    sort: SORTS.some((s) => s.key === sort) ? sort! : 'doporucene',
  };
}

export function toQuery(f: FilterState): string {
  const q = new URLSearchParams();
  if (f.categories.length) q.set('k', f.categories.join(','));
  if (f.maxEta) q.set('do', String(f.maxEta));
  if (f.priceLevels.length) q.set('cena', f.priceLevels.join(','));
  if (f.freeDelivery) q.set('doprava', '0');
  if (f.promo) q.set('akce', '');
  if (f.openNow) q.set('otevreno', '');
  if (f.pickup) q.set('odber', '');
  if (f.isNew) q.set('nove', '');
  if (f.noMinimum) q.set('bezminima', '');
  if (f.tags.length) q.set('dieta', f.tags.join(','));
  if (f.sort !== 'doporucene') q.set('razeni', f.sort);
  const s = q.toString().replace(/=(?=&|$)/g, '');
  return s ? `?${s}` : '';
}

export function activeCount(f: FilterState): number {
  return (
    f.categories.length +
    (f.maxEta ? 1 : 0) +
    f.priceLevels.length +
    [f.freeDelivery, f.promo, f.openNow, f.pickup, f.isNew, f.noMinimum].filter(Boolean).length +
    f.tags.length
  );
}

export function applyFilters(items: RestaurantSummary[], f: FilterState, now: number): RestaurantSummary[] {
  const out = items.filter(
    (r) =>
      (!f.categories.length || f.categories.includes(r.category)) &&
      (!f.maxEta || r.etaMinutes <= f.maxEta) &&
      (!f.priceLevels.length || f.priceLevels.includes(r.priceLevel)) &&
      (!f.freeDelivery || r.freeDelivery) &&
      (!f.promo || r.promoLabel !== null) &&
      (!f.openNow || isOpen(r.hours, now)) &&
      (!f.pickup || r.pickup) &&
      (!f.isNew || r.isNew) &&
      (!f.noMinimum || r.minOrder === 0) &&
      f.tags.every((t) => r.tags.includes(t)),
  );
  const by: Record<SortKey, (a: RestaurantSummary, b: RestaurantSummary) => number> = {
    doporucene: (a, b) => a.order - b.order,
    nejrychlejsi: (a, b) => a.etaMinutes - b.etaMinutes || a.order - b.order,
    doprava: (a, b) => (a.freeDelivery ? 0 : a.deliveryFee) - (b.freeDelivery ? 0 : b.deliveryFee) || a.order - b.order,
    minimum: (a, b) => a.minOrder - b.minOrder || a.order - b.order,
    abeceda: (a, b) => a.name.localeCompare(b.name, 'cs'),
  };
  // Open restaurants first, like the real apps; closed ones stay visible with their opening time.
  return out.sort((a, b) => Number(isOpen(b.hours, now)) - Number(isOpen(a.hours, now)) || by[f.sort](a, b));
}
