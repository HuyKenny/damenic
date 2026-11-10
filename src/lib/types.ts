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
  total: number;
  count: number;
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
  skippedAt: number | null;
  cancelledAt: number | null;
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
