// One time model for everything: catalogue delivery times, the tracker and the countdown.
// Since v2.1 (11. 11. 2026) new orders run in real time (speed 1); orders saved earlier ran 10× faster and keep
// their speed, so an old order never comes back to life. State is always derived from the stored timestamps;
// nothing ticks into storage.

/** Speed of orders created before real-time tracking existed. */
export const LEGACY_SPEED = 10;
/** Speed of new orders: the countdown is real minutes. */
export const SPEED = 1;

export type StageId = 'accepted' | 'preparing' | 'packed' | 'pickedUp' | 'onTheWay' | 'nearby' | 'atDoor' | 'done';

export interface Stage {
  id: StageId;
  /** Fraction of the whole run at which the stage starts. */
  from: number;
  title: string;
  message: string;
  /** Wording for pickup orders, where the customer walks to the restaurant. */
  pickupTitle?: string;
  pickupMessage?: string;
}

export const STAGES: readonly Stage[] = [
  { id: 'accepted', from: 0, title: 'Objednávka přijata', message: 'Restaurace přijala tvoji neobjednávku.' },
  { id: 'preparing', from: 0.08, title: 'Restaurace připravuje jídlo', message: 'Kuchař právě připravuje vůbec nic.' },
  { id: 'packed', from: 0.42, title: 'Jídlo je zabalené', message: 'Nic je pečlivě zabaleno, aby cestou nevystydlo.' },
  {
    id: 'pickedUp',
    from: 0.52,
    title: 'Kurýr vyzvedl objednávku',
    message: 'Kurýr má prázdnou tašku a plný diář.',
    pickupTitle: 'Objednávka čeká na pultu',
    pickupMessage: 'Taška je připravená. Prázdná, ale připravená.',
  },
  {
    id: 'onTheWay',
    from: 0.6,
    title: 'Kurýr je na cestě',
    message: 'Kurýr veze nic nejkratší možnou trasou.',
    pickupTitle: 'Je čas vyrazit',
    pickupMessage: 'Cesta do restaurace je ilustrační. Stejně jako jídlo.',
  },
  {
    id: 'nearby',
    from: 0.9,
    title: 'Kurýr je za rohem',
    message: 'Ještě dvě odbočky a jsi bez jídla.',
    pickupTitle: 'Restaurace je za rohem',
    pickupMessage: 'Už vidíš výlohu. Za ní je nic.',
  },
  {
    id: 'atDoor',
    from: 1,
    title: 'Kurýr stojí před dveřmi',
    message: 'Crrr! Zvoní u tebe kurýr s prázdnou taškou.',
    pickupTitle: 'Objednávka je připravená k vyzvednutí',
    pickupMessage: 'Stojíš u pultu. Prázdná taška čeká na tebe.',
  },
  { id: 'done', from: 1, title: 'Doručeno: nic', message: 'DámeNic doručilo přesně to, co slíbilo. Nic.' },
];

export const stageTitle = (s: Stage, pickup: boolean) => (pickup && s.pickupTitle) || s.title;
export const stageMessage = (s: Stage, pickup: boolean) => (pickup && s.pickupMessage) || s.message;

export interface SimInput {
  createdAt: number;
  etaMinutes: number;
  skippedAt: number | null;
  cancelledAt: number | null;
  /** When the door was opened (delivery) or the bag picked up; null = not yet. */
  openedAt: number | null;
  /** Real-time multiplier: 1 for new orders, 10 for orders saved before real-time tracking. */
  speed: number;
}

export interface SimState {
  /** atDoor: the run finished, the courier waits until the door is opened. */
  status: 'running' | 'atDoor' | 'done' | 'cancelled';
  stage: Stage;
  stageIndex: number;
  /** 0..1 over the whole run. */
  progress: number;
  /** 0..1 along the courier route (0 until pickup, 1 at the destination). */
  routeProgress: number;
  /** Shown minutes left, rounded up; 0 when finished. */
  remainingMinutes: number;
  /** Real milliseconds left. */
  remainingMs: number;
  /** Real time when the courier arrives (or arrived). */
  arrivalAt: number;
}

/** Real duration of a run in ms. */
export function realDurationMs(etaMinutes: number, speed: number = SPEED): number {
  return Math.round((etaMinutes * 60_000) / speed);
}

const ROUTE_FROM = STAGES.find((s) => s.id === 'onTheWay')!.from;
const AT_DOOR = STAGES.findIndex((s) => s.id === 'atDoor');
const DONE = STAGES.findIndex((s) => s.id === 'done');

/** Adapts a stored order to the simulation input. */
export function fromOrder(o: {
  createdAt: number;
  restaurant: { etaMinutes: number };
  skippedAt: number | null;
  cancelledAt: number | null;
  openedAt: number | null;
  speed: number;
}): SimInput {
  return { createdAt: o.createdAt, etaMinutes: o.restaurant.etaMinutes, skippedAt: o.skippedAt, cancelledAt: o.cancelledAt, openedAt: o.openedAt, speed: o.speed };
}

export function simulate(input: SimInput, now: number): SimState {
  const duration = realDurationMs(input.etaMinutes, input.speed);
  const end = input.createdAt + duration;
  const finishAt = input.skippedAt !== null ? Math.min(input.skippedAt, end) : end;
  // A cancelled run freezes where it was; a clock that went backwards counts as zero progress.
  const at = input.cancelledAt !== null ? Math.min(input.cancelledAt, finishAt) : now;
  const elapsed = Math.max(0, at - input.createdAt);
  const finished = input.cancelledAt === null && now >= finishAt;
  const progress = finished ? 1 : Math.min(elapsed / duration, 0.9999);
  let stageIndex = 0;
  for (let i = 0; i < AT_DOOR; i++) if (progress >= STAGES[i]!.from) stageIndex = i;
  const opened = input.openedAt !== null;
  if (finished) stageIndex = opened ? DONE : AT_DOOR;
  const remainingMs = finished || input.cancelledAt !== null ? 0 : Math.max(0, finishAt - now);
  return {
    status: input.cancelledAt !== null ? 'cancelled' : finished ? (opened ? 'done' : 'atDoor') : 'running',
    stage: STAGES[stageIndex]!,
    stageIndex,
    progress,
    routeProgress: progress <= ROUTE_FROM ? 0 : Math.min(1, (progress - ROUTE_FROM) / (1 - ROUTE_FROM)),
    remainingMinutes: finished ? 0 : Math.max(1, Math.ceil(((1 - progress) * duration * input.speed) / 60_000)),
    remainingMs,
    arrivalAt: finishAt,
  };
}

/** Real time at which each stage up to the arrival starts (for the event log). */
export function stageTimes(input: SimInput): { stage: Stage; at: number }[] {
  const duration = realDurationMs(input.etaMinutes, input.speed);
  const finishAt = input.skippedAt !== null ? Math.min(input.skippedAt, input.createdAt + duration) : input.createdAt + duration;
  return STAGES.slice(0, AT_DOOR + 1)
    .map((stage) => ({ stage, at: Math.min(input.createdAt + stage.from * duration, finishAt) }))
    .filter((s, i) => i === 0 || s.stage.id === 'atDoor' || s.at < finishAt);
}

/** "12:34" countdown text from real milliseconds. */
export function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Real ms until the next stage starts (for scheduling one timer instead of polling storage). */
export function msToNextStage(input: SimInput, now: number): number | null {
  const s = simulate(input, now);
  if (s.status !== 'running') return null;
  const next = STAGES[s.stageIndex + 1];
  if (!next) return null;
  return Math.max(0, input.createdAt + next.from * realDurationMs(input.etaMinutes, input.speed) - now);
}
