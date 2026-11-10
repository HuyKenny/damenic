import type { BaseUnit, IngredientInfo, Unit } from './types';

/** Converts a recipe amount to the ingredient's base unit (g, ml or ks). Null = units are not compatible. */
export function toBase(amount: number, unit: Unit, ing: Pick<IngredientInfo, 'baseUnit' | 'spoon'>): number | null {
  if (unit === ing.baseUnit) return amount;
  if (unit === 'lzice' || unit === 'lzicka') {
    if (ing.baseUnit === 'ks') return null;
    const spoon = ing.spoon ?? (ing.baseUnit === 'ml' ? 15 : null);
    if (spoon === null) return null;
    return amount * (unit === 'lzice' ? spoon : spoon / 3);
  }
  if (unit === 'spetka') return ing.baseUnit === 'ks' ? null : amount * 0.5;
  return null;
}

/** Sensible kitchen rounding after scaling portions. */
export function roundAmount(amount: number, unit: Unit): number {
  if (amount <= 0) return 0;
  switch (unit) {
    case 'ks':
      // Whole pieces can't be split finely: quarters below one piece, halves above.
      return amount < 1 ? Math.max(0.25, Math.round(amount * 4) / 4) : Math.round(amount * 2) / 2;
    case 'lzice':
    case 'lzicka':
      return Math.max(0.5, Math.round(amount * 2) / 2);
    case 'spetka':
      return Math.max(1, Math.round(amount));
    default:
      if (amount < 10) return Math.max(1, Math.round(amount));
      if (amount < 100) return Math.round(amount / 5) * 5;
      if (amount < 1000) return Math.round(amount / 10) * 10;
      return Math.round(amount / 50) * 50;
  }
}

export function scaleAmount(amount: number, unit: Unit, fromServings: number, toServings: number): number {
  return roundAmount((amount * toServings) / fromServings, unit);
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };
const num = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 });

function formatNumber(n: number): string {
  const whole = Math.floor(n);
  const frac = FRACTIONS[String(Math.round((n - whole) * 100) / 100)];
  if (frac) return whole ? `${whole}${frac}` : frac;
  return num.format(n);
}

function plural(n: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(n)) return few; // "1,5 lžíce"
  if (n === 1) return one;
  return n >= 2 && n <= 4 ? few : many;
}

/** "250 g", "1,2 kg", "2 lžíce", "½ ks". */
export function formatAmount(amount: number, unit: Unit | BaseUnit): string {
  switch (unit) {
    case 'g':
      return amount >= 1000 ? `${num.format(amount / 1000)} kg` : `${num.format(amount)} g`;
    case 'ml':
      return amount >= 1000 ? `${num.format(amount / 1000)} l` : `${num.format(amount)} ml`;
    case 'ks':
      return `${formatNumber(amount)} ks`;
    case 'lzice':
      return `${formatNumber(amount)} ${plural(amount, 'lžíce', 'lžíce', 'lžic')}`;
    case 'lzicka':
      return `${formatNumber(amount)} ${plural(amount, 'lžička', 'lžičky', 'lžiček')}`;
    case 'spetka':
      return `${formatNumber(amount)} ${plural(amount, 'špetka', 'špetky', 'špetek')}`;
  }
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
