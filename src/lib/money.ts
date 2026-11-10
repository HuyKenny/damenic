// Money is always an integer number of haléře. Never use floats for prices.

const whole = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat('cs-CZ', { style: 'currency', currency: 'CZK', minimumFractionDigits: 2 });

/** 32900 -> "329 Kč", 32950 -> "329,50 Kč". Non-breaking spaces from Intl are kept. */
export function formatCzk(halere: number): string {
  if (!Number.isFinite(halere)) return '– Kč';
  const rounded = Math.round(halere);
  return rounded % 100 === 0 ? whole.format(rounded / 100) : cents.format(rounded / 100);
}

/** Rounds haléře to whole crowns for estimates ("≈ 86 Kč"). */
export function roundToCrown(halere: number): number {
  return Math.round(halere / 100) * 100;
}

export function kc(crowns: number): number {
  return Math.round(crowns * 100);
}

/** "+ 25 Kč" / "" for option price deltas. */
export function formatDelta(halere: number): string {
  if (halere === 0) return '';
  return (halere > 0 ? '+ ' : '− ') + formatCzk(Math.abs(halere));
}
