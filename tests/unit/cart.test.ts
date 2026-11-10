import { describe, expect, it } from 'vitest';
import { addItem, emptyCart, itemKey, parseCart, removeItem, sanitizeCart, setQty, SERVICE_FEE, totals, unitPrice, updateChoices, validateChoices } from '@/lib/cart';
import type { Catalog, CatalogDish } from '@/lib/types';

const pizza: CatalogDish = {
  id: 'pizza',
  slug: 'pizza',
  name: 'Pizza',
  restaurantId: 'a',
  price: 18900,
  image: '',
  recipe: 'pizza',
  page: true,
  optionGroups: [
    { id: 'size', name: 'Velikost', type: 'single', required: true, options: [{ id: 's', name: '32 cm', priceDelta: 0 }, { id: 'l', name: '40 cm', priceDelta: 6000 }] },
    { id: 'extra', name: 'Navíc', type: 'multi', required: false, max: 2, options: [{ id: 'cheese', name: 'Sýr', priceDelta: 3500 }, { id: 'olives', name: 'Olivy', priceDelta: 2000 }, { id: 'ham', name: 'Šunka', priceDelta: 3000 }] },
  ],
};
const water: CatalogDish = { id: 'water', slug: 'water', name: 'Voda', restaurantId: 'a', price: 3500, image: '', recipe: null, page: false, optionGroups: [] };
const burger: CatalogDish = { ...water, id: 'burger', slug: 'burger', name: 'Burger', restaurantId: 'b', price: 21900 };
const catalog: Catalog = {
  dishes: { pizza, water, burger },
  restaurants: { a: { id: 'a', slug: 'a', name: 'A', etaMinutes: 30, deliveryFee: 3900 }, b: { id: 'b', slug: 'b', name: 'B', etaMinutes: 30, deliveryFee: 4900 } },
};

function add(cart = emptyCart(), dish = pizza, choices = { size: ['s'] }, qty = 1, replace = false) {
  const r = addItem(cart, dish, choices, qty, replace);
  if (!r.ok) throw new Error(r.reason);
  return r.cart;
}

describe('cart', () => {
  it('adds a dish and counts totals with delivery and fee once', () => {
    const cart = add(add(), water, {}, 2);
    const t = totals(cart, catalog);
    expect(t.subtotal).toBe(18900 + 2 * 3500);
    expect(t.delivery).toBe(3900);
    expect(t.fee).toBe(SERVICE_FEE);
    expect(t.total).toBe(18900 + 7000 + 3900 + SERVICE_FEE);
    expect(t.count).toBe(3);
  });

  it('refuses a dish without its required options', () => {
    const r = addItem(emptyCart(), pizza, {}, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid');
    expect(validateChoices(pizza, { size: ['s'] })).toEqual([]);
  });

  it('enforces the max of a multi group', () => {
    expect(validateChoices(pizza, { size: ['s'], extra: ['cheese', 'olives', 'ham'] })).toHaveLength(1);
  });

  it('merges identical configurations regardless of option order', () => {
    let cart = add(emptyCart(), pizza, { size: ['s'], extra: ['olives', 'cheese'] });
    cart = add(cart, pizza, { size: ['s'], extra: ['cheese', 'olives'] });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.qty).toBe(2);
  });

  it('keeps different configurations of the same dish apart', () => {
    let cart = add(emptyCart(), pizza, { size: ['s'] });
    cart = add(cart, pizza, { size: ['l'] });
    expect(cart.items).toHaveLength(2);
    expect(totals(cart, catalog).subtotal).toBe(18900 + 24900);
  });

  it('recalculates price from options', () => {
    expect(unitPrice(pizza, { size: ['l'], extra: ['cheese'] })).toBe(18900 + 6000 + 3500);
  });

  it('changes quantity and removes at zero', () => {
    let cart = add();
    const key = cart.items[0]!.key;
    cart = setQty(cart, key, 4);
    expect(cart.items[0]!.qty).toBe(4);
    cart = setQty(cart, key, 0);
    expect(cart.items).toHaveLength(0);
    expect(cart.restaurantId).toBeNull();
  });

  it('never replaces a cart from another restaurant without confirmation', () => {
    const cart = add();
    const r = addItem(cart, burger, {}, 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('other-restaurant');
    expect(cart.items).toHaveLength(1);
    const replaced = add(cart, burger, {}, 1, true);
    expect(replaced.restaurantId).toBe('b');
    expect(replaced.items.map((i) => i.dishId)).toEqual(['burger']);
  });

  it('edits a line and merges it into an identical one', () => {
    let cart = add(emptyCart(), pizza, { size: ['s'] });
    cart = add(cart, pizza, { size: ['l'] });
    const r = updateChoices(cart, itemKey('pizza', { size: ['s'] }), pizza, { size: ['l'] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cart.items).toHaveLength(1);
      expect(r.cart.items[0]!.qty).toBe(2);
    }
  });

  it('drops lines whose dish left the catalogue', () => {
    const cart = add(add(), water, {});
    const smaller: Catalog = { ...catalog, dishes: { pizza } };
    const { cart: clean, dropped } = sanitizeCart(cart, smaller);
    expect(dropped).toBe(1);
    expect(clean.items.map((i) => i.dishId)).toEqual(['pizza']);
  });

  it('rejects malformed stored carts', () => {
    expect(parseCart(null)).toBeNull();
    expect(parseCart({ v: 2, items: [] })).toBeNull();
    expect(parseCart({ v: 1, restaurantId: 'a', items: [{ key: 'x', dishId: 'pizza', qty: -1, choices: {} }] })).toBeNull();
    expect(parseCart({ v: 1, restaurantId: 'a', items: [{ key: 'x', dishId: 'pizza', qty: 1, choices: { size: ['s'] } }] })).not.toBeNull();
  });

  it('removes a line', () => {
    const cart = add();
    expect(removeItem(cart, cart.items[0]!.key).items).toHaveLength(0);
  });
});
