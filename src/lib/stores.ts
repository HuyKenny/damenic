// Shared browser state for all islands. Loaded once per page, persisted on change, synced across tabs.
import { atom } from 'nanostores';
import type { Cart, Catalog, ShoppingState } from './types';
import { emptyCart, parseCart, sanitizeCart } from './cart';
import { emptyOrders, parseOrders, pruneOrders, type OrdersState } from './orders';
import { emptyShopping, parseShopping } from './shopping';
import { DEFAULT_CITY, parseCity } from './cities';
import { KEYS, clearAllLocalData, load, save, storageAvailable } from './storage';

export const $cart = atom<Cart>(emptyCart());
export const $orders = atom<OrdersState>(emptyOrders());
export const $shopping = atom<ShoppingState>(emptyShopping());
export const $city = atom<string>(DEFAULT_CITY);
export const $catalog = atom<Catalog | null>(null);
/** True once local data has been read; islands render placeholders before that to avoid flashes. */
export const $ready = atom(false);
/** One-line notices for the visitor (storage problems, dropped cart lines). */
export const $notice = atom<string | null>(null);

let started = false;
let applyingRemote = false;

function persist<T>(store: { listen: (cb: (v: T) => void) => () => void }, key: string) {
  store.listen((value) => {
    if (!applyingRemote) save(key, value);
  });
}

function readAll(): boolean {
  const cart = load(KEYS.cart, parseCart, emptyCart);
  const orders = load(KEYS.orders, parseOrders, emptyOrders);
  const shopping = load(KEYS.shopping, parseShopping, emptyShopping);
  const city = load(KEYS.city, parseCity, () => DEFAULT_CITY);
  $cart.set(cart.value);
  $orders.set(pruneOrders(orders.value, Date.now()));
  $shopping.set(shopping.value);
  $city.set(city.value);
  return cart.recovered || orders.recovered || shopping.recovered;
}

export function initStores(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const recovered = readAll();
  if (!storageAvailable())
    $notice.set('Prohlížeč nepovolil ukládání dat. Košík a objednávky vydrží jen do zavření této stránky.');
  else if (recovered) $notice.set('Uložená data byla poškozená, tak jsme začali s čistým stolem.');

  persist($cart, KEYS.cart);
  persist($orders, KEYS.orders);
  persist($shopping, KEYS.shopping);
  persist($city, KEYS.city);

  // Another tab changed something: take its state without writing it back.
  window.addEventListener('storage', (e) => {
    if (!e.key || !Object.values(KEYS).includes(e.key as (typeof KEYS)[keyof typeof KEYS])) return;
    applyingRemote = true;
    try {
      readAll();
    } finally {
      applyingRemote = false;
    }
  });

  $ready.set(true);
  void loadCatalog();
}

let catalogPromise: Promise<Catalog | null> | null = null;

/** The catalogue is a static JSON file; the cart is reconciled with it once it arrives. */
export function loadCatalog(): Promise<Catalog | null> {
  catalogPromise ??= fetch('/data/catalog.json')
    .then((r) => (r.ok ? (r.json() as Promise<Catalog>) : null))
    .then((catalog) => {
      if (!catalog) return null;
      $catalog.set(catalog);
      const { cart, dropped } = sanitizeCart($cart.get(), catalog);
      if (dropped > 0) {
        $cart.set(cart);
        $notice.set(
          dropped === 1
            ? 'Jedna položka v košíku už v nabídce není, tak jsme ji odebrali.'
            : `${dropped} položky v košíku už v nabídce nejsou, tak jsme je odebrali.`,
        );
      }
      return catalog;
    })
    .catch(() => null);
  return catalogPromise;
}

export function wipeLocalData(): void {
  clearAllLocalData();
  applyingRemote = true;
  try {
    $cart.set(emptyCart());
    $orders.set(emptyOrders());
    $shopping.set(emptyShopping());
    $city.set(DEFAULT_CITY);
  } finally {
    applyingRemote = false;
  }
}
