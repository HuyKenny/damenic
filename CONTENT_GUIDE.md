# Content guide

All content is JSON in `src/data/`. After any change run `node scripts/validate-content.mjs` (works on the Pi, no install).
CI runs it again plus the Zod schemas in `src/content.config.ts`. Prices are integers in **haléře** (219 Kč = `21900`).

## Add a dish
1. Create `src/data/dishes/<slug>.json` (lower-case ASCII slug, unique across all restaurants; sides/drinks get a restaurant suffix).
2. Required: `name`, `restaurant` (restaurant file id), `kind` (`main` | `side` | `drink` | `dessert`), `section` (must be in the
   restaurant's `sections`), `description`, `price`, `image` (`dish-<slug>`), `recipe` (recipe id or `null`).
3. A `main` dish must have a `recipe` and two `about` paragraphs; it gets its own page `/jidla/<slug>/`.
4. Options: `optionGroups[]` with `type` `single` (radio) or `multi` (checkbox, optional `max`), `required`, and `options[]`
   with `priceDelta` in haléře. A required single group needs at least two options.
5. Add a photo (see ASSETS.md); without one a neutral placeholder is shown and the validator warns.

## Add a recipe
1. Create `src/data/recipes/<slug>.json`; link it from the dish's `recipe`.
2. Times are honest and split: `activeMinutes` (hands-on), `cookMinutes` (unattended heat), `waitMinutes` + `waitLabel`
   (rising, marinating, cooling).
3. `ingredients[]`: `ingredient` (id from `src/data/ingredients.json`), `amount`, `unit` (`g`, `ml`, `ks`, `lzice`, `lzicka`, `spetka`),
   optional `note` and `group`. Spoons need the ingredient's `spoon` weight unless it is sold in ml.
4. `steps[]` with optional `section`, plus `tips` and `substitutions`.
5. Do not write personal experience, "tested" claims, ratings, nutrition values or health claims. Write your own text.

## Add an ingredient
Append to `src/data/ingredients.json`: `id`, `name`, `department` (one of the seven shop departments), `baseUnit`,
`pack: { size, price, label }`, `priceSource: "illustrative"`, `priceCheckedAt: null`, optional `spoon` (g per tablespoon) and `staple`.
Only set `priceSource: "verified"` with a real check date and source.

## Add a restaurant
`src/data/restaurants/<slug>.json`: `name`, `category`, `cuisine`, `tagline`, `description` (must say it is fictional),
`etaMinutes` (simulated, 10–90; the tracker uses it), `deliveryFee`, `cover` (`rest-<slug>`), `sections`, `order`.
At least three main dishes.

## Add a shop partner
`src/data/partners.json`. A partner is shown only when `enabled: true`, `url` is a verified link and `verifiedAt` is set.
Never invent affiliate IDs, API endpoints or "send the whole cart" features. Affiliate links get `rel="sponsored"` and a visible note.
