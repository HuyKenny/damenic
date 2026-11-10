import { useEffect } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { $cart, $catalog, $ready, initStores } from '@/lib/stores';
import { addItem, type AddResult } from '@/lib/cart';
import type { CatalogDish, Choices } from '@/lib/types';

/** Every island calls this; the stores load local data once per page. */
export function useInit(): boolean {
  useEffect(() => initStores(), []);
  return useStore($ready);
}

export function tryAdd(dish: CatalogDish, choices: Choices, qty: number, replace = false): AddResult {
  const result = addItem($cart.get(), dish, choices, qty, replace);
  if (result.ok) $cart.set(result.cart);
  return result;
}

export function restaurantName(id: string | null): string {
  const catalog = $catalog.get();
  return (id && catalog?.restaurants[id]?.name) || 'jiné restaurace';
}
