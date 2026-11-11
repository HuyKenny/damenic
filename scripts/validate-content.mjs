// Cross-file content rules that a per-file schema cannot express.
// Shapes are validated by Zod in src/content.config.ts during `astro build`; this runs first and fails fast.
// Usage: node scripts/validate-content.mjs            (missing photos = warnings)
//        STRICT_ASSETS=1 node scripts/validate-content.mjs   (missing or temporary photos = errors)
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA = 'src/data';
const PHOTOS = 'src/assets/photos';
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const strict = process.env.STRICT_ASSETS === '1';
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);

function readDir(dir) {
  const out = new Map();
  for (const f of readdirSync(join(DATA, dir)).filter((f) => f.endsWith('.json'))) {
    const id = f.slice(0, -5);
    if (!SLUG.test(id)) err(`${dir}/${f}: file name must be a lower-case ASCII slug`);
    try {
      out.set(id, JSON.parse(readFileSync(join(DATA, dir, f), 'utf8')));
    } catch (e) {
      err(`${dir}/${f}: invalid JSON (${e.message})`);
    }
  }
  return out;
}
function readList(file) {
  const list = JSON.parse(readFileSync(join(DATA, file), 'utf8'));
  const out = new Map();
  for (const item of list) {
    if (out.has(item.id)) err(`${file}: duplicate id "${item.id}"`);
    if (!SLUG.test(item.id ?? '')) err(`${file}: bad id "${item.id}"`);
    out.set(item.id, item);
  }
  return out;
}

const restaurants = readDir('restaurants');
const dishes = readDir('dishes');
const recipes = readDir('recipes');
const ingredients = readList('ingredients.json');
// Work-in-progress ingredient lists (src/data/_extra/*.json) count while content is being written; they must be merged before release.
if (existsSync(join(DATA, '_extra')))
  for (const f of readdirSync(join(DATA, '_extra')).filter((f) => f.endsWith('.json'))) {
    if (strict) err(`_extra/${f}: merge into ingredients.json before release`);
    for (const [id, item] of readList(join('_extra', f))) {
      if (ingredients.has(id)) err(`_extra/${f}: ingredient "${id}" already exists`);
      ingredients.set(id, item);
    }
  }
const assets = readList('assets.json');
const partners = readList('partners.json');

const isMoney = (n) => Number.isInteger(n) && n >= 0;
const UNITS = new Set(['g', 'ml', 'ks', 'lzice', 'lzicka', 'spetka']);

function checkAsset(owner, id) {
  const asset = assets.get(id);
  if (!asset) return (strict ? err : (m) => warnings.push(m))(`${owner}: no asset record "${id}" (placeholder will be shown)`);
  if (!existsSync(join(PHOTOS, asset.file)) && !asset.downloadUrl) err(`${owner}: asset "${id}" points to a missing file ${asset.file}`);
  if (asset.temporary && strict) err(`${owner}: asset "${id}" is still marked temporary`);
}

