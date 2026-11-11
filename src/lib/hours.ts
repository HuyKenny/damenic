// Simulated opening hours in Prague time. A closing time earlier than the opening time means "past midnight".

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Minutes since midnight in Europe/Prague for the given instant. */
export function pragueMinutes(at: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

export function isOpen(hours: { open: string; close: string }, at: number): boolean {
  const now = pragueMinutes(at);
  const open = toMin(hours.open);
  const close = toMin(hours.close);
  if (open === close) return true;
  return open < close ? now >= open && now < close : now >= open || now < close;
}

export function hoursLabel(hours: { open: string; close: string }): string {
  return `${hours.open.replace(/^0/, '')}–${hours.close.replace(/^0/, '')}`;
}

/** Delivery time range shown like the real apps: "25–35 min". */
export function etaRange(etaMinutes: number): string {
  const lo = Math.max(10, etaMinutes - 5);
  return `${lo}–${etaMinutes + 5} min`;
}

/** Up to `count` 15-minute slots within opening hours, starting after the earliest possible delivery. */
export function slots(hours: { open: string; close: string }, etaMinutes: number, at: number, count = 8): { label: string; at: number }[] {
  const out: { label: string; at: number }[] = [];
  const step = 15 * 60_000;
  let t = Math.ceil((at + (etaMinutes + 15) * 60_000) / step) * step;
  for (let i = 0; i < 96 && out.length < count; i++, t += step) {
    if (!isOpen(hours, t)) continue;
    const m = pragueMinutes(t);
    out.push({ label: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, at: t });
  }
  return out;
}
