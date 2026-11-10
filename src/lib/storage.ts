// Versioned, failure-tolerant localStorage access.
// - Storage may be unavailable (private mode, blocked site data): fall back to memory, never throw.
// - Stored data may be corrupted or from an older version: validate, otherwise reset to the default.

export const KEYS = {
  cart: 'damenic:cart:v1',
  orders: 'damenic:orders:v1',
  shopping: 'damenic:shopping:v1',
  city: 'damenic:city:v1',
} as const;

const memory = new Map<string, string>();
let available: boolean | null = null;

export function storageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const k = 'damenic:probe';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

/** Test hook. */
export function resetStorageProbe(): void {
  available = null;
  memory.clear();
}

export function readRaw(key: string): string | null {
  if (typeof window === 'undefined') return null;
  if (!storageAvailable()) return memory.get(key) ?? null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeRaw(key: string, value: string): boolean {
  memory.set(key, value);
  if (typeof window === 'undefined' || !storageAvailable()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false; // quota or blocked: the in-memory copy keeps the session working
  }
}

export function removeKey(key: string): void {
  memory.delete(key);
  if (typeof window === 'undefined' || !storageAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface Loaded<T> {
  value: T;
  /** True when stored data existed but was unreadable and had to be reset. */
  recovered: boolean;
}

export function load<T>(key: string, parse: (raw: unknown) => T | null, fallback: () => T): Loaded<T> {
  const raw = readRaw(key);
  if (raw === null) return { value: fallback(), recovered: false };
  try {
    const parsed = parse(JSON.parse(raw));
    if (parsed !== null) return { value: parsed, recovered: false };
  } catch {
    /* fall through */
  }
  removeKey(key);
  return { value: fallback(), recovered: true };
}

export function save(key: string, value: unknown): boolean {
  return writeRaw(key, JSON.stringify(value));
}

/** Removes everything this site stores in the browser. */
export function clearAllLocalData(): void {
  for (const key of Object.values(KEYS)) removeKey(key);
}

export const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const isStr = (v: unknown): v is string => typeof v === 'string';
export const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