// Dishes and recipes share the /jidla/ and /recepty/ namespaces separately, but a dish and a restaurant id may not collide in search.
for (const [id, r] of restaurants) {
  if (!isMoney(r.deliveryFee)) err(`restaurant ${id}: deliveryFee must be a non-negative integer (haléře)`);
  const CATS = ['pizza', 'burgery', 'ceska', 'asijska', 'sushi', 'thajska', 'indicka', 'mexicka', 'kebab', 'italska', 'vegetarianska', 'poke', 'palacinky', 'dezerty', 'snidane'];
  if (!CATS.includes(r.category)) err(`restaurant ${id}: unknown category "${r.category}"`);
  if (!isMoney(r.minOrder ?? 0)) err(`restaurant ${id}: minOrder must be a non-negative integer (haléře)`);
  if (![1, 2, 3].includes(r.priceLevel)) err(`restaurant ${id}: priceLevel must be 1, 2 or 3`);
  const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!r.hours || !HM.test(r.hours.open) || !HM.test(r.hours.close)) err(`restaurant ${id}: hours.open/close must be HH:MM`);
  if (!r.logo || !r.logo.text || !/^#[0-9A-Fa-f]{6}$/.test(r.logo.color ?? '')) err(`restaurant ${id}: logo {text, color} required`);
  if (r.promo && !['free-delivery', 'percent'].includes(r.promo.type)) err(`restaurant ${id}: unknown promo type`);
  if (!/fiktivn|smyšlen/i.test(r.description)) err(`restaurant ${id}: description must say the restaurant is fictional`);
  if (!(r.etaMinutes >= 10 && r.etaMinutes <= 90)) err(`restaurant ${id}: etaMinutes out of range`);
  checkAsset(`restaurant ${id}`, r.cover);
  const mine = [...dishes].filter(([, d]) => d.restaurant === id);
  if (mine.filter(([, d]) => d.kind === 'main').length < 3) err(`restaurant ${id}: needs at least 3 main dishes`);
  for (const [did, d] of mine) if (!r.sections.includes(d.section)) err(`dish ${did}: section "${d.section}" is not listed in restaurant ${id}`);
  for (const s of r.sections) if (!mine.some(([, d]) => d.section === s)) err(`restaurant ${id}: section "${s}" has no dishes`);
}

const names = new Map();
for (const [id, d] of dishes) {
  if (!restaurants.has(d.restaurant)) err(`dish ${id}: unknown restaurant "${d.restaurant}"`);
  if (!isMoney(d.price) || d.price === 0) err(`dish ${id}: price must be a positive integer (haléře)`);
  if (d.price % 100 !== 0) err(`dish ${id}: price should be whole crowns`);
  if (d.kind === 'main') {
    if (!d.recipe) err(`dish ${id}: every main dish needs a recipe`);
    if (!Array.isArray(d.about) || d.about.length < 2) err(`dish ${id}: main dishes need at least 2 "about" paragraphs for their page`);
  }
  if (d.recipe && !recipes.has(d.recipe)) err(`dish ${id}: unknown recipe "${d.recipe}"`);
  const key = `${d.restaurant}|${d.name}`;
  if (names.has(key)) err(`dish ${id}: same name as ${names.get(key)} in one restaurant`);
  names.set(key, id);
  checkAsset(`dish ${id}`, d.image);
  for (const al of d.allergens ?? []) if (!Number.isInteger(al) || al < 1 || al > 14) err(`dish ${id}: allergen ${al} must be 1–14`);
  if (d.spicy !== undefined && ![0, 1, 2, 3].includes(d.spicy)) err(`dish ${id}: spicy must be 0–3`);
  if (d.vegan && !d.vegetarian) err(`dish ${id}: vegan dishes must also be vegetarian`);
  const groupIds = new Set();
  for (const g of d.optionGroups ?? []) {
    if (groupIds.has(g.id)) err(`dish ${id}: duplicate option group "${g.id}"`);
    groupIds.add(g.id);
    const optIds = new Set();
    for (const o of g.options) {
      if (optIds.has(o.id)) err(`dish ${id}: duplicate option "${o.id}" in group "${g.id}"`);
      optIds.add(o.id);
      if (!Number.isInteger(o.priceDelta)) err(`dish ${id}: option ${o.id} priceDelta must be an integer`);
      if (d.price + o.priceDelta < 0) err(`dish ${id}: option ${o.id} would make the price negative`);
    }
    if (g.required && g.type === 'single' && g.options.length < 2) err(`dish ${id}: required group "${g.id}" needs at least 2 options`);
    if (g.max !== undefined && g.type !== 'multi') err(`dish ${id}: "max" only applies to multi groups`);
  }
}

