// Build-time helpers over the content collections. Never import this from an island.
import { getCollection, type CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { Catalog, IngredientInfo, RecipeLite } from './types';
import type { SearchEntry } from './search';
import { CATEGORY_LABELS } from './site';
import { recipeCost } from './costs';

export type Restaurant = CollectionEntry<'restaurants'>;
export type Dish = CollectionEntry<'dishes'>;
export type Recipe = CollectionEntry<'recipes'>;
export type Asset = CollectionEntry<'assets'>;

const photoFiles = import.meta.glob<ImageMetadata>('/src/assets/photos/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });
const photos = new Map<string, ImageMetadata>();
for (const [path, meta] of Object.entries(photoFiles)) photos.set(path.split('/').pop()!, meta);

export async function allRestaurants(): Promise<Restaurant[]> {
  return (await getCollection('restaurants')).sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id));
}

export async function allDishes(): Promise<Dish[]> {
  return (await getCollection('dishes')).sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id));
}

export async function allRecipes(): Promise<Recipe[]> {
  return (await getCollection('recipes')).sort((a, b) => a.data.title.localeCompare(b.data.title, 'cs'));
}

export async function assetMap(): Promise<Map<string, Asset>> {
  return new Map((await getCollection('assets')).map((a) => [a.id, a]));
}

export interface Photo {
  meta: ImageMetadata | null;
  alt: string;
  temporary: boolean;
}

/** Resolves an asset id to the local file. A missing file yields a neutral placeholder, never a broken build. */
export async function photo(assetId: string): Promise<Photo> {
  const asset = (await assetMap()).get(assetId);
  const meta = asset ? (photos.get(asset.data.file) ?? null) : null;
  return { meta, alt: asset?.data.alt ?? '', temporary: asset?.data.temporary ?? true };
}

async function thumb(assetId: string): Promise<string> {
  const p = await photo(assetId);
  if (!p.meta) return '';
  return (await getImage({ src: p.meta, width: 160, height: 160, format: 'webp', quality: 70 })).src;
}

export const dishHasPage = (dish: Dish) => dish.data.kind === 'main';

let catalogMemo: Promise<Catalog> | null = null;
/** Built once per build; pages and the JSON endpoint share it. */
export function buildCatalog(): Promise<Catalog> {
  return (catalogMemo ??= makeCatalog());
}

async function makeCatalog(): Promise<Catalog> {
  const catalog: Catalog = { dishes: {}, restaurants: {} };
  for (const r of await allRestaurants())
    catalog.restaurants[r.id] = { id: r.id, slug: r.id, name: r.data.name, etaMinutes: r.data.etaMinutes, deliveryFee: r.data.deliveryFee };
  for (const d of await allDishes())
    catalog.dishes[d.id] = {
      id: d.id,
      slug: d.id,
      name: d.data.name,
      restaurantId: d.data.restaurant.id,
      price: d.data.price,
      image: await thumb(d.data.image),
      recipe: d.data.recipe?.id ?? null,
      page: dishHasPage(d),
      optionGroups: d.data.optionGroups,
    };
  return catalog;
}

export async function ingredientInfo(): Promise<Record<string, IngredientInfo>> {
  const out: Record<string, IngredientInfo> = {};
  for (const i of await getCollection('ingredients')) out[i.id] = { id: i.id, ...i.data };
  return out;
}

export function recipeLite(recipe: Recipe): RecipeLite {
  return {
    slug: recipe.id,
    title: recipe.data.title,
    servings: recipe.data.servings,
    ingredients: recipe.data.ingredients.map((i) => ({
      ingredient: i.ingredient.id,
      amount: i.amount,
      unit: i.unit,
      ...(i.note ? { note: i.note } : {}),
      ...(i.group ? { group: i.group } : {}),
    })),
  };
}

export const totalMinutes = (r: Recipe) => r.data.activeMinutes + r.data.cookMinutes + r.data.waitMinutes;

export async function buildSearchIndex(): Promise<SearchEntry[]> {
  const restaurants = await allRestaurants();
  const names = new Map(restaurants.map((r) => [r.id, r.data.name]));
  const entries: SearchEntry[] = restaurants.map((r) => ({
    type: 'restaurace',
    title: r.data.name,
    sub: `Fiktivní restaurace · ${r.data.cuisine}`,
    url: `/restaurace/${r.id}/`,
    keywords: `${CATEGORY_LABELS[r.data.category]?.label ?? ''} ${r.data.tagline}`,
  }));
  for (const d of await allDishes()) {
    const restaurant = restaurants.find((r) => r.id === d.data.restaurant.id);
    entries.push({
      type: 'jidlo',
      title: d.data.name,
      sub: names.get(d.data.restaurant.id) ?? '',
      url: dishHasPage(d) ? `/jidla/${d.id}/` : `/restaurace/${d.data.restaurant.id}/`,
      keywords: `${restaurant?.data.cuisine ?? ''} ${CATEGORY_LABELS[restaurant?.data.category ?? '']?.label ?? ''} ${d.data.section}`,
    });
  }
  for (const r of await allRecipes())
    entries.push({
      type: 'recept',
      title: r.data.title,
      sub: 'Recept na doma',
      url: `/recepty/${r.id}/`,
      keywords: `recept ${CATEGORY_LABELS[r.data.category]?.label ?? ''}`,
    });
  return entries;
}

/** Estimated cost of consumed ingredients for one serving, in haléře (illustrative prices). */
export function perServingCost(recipe: Recipe, info: Record<string, IngredientInfo>): number {
  return Math.round(recipeCost(recipeLite(recipe).ingredients, recipe.data.servings, recipe.data.servings, info).consumed / recipe.data.servings);
}

/** Only the ingredients a recipe uses, to keep island props small. */
export function pickInfo(recipe: Recipe, info: Record<string, IngredientInfo>): Record<string, IngredientInfo> {
  const out: Record<string, IngredientInfo> = {};
  for (const i of recipe.data.ingredients) if (info[i.ingredient.id]) out[i.ingredient.id] = info[i.ingredient.id]!;
  return out;
}
