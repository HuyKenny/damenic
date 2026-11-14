// Build-time helpers over the content collections. Never import this from an island.
import { getCollection, type CollectionEntry } from 'astro:content';
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import type { Catalog, IngredientInfo, RecipeLite } from './types';
import type { SearchEntry } from './search';
import { CATEGORY_LABELS } from './site';
import { recipeCost } from './costs';
import type { RestaurantSummary } from './filters';
import { SYNONYMS, deriveFacets, foldText, type IngredientFacetInfo, type RecipeSummary } from './recipe-facets';
import { toBase } from './units';

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
    catalog.restaurants[r.id] = {
      id: r.id,
      slug: r.id,
      name: r.data.name,
      etaMinutes: r.data.etaMinutes,
      deliveryFee: r.data.deliveryFee,
      minOrder: r.data.minOrder,
      pickup: r.data.pickup,
      hours: r.data.hours,
      promo: r.data.promo ?? null,
    };
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

// ---------- v2: restaurant summaries and category icons for the browser island ----------

const brandFiles = import.meta.glob<ImageMetadata>('/src/assets/brand/*.png', { eager: true, import: 'default' });
export function brand(name: string): ImageMetadata | null {
  return brandFiles[`/src/assets/brand/${name}.png`] ?? null;
}

const SVG_ICONS = new Set(['kavarna', 'matcha', 'pekarna', 'zmrzlina', 'napoje', 'kure', 'steak', 'salaty', 'polevky', 'sendvice', 'koktejly', 'dorty']);

export interface CategoryIcon {
  id: string;
  label: string;
  src: string;
  count: number;
}

let iconsMemo: Promise<CategoryIcon[]> | null = null;
/** Categories that have at least one restaurant, with a small optimised icon. */
export function categoryIcons(): Promise<CategoryIcon[]> {
  return (iconsMemo ??= (async () => {
    const restaurants = await allRestaurants();
    const out: CategoryIcon[] = [];
    for (const [id, c] of Object.entries(CATEGORY_LABELS)) {
      const count = restaurants.filter((r) => r.data.category === id).length;
      const meta = brand(`cat-${id}`);
      // Newer categories ship a hand-drawn SVG from public/icons (no image processing needed).
      if (!count || (!meta && !SVG_ICONS.has(id))) continue;
      out.push({ id, label: c.label, count, src: meta ? (await getImage({ src: meta, width: 112, height: 112, format: 'webp', quality: 80 })).src : `/icons/cat-${id}.svg` });
    }
    return out;
  })());
}

let summariesMemo: Promise<RestaurantSummary[]> | null = null;
export function restaurantSummaries(): Promise<RestaurantSummary[]> {
  return (summariesMemo ??= (async () => {
    const out: RestaurantSummary[] = [];
    for (const r of await allRestaurants()) {
      const p = await photo(r.data.cover);
      let img: RestaurantSummary['img'] = null;
      if (p.meta) {
        const widths = [360, 540, 720].filter((w) => w <= p.meta!.width);
        const set = await Promise.all(widths.map((w) => getImage({ src: p.meta!, width: w, height: Math.round((w * 9) / 16), fit: 'cover', format: 'webp', quality: 70 })));
        img = { src: set[0]!.src, srcset: set.map((s, i) => `${s.src} ${widths[i]}w`).join(', '), width: 360, height: 203, alt: p.alt };
      }
      out.push({
        id: r.id,
        name: r.data.name,
        category: r.data.category,
        categoryLabel: CATEGORY_LABELS[r.data.category]?.label ?? '',
        cuisine: r.data.cuisine,
        etaMinutes: r.data.etaMinutes,
        deliveryFee: r.data.deliveryFee,
        minOrder: r.data.minOrder,
        priceLevel: r.data.priceLevel,
        hours: r.data.hours,
        pickup: r.data.pickup,
        tags: r.data.tags,
        promoLabel: r.data.promo?.label ?? null,
        freeDelivery: r.data.deliveryFee === 0 || r.data.promo?.type === 'free-delivery',
        isNew: r.data.isNew,
        order: r.data.order,
        logo: r.data.logo,
        img,
      });
    }
    return out;
  })());
}

