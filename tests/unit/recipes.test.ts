import { describe, expect, it } from 'vitest';
import { compare, recipeCost } from '@/lib/costs';
import { formatAmount, roundAmount, scaleAmount, toBase } from '@/lib/units';
import { addRecipe, buildShoppingList, emptyShopping, parseShopping, toggleHave } from '@/lib/shopping';
import { formatCzk } from '@/lib/money';
import { fold, searchEntries } from '@/lib/search';
import type { IngredientInfo, RecipeLite } from '@/lib/types';

const info: Record<string, IngredientInfo> = {
  ryze: { id: 'ryze', name: 'Rýže', department: 'Trvanlivé', baseUnit: 'g', pack: { size: 1000, price: 6000, label: '1 kg' }, priceSource: 'illustrative', priceCheckedAt: null },
  olej: { id: 'olej', name: 'Olej', department: 'Trvanlivé', baseUnit: 'ml', spoon: 15, pack: { size: 1000, price: 4500, label: '1 l' }, priceSource: 'illustrative', priceCheckedAt: null },
  vejce: { id: 'vejce', name: 'Vejce', department: 'Mléčné a chlazené', baseUnit: 'ks', pack: { size: 10, price: 5000, label: '10 ks' }, priceSource: 'illustrative', priceCheckedAt: null },
  voda: { id: 'voda', name: 'Voda', department: 'Ostatní', baseUnit: 'ml', pack: { size: 1000, price: 0, label: '' }, priceSource: 'illustrative', priceCheckedAt: null },
};
const a: RecipeLite = { slug: 'a', title: 'A', servings: 2, ingredients: [{ ingredient: 'ryze', amount: 100, unit: 'g' }, { ingredient: 'olej', amount: 2, unit: 'lzice' }, { ingredient: 'vejce', amount: 3, unit: 'ks' }, { ingredient: 'voda', amount: 200, unit: 'ml' }] };
const b: RecipeLite = { slug: 'b', title: 'B', servings: 4, ingredients: [{ ingredient: 'ryze', amount: 300, unit: 'g' }, { ingredient: 'vejce', amount: 2, unit: 'ks' }] };

describe('units', () => {
  it('converts spoons to the base unit', () => {
    expect(toBase(2, 'lzice', info.olej!)).toBe(30);
    expect(toBase(3, 'lzicka', info.olej!)).toBe(15);
    expect(toBase(1, 'lzice', info.vejce!)).toBeNull();
  });
  it('rounds pieces sensibly', () => {
    expect(roundAmount(1.3, 'ks')).toBe(1.5);
    expect(roundAmount(0.3, 'ks')).toBe(0.25);
    expect(scaleAmount(3, 'ks', 2, 1)).toBe(1.5);
    expect(scaleAmount(250, 'g', 4, 6)).toBe(380);
  });
  it('formats amounts in Czech', () => {
    expect(formatAmount(1500, 'g')).toBe('1,5 kg');
    expect(formatAmount(0.5, 'ks')).toBe('½ ks');
    expect(formatAmount(2, 'lzice')).toBe('2 lžíce');
    expect(formatAmount(5, 'lzicka')).toBe('5 lžiček');
  });
});

describe('costs', () => {
  it('separates consumed ingredients from whole packs', () => {
    const c = recipeCost(a.ingredients, 2, 2, info);
    expect(c.consumed).toBe(600 + 135 + 1500);
    expect(c.packs).toBe(6000 + 4500 + 5000);
  });
  it('scales with servings', () => {
    expect(recipeCost(a.ingredients, 2, 4, info).consumed).toBe(1200 + 270 + 3000);
  });
  it('"have at home" lowers packs, not consumption', () => {
    const c = recipeCost(a.ingredients, 2, 2, info, { ryze: true });
    expect(c.packs).toBe(4500 + 5000);
    expect(c.consumed).toBe(600 + 135 + 1500);
  });
  it('compares the same number of portions and can go negative', () => {
    const cmp = compare(10000, 4, 3900, 1500, 50000);
    expect(cmp.delivery).toBe(40000 + 3900 + 1500);
    expect(cmp.difference).toBe(45400 - 50000);
  });
});

describe('shopping list', () => {
  it('merges the same ingredient from two recipes and skips free water', () => {
    let s = addRecipe(emptyShopping(), 'a', 2);
    s = addRecipe(s, 'b', 4);
    const list = buildShoppingList(s, { a, b }, info);
    const all = list.groups.flatMap((g) => g.lines);
    expect(all.find((l) => l.ingredientId === 'ryze')!.amount).toBe(400);
    expect(all.find((l) => l.ingredientId === 'vejce')!.amount).toBe(5);
    expect(all.find((l) => l.ingredientId === 'voda')).toBeUndefined();
    expect(list.groups.map((g) => g.department)).toEqual(['Mléčné a chlazené', 'Trvanlivé']);
  });
  it('re-adding a recipe updates servings instead of duplicating it', () => {
    let s = addRecipe(emptyShopping(), 'a', 2);
    s = addRecipe(s, 'a', 4);
    expect(s.recipes).toEqual([{ slug: 'a', servings: 4 }]);
  });
  it('marks items as at home', () => {
    const s = toggleHave(addRecipe(emptyShopping(), 'a', 2), 'ryze');
    const line = buildShoppingList(s, { a }, info).groups.flatMap((g) => g.lines).find((l) => l.ingredientId === 'ryze')!;
    expect(line.packs).toBe(0);
    expect(line.packsCost).toBe(0);
    expect(line.consumedCost).toBe(600);
  });
  it('rejects malformed stored lists', () => {
    expect(parseShopping({ v: 1, recipes: [{ slug: 'a', servings: 99 }], have: {}, checked: {} })).toBeNull();
    expect(parseShopping({ v: 1, recipes: [], have: { x: true, y: 'no' }, checked: {} })!.have).toEqual({ x: true });
  });
});

describe('money and search', () => {
  it('formats haléře as Czech crowns', () => {
    expect(formatCzk(32900).replace(/\s/g, ' ')).toBe('329 Kč');
    expect(formatCzk(32950).replace(/\s/g, ' ')).toBe('329,50 Kč');
  });
  it('ignores diacritics', () => {
    expect(fold('Svíčková')).toBe('svickova');
    const hits = searchEntries([{ type: 'jidlo', title: 'Svíčková na smetaně', sub: '', url: '/', keywords: '' }], 'svickova')!;
    expect(hits).toHaveLength(1);
    expect(searchEntries([{ type: 'jidlo', title: 'Pizza', sub: '', url: '/', keywords: '' }], 'xyz')).toHaveLength(0);
  });
});
