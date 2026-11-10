import { defineCollection, reference } from 'astro:content';
import { z } from 'astro/zod';
import { glob, file } from 'astro/loaders';

// Shape validation happens here at build time; cross-file rules (unique slugs, references,
// required recipes, existing images) are checked by scripts/validate-content.mjs.

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug: lower-case ASCII with hyphens');
const halere = z.number().int().nonnegative();

export const CATEGORIES = ['pizza', 'burgery', 'ceska-kuchyne', 'asie', 'kebab', 'vegetarianske'] as const;

const restaurants = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/restaurants' }),
  schema: z.object({
    name: z.string().min(2),
    category: z.enum(CATEGORIES),
    cuisine: z.string(),
    tagline: z.string(),
    description: z.string().min(40),
    /** Simulated delivery time in virtual minutes; the tracker uses the same number. */
    etaMinutes: z.number().int().min(10).max(90),
    deliveryFee: halere,
    cover: z.string(),
    sections: z.array(z.string()).min(1),
    order: z.number().int().default(100),
  }),
});

const option = z.object({ id: slug, name: z.string(), priceDelta: z.number().int() });
const optionGroup = z
  .object({
    id: slug,
    name: z.string(),
    type: z.enum(['single', 'multi']),
    required: z.boolean(),
    max: z.number().int().positive().optional(),
    options: z.array(option).min(1),
  })
  .refine((g) => !(g.type === 'multi' && g.required && g.options.length < 1), 'required multi group needs options');

const dishes = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/dishes' }),
  schema: z.object({
    name: z.string().min(2),
    restaurant: reference('restaurants'),
    kind: z.enum(['main', 'side', 'drink', 'dessert']),
    section: z.string(),
    description: z.string().min(20),
    /** Own paragraphs for the detail page (mains only). */
    about: z.array(z.string()).default([]),
    price: halere,
    image: z.string(),
    recipe: reference('recipes').nullable(),
    /** Which recipe variant matches this dish, shown next to the recipe link. */
    recipeNote: z.string().optional(),
    optionGroups: z.array(optionGroup).default([]),
    vegetarian: z.boolean().default(false),
    featured: z.boolean().default(false),
    order: z.number().int().default(100),
  }),
});

const UNITS = ['g', 'ml', 'ks', 'lzice', 'lzicka', 'spetka'] as const;

const recipes = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/data/recipes' }),
  schema: z.object({
    title: z.string().min(3),
    intro: z.string().min(60),
    image: z.string(),
    category: z.enum(CATEGORIES),
    servings: z.number().int().min(1).max(12),
    /** Hands-on work. */
    activeMinutes: z.number().int().positive(),
    /** Unattended heat: baking, simmering. */
    cookMinutes: z.number().int().nonnegative(),
    /** Unattended waiting: rising, resting, marinating. */
    waitMinutes: z.number().int().nonnegative().default(0),
    waitLabel: z.string().optional(),
    difficulty: z.enum(['snadné', 'střední', 'náročnější']),
    ingredients: z
      .array(
        z.object({
          ingredient: reference('ingredients'),
          amount: z.number().positive(),
          unit: z.enum(UNITS),
          note: z.string().optional(),
          group: z.string().optional(),
        }),
      )
      .min(3),
    steps: z.array(z.object({ section: z.string().optional(), text: z.string().min(20) })).min(3),
    tips: z.array(z.string()).default([]),
    substitutions: z.array(z.string()).default([]),
    vegetarian: z.boolean().default(false),
  }),
});

const ingredients = defineCollection({
  loader: file('src/data/ingredients.json'),
  schema: z.object({
    name: z.string(),
    department: z.enum([
      'Ovoce a zelenina',
      'Maso a ryby',
      'Mléčné a chlazené',
      'Pečivo',
      'Trvanlivé',
      'Koření a dochucovadla',
      'Ostatní',
    ]),
    baseUnit: z.enum(['g', 'ml', 'ks']),
    spoon: z.number().positive().optional(),
    /** price 0 = free (tap water): shown in recipes, left out of costs and shopping lists. */
    pack: z.object({ size: z.number().positive(), price: halere, label: z.string() }),
    /** "illustrative" = our estimate, not a quoted shop price. */
    priceSource: z.enum(['illustrative', 'verified']),
    priceCheckedAt: z.string().nullable(),
    staple: z.boolean().default(false),
  }),
});

const partners = defineCollection({
  loader: file('src/data/partners.json'),
  schema: z.object({
    name: z.string(),
    enabled: z.boolean(),
    linkType: z.enum(['none', 'homepage', 'search', 'cart-api']),
    url: z.url().nullable(),
    /** How list items are handed over; "none" until an integration is confirmed. */
    itemTransfer: z.enum(['none', 'search-per-item', 'cart-api']),
    affiliateParams: z.record(z.string(), z.string()).default({}),
    availabilityNote: z.string().default(''),
    verifiedAt: z.string().nullable(),
  }),
});

const assets = defineCollection({
  loader: file('src/data/assets.json'),
  schema: z.object({
    file: z.string(),
    kind: z.enum(['dish', 'restaurant', 'recipe', 'brand', 'og', 'illustration']),
    alt: z.string().min(5),
    source: z.enum(['wikimedia', 'canva', 'own']),
    sourceUrl: z.url().nullable(),
    author: z.string(),
    license: z.string(),
    licenseUrl: z.url().nullable(),
    /** Changes made to the original (crop, resize) – required by CC licences. */
    changes: z.string().default('ořez a zmenšení'),
    temporary: z.boolean().default(false),
  }),
});

export const collections = { restaurants, dishes, recipes, ingredients, partners, assets };
