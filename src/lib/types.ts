// Shared client-side shapes. Content schemas (Zod) live in src/content.config.ts and mirror these.

export type OptionGroupType = 'single' | 'multi';

export interface DishOption {
  id: string;
  name: string;
  /** Price change in haléře; may be 0. */
  priceDelta: number;
}

export interface DishOptionGroup {
  id: string;
  name: string;
  type: OptionGroupType;
  required: boolean;
  /** For multi groups: maximum number of selected options. */
  max?: number;
  options: DishOption[];
}

/** The slice of a dish the cart needs. Prices are simulated and in haléře. */
export interface CatalogDish {
  id: string;
  slug: string;
  name: string;
  restaurantId: string;
  price: number;
  image: string;
  recipe: string | null;
  /** Dishes without a detail page (sides, drinks) have page=false. */
  page: boolean;
  optionGroups: DishOptionGroup[];
}

export interface CatalogRestaurant {
  id: string;
  slug: string;
  name: string;
  /** Simulated delivery time in virtual minutes. */
  etaMinutes: number;
  /** Simulated delivery fee in haléře. */
  deliveryFee: number;
  /** Simulated minimum food value, haléře. */
  minOrder: number;
  pickup: boolean;
  hours: { open: string; close: string };
  promo: Promo | null;
}

export type Promo =
  | { type: 'free-delivery'; label: string }
  | { type: 'percent'; label: string; percent: number; minSubtotal: number };

export type FulfilmentMode = 'delivery' | 'pickup';

/** Choices made in the checkout that change the simulated price. */
export interface CheckoutOptions {
  mode: FulfilmentMode;
  /** Simulated tip for the (non-existent) courier, haléře. Delivery only. */
  tip: number;
  /** Simulated promo code, validated against PROMO_CODES. */
  code: string | null;
}

export interface Catalog {
  dishes: Record<string, CatalogDish>;
  restaurants: Record<string, CatalogRestaurant>;
}

/** groupId -> selected option ids */
export type Choices = Record<string, string[]>;

export interface CartItem {
  /** Stable key of dish + configuration; identical configurations merge. */
  key: string;
  dishId: string;
  qty: number;
  choices: Choices;
}

export interface Cart {
  v: 1;
  restaurantId: string | null;
  items: CartItem[];
}

export interface Totals {
  subtotal: number;
  delivery: number;
  fee: number;
  /** Restaurant promotion + promo code, haléře (positive number, subtracted). */
  discount: number;
  tip: number;
  total: number;
  count: number;
  /** Food value still missing to reach the restaurant's minimum, 0 when reached. */
  missingToMin: number;
  /** Labels of the discounts that were applied, for the summary. */
  applied: string[];
}

export interface OrderLine {
  dishId: string;
  dishSlug: string;
  page: boolean;
  name: string;
  qty: number;
  unitPrice: number;
  options: string[];
  recipe: string | null;
  image: string;
}

/** Immutable copy of what was "ordered". Later catalogue changes never alter it. */
export interface OrderSnapshot {
  v: 1;
  id: string;
  createdAt: number;
  city: string;
  dropPoint: string;
  restaurant: { id: string; slug: string; name: string; etaMinutes: number };
  lines: OrderLine[];
  totals: Totals;
  mode: FulfilmentMode;
  /** Label of the chosen demo payment tile. */
  payment: string;
  /** Preset note for the courier (no free text, so no personal data). */
  courierNote: string | null;
  skippedAt: number | null;
  cancelledAt: number | null;
  /** Door opened (delivery) or bag collected (pickup); null while the courier is on the way or waiting. */
  openedAt: number | null;
  /** Real-time multiplier: 1 since 11. 11. 2026, 10 for older orders. */
  speed: number;
}

export type Unit = 'g' | 'ml' | 'ks' | 'lzice' | 'lzicka' | 'spetka';
export type BaseUnit = 'g' | 'ml' | 'ks';

export interface IngredientInfo {
  id: string;
  name: string;
  department: string;
  baseUnit: BaseUnit;
  /** Grams (or ml) in one tablespoon; a teaspoon is a third of it. */
  spoon?: number;
  pack: { size: number; price: number; label: string };
  /** Always "illustrative" until a verified shop feed exists. */
  priceSource: 'illustrative' | 'verified';
  priceCheckedAt: string | null;
  /** Pantry staples (salt, oil…) are pre-marked as probably at home in hints only. */
  staple?: boolean;
  /** Recipe-filter facets (vegetarian/vegan, allergens, main-ingredient group); see src/lib/recipe-facets.ts. */
  diet?: string;
  allergens?: number[];
  family?: string;
  alcohol?: boolean;
}

export interface RecipeIngredient {
  ingredient: string;
  amount: number;
  unit: Unit;
  note?: string;
  group?: string;
}

export interface RecipeLite {
  slug: string;
  title: string;
  servings: number;
  ingredients: RecipeIngredient[];
}

export interface ShoppingState {
  v: 1;
  recipes: { slug: string; servings: number }[];
  have: Record<string, true>;
  checked: Record<string, true>;
}
