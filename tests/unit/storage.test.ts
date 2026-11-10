import { afterEach, describe, expect, it, vi } from 'vitest';
import { load, resetStorageProbe, save } from '@/lib/storage';
import { emptyCart, parseCart } from '@/lib/cart';

function fakeWindow(store: Map<string, string> | null) {
  const localStorage = {
    getItem: (k: string) => {
      if (!store) throw new Error('blocked');
      return store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (!store) throw new Error('blocked');
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store?.delete(k);
    },
  };
  vi.stubGlobal('window', { localStorage });
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetStorageProbe();
});

describe('storage', () => {
  it('round-trips data', () => {
    fakeWindow(new Map());
    save('k', { v: 1, restaurantId: null, items: [] });
    expect(load('k', parseCart, emptyCart)).toEqual({ value: emptyCart(), recovered: false });
  });
  it('resets corrupted data and says so', () => {
    const store = new Map([['k', '{not json']]);
    fakeWindow(store);
    const r = load('k', parseCart, emptyCart);
    expect(r.recovered).toBe(true);
    expect(r.value).toEqual(emptyCart());
    expect(store.has('k')).toBe(false);
  });
  it('falls back to memory when storage is blocked', () => {
    fakeWindow(null);
    save('k', { v: 1, restaurantId: 'a', items: [] });
    expect(load('k', parseCart, emptyCart).value.restaurantId).toBe('a');
  });
});