/** Dish pages: when several restaurants point to the same recipe, only the first one is indexed. */
export async function primaryDishForRecipe(): Promise<Map<string, string>> {
  const restaurants = new Map((await allRestaurants()).map((r, i) => [r.id, i]));
  const mains = (await allDishes()).filter((d) => d.data.kind === 'main' && d.data.recipe);
  mains.sort((a, b) => (restaurants.get(a.data.restaurant.id) ?? 0) - (restaurants.get(b.data.restaurant.id) ?? 0) || a.data.order - b.data.order);
  const out = new Map<string, string>();
  for (const d of mains) if (!out.has(d.data.recipe!.id)) out.set(d.data.recipe!.id, d.id);
  return out;
}

// ---------- v3.2: recipe index for the filter island (static JSON, see src/pages/data/recipes.json.ts) ----------

let recipeIndexMemo: Promise<{ recipes: RecipeSummary[]; ingredients: { id: string; name: string }[] }> | null = null;
export function recipeIndex(): Promise<{ recipes: RecipeSummary[]; ingredients: { id: string; name: string }[] }> {
  return (recipeIndexMemo ??= (async () => {
    const info = await ingredientInfo();
    const facetInfo: Record<string, IngredientFacetInfo> = {};
    for (const [id, i] of Object.entries(info)) facetInfo[id] = { diet: i.diet ?? 'plant', allergens: i.allergens ?? [], ...(i.family ? { family: i.family } : {}), baseUnit: i.baseUnit, ...(i.staple ? { staple: true } : {}) };
    const used = new Map<string, number>();
    const recipes: RecipeSummary[] = [];
    for (const r of await allRecipes()) {
      const p = await photo(r.data.image);
      let img: RecipeSummary['img'] = null;
      if (p.meta) {
        const widths = [280, 420, 560].filter((w) => w <= p.meta!.width);
        const set = await Promise.all((widths.length ? widths : [p.meta.width]).map((w) => getImage({ src: p.meta!, width: w, height: Math.round(w / 1.6), fit: 'cover', format: 'webp', quality: 72 })));
        img = { src: set[0]!.src, srcset: set.map((s, i) => `${s.src} ${(widths.length ? widths : [p.meta!.width])[i]}w`).join(', '), alt: p.alt };
      }
      const lite = recipeLite(r);
      const f = deriveFacets(
        {
          steps: r.data.steps.map((s) => s.text),
          cookMinutes: r.data.cookMinutes,
          alcohol: r.data.alcohol ?? false,
          ingredients: r.data.ingredients.map((i) => ({ id: i.ingredient.id, base: info[i.ingredient.id] ? (toBase(i.amount, i.unit, info[i.ingredient.id]!) ?? 0) : 0 })),
        },
        facetInfo,
      );
      const ing = [...new Set(lite.ingredients.map((i) => i.ingredient))].filter((id) => !info[id]?.staple && info[id]?.pack.price !== 0);
      for (const id of ing) used.set(id, (used.get(id) ?? 0) + 1);
      recipes.push({
        id: r.id,
        title: r.data.title,
        q: foldText(
          [
            r.data.title,
            r.data.keywords.join(' '),
            CATEGORY_LABELS[r.data.category]?.label ?? '',
            r.data.occasions.join(' '),
            lite.ingredients.map((i) => info[i.ingredient]?.name ?? '').join(' '),
            f.family ? SYNONYMS[f.family] ?? '' : '',
            f.diets.filter((d) => d === 'veg' || d === 'vegan' || d === 'gf' || d === 'lf').map((d) => SYNONYMS[d] ?? '').join(' '),
          ].join(' '),
        ),
        category: r.data.category,
        categoryLabel: CATEGORY_LABELS[r.data.category]?.label ?? '',
        meal: r.data.meal,
        family: f.family,
        min: totalMinutes(r),
        act: r.data.activeMinutes,
        difficulty: r.data.difficulty,
        servings: r.data.servings,
        diets: f.diets,
        methods: f.methods,
        alcohol: r.data.alcohol ?? false,
        occasions: r.data.occasions,
        cost: Math.round(perServingCost(r, info) / 100),
        ing,
        w: Math.min(r.data.faq.length, 3) + Math.min(r.data.tips.length, 4) + Math.min(r.data.substitutions.length, 3) + (img ? 3 : 0) + Math.min(r.data.keywords.length, 3),
        img,
      });
    }
    // the "what do I have at home" picker offers ingredients that appear in at least 3 recipes
    const ingredients = [...used.entries()].filter(([, n]) => n >= 3).map(([id]) => ({ id, name: info[id]!.name })).sort((a, b) => a.name.localeCompare(b.name, 'cs'));
    return { recipes, ingredients };
  })());
}
