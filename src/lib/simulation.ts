// One time model for everything: catalogue delivery times, the tracker and the countdown.
// The simulation runs SPEED× faster than the virtual clock it shows.
// State is always derived from the stored creation time; nothing ticks into storage.

export const SPEED = 10;

export type StageId = 'accepted' | 'preparing' | 'packed' | 'pickedUp' | 'onTheWay' | 'done';

export interface Stage {
  id: StageId;
  /** Fraction of the whole run at which the stage starts. */
  from: number;
  title: string;
  message: string;
}

export const STAGES: readonly Stage[] = [
  { id: 'accepted', from: 0, title: 'Objednávka přijata', message: 'Restaurace přijala tvoji neobjednávku.' },
  { id: 'preparing', from: 0.08, title: 'Restaurace připravuje jídlo', message: 'Kuchař právě připravuje vůbec nic.' },
  { id: 'packed', from: 0.42, title: 'Jídlo je zabalené', message: 'Nic je pečlivě zabaleno, aby cestou nevystydlo.' },
  { id: 'pickedUp', from: 0.52, title: 'Kurýr vyzvedl objednávku', message: 'Kurýr má prázdnou tašku a plný diář.' },
  { id: 'onTheWay', from: 0.6, title: 'Kurýr je na cestě', message: 'Kurýr veze nic nejkratší možnou trasou.' },
  { id: 'done', from: 1, title: 'Doručeno: nic', message: 'DámeNic doručilo přesně to, co slíbilo. Nic.' },
];

export interface SimInput {
  createdAt: number;
  etaMinutes: number;
  skippedAt: number | null;
  cancelledAt: number | null;
}

export interface SimState {
  status: 'running' | 'done' | 'cancelled';
  stage: Stage;
  stageIndex: number;
  /** 0..1 over the whole run. */
  progress: number;
  /** 0..1 along the courier route (0 until pickup, 1 at the destination). */
  routeProgress: number;
  /** Virtual minutes left, rounded up; 0 when finished. */
  remainingMinutes: number;
  /** Real milliseconds left. */
  remainingMs: number;
}

/** Real duration of a run in ms: virtual minutes compressed by SPEED. */
export function realDurationMs(etaMinutes: number): number {
  return Math.round((etaMinutes * 60_000) / SPEED);
}

/** How long the simulation takes in real time, for labels ("≈ 3 min ve skutečnosti"). */
export function realMinutesLabel(etaMinutes: number): string {
  const sec = Math.round(realDurationMs(etaMinutes) / 1000);
  return sec < 90 ? `${sec} s` : `${Math.round(sec / 60)} min`;
}

const ROUTE_FROM = STAGES.find((s) => s.id === 'onTheWay')!.from;

export function simulate(input: SimInput, now: number): SimState {
  const duration = realDurationMs(input.etaMinutes);
  const end = input.createdAt + duration;
  const finishAt = input.skippedAt !== null ? Math.min(input.skippedAt, end) : end;
  // A cancelled run freezes where it was; a clock that went backwards counts as zero progress.
  const at = input.cancelledAt !== null ? Math.min(input.cancelledAt, finishAt) : now;
  const elapsed = Math.max(0, at - input.createdAt);
  const finished = input.cancelledAt === null && now >= finishAt;
  const progress = finished ? 1 : Math.min(elapsed / duration, 0.9999);
  let stageIndex = 0;
  for (let i = 0; i < STAGES.length; i++) if (progress >= STAGES[i]!.from) stageIndex = i;
  const remainingMs = finished || input.cancelledAt !== null ? 0 : Math.max(0, finishAt - now);
  return {
    status: input.cancelledAt !== null ? 'cancelled' : finished ? 'done' : 'running',
    stage: STAGES[stageIndex]!,
    stageIndex,
    progress,
    routeProgress: progress <= ROUTE_FROM ? 0 : Math.min(1, (progress - ROUTE_FROM) / (1 - ROUTE_FROM)),
    remainingMinutes: finished ? 0 : Math.max(1, Math.ceil(((1 - progress) * duration * SPEED) / 60_000)),
    remainingMs,
  };
}

/** Real ms until the next stage starts (for scheduling one timer instead of polling storage). */
export function msToNextStage(input: SimInput, now: number): number | null {
  const s = simulate(input, now);
  if (s.status !== 'running') return null;
  const next = STAGES[s.stageIndex + 1];
  if (!next) return null;
  return Math.max(0, input.createdAt + next.from * realDurationMs(input.etaMinutes) - now);
}