for (const [id, r] of recipes) {
  if (!(r.activeMinutes > 0)) err(`recipe ${id}: activeMinutes must be positive`);
  const total = r.activeMinutes + r.cookMinutes + (r.waitMinutes ?? 0);
  if (total < 10 || total > 60 * 30) err(`recipe ${id}: total time ${total} min looks wrong`);
  if ((r.waitMinutes ?? 0) > 0 && !r.waitLabel) err(`recipe ${id}: waitMinutes needs a waitLabel (what is being waited for)`);
  checkAsset(`recipe ${id}`, r.image);
  for (const i of r.ingredients) {
    const ing = ingredients.get(i.ingredient);
    if (!ing) {
      err(`recipe ${id}: unknown ingredient "${i.ingredient}"`);
      continue;
    }
    if (!UNITS.has(i.unit)) err(`recipe ${id}: unknown unit "${i.unit}"`);
    if (!(i.amount > 0)) err(`recipe ${id}: ${i.ingredient} amount must be positive`);
    const spoonUnit = i.unit === 'lzice' || i.unit === 'lzicka';
    const convertible =
      i.unit === ing.baseUnit ||
      (spoonUnit && (ing.baseUnit === 'ml' || (ing.baseUnit === 'g' && ing.spoon))) ||
      (i.unit === 'spetka' && ing.baseUnit !== 'ks');
    if (!convertible) err(`recipe ${id}: ${i.ingredient} is given in "${i.unit}" but is sold by "${ing.baseUnit}"${spoonUnit ? ' and has no spoon weight' : ''}`);
  }
  if (![...dishes.values()].some((d) => d.recipe === id)) warnings.push(`recipe ${id}: not linked from any dish`);
}

for (const [id, i] of ingredients) {
  if (!isMoney(i.pack?.price)) err(`ingredient ${id}: pack price must be a non-negative integer (haléře)`);
  if (!(i.pack?.size > 0)) err(`ingredient ${id}: pack size must be positive`);
  if (i.priceSource === 'verified' && !i.priceCheckedAt) err(`ingredient ${id}: verified price needs priceCheckedAt`);
  if (i.priceSource === 'illustrative' && i.priceCheckedAt) err(`ingredient ${id}: illustrative price must not carry a check date`);
}

for (const [id, a] of assets) {
  for (const k of ['file', 'kind', 'alt', 'source', 'author', 'license']) if (!a[k]) err(`asset ${id}: missing "${k}"`);
  if (a.source !== 'own' && !a.sourceUrl) err(`asset ${id}: sourceUrl is required for ${a.source}`);
  if (a.source === 'pexels' && !/^https:\/\/images\.pexels\.com\//.test(a.downloadUrl ?? '')) err(`asset ${id}: pexels assets need a downloadUrl on images.pexels.com`);
}

for (const [id, p] of partners) {
  if (p.enabled && (!p.url || !p.verifiedAt || p.linkType === 'none')) err(`partner ${id}: enabled partners need a verified url, verifiedAt and a link type`);
  if (p.enabled && p.url && !/^https:\/\//.test(p.url)) err(`partner ${id}: enabled partners need an https url`);
  if (p.enabled) {
    const redirects = existsSync(new URL('../public/_redirects', import.meta.url)) ? readFileSync(new URL('../public/_redirects', import.meta.url), 'utf8') : '';
    if (!redirects.split('\n').some((l) => l.trim().startsWith(`/go/${id} `) && l.includes(p.url))) err(`partner ${id}: public/_redirects needs "/go/${id} <url> 302"`);
  }
}

const mains = [...dishes.values()].filter((d) => d.kind === 'main').length;
console.log(`restaurants ${restaurants.size}, dishes ${dishes.size} (main ${mains}), recipes ${recipes.size}, ingredients ${ingredients.size}, assets ${assets.size}`);
for (const w of warnings.slice(0, 80)) console.log('warn: ' + w);
if (warnings.length > 80) console.log(`… and ${warnings.length - 80} more warnings`);
if (errors.length) {
  console.error(errors.map((e) => 'ERROR: ' + e).join('\n'));
  process.exit(1);
}
console.log('validate-content: OK');
