# CLAUDE.md — DámeNic (damenic.cz)

Czech food-delivery **simulator**: fictional restaurants, order "nanečisto" for 0 Kč, a fake courier on an illustrative map,
then a real recipe, cost estimate and shopping list. Public repo `HuyKenny/damenic`. Talk to Kenny in Czech; code/commits in English.

## ⚠️ Buildy, instalace závislostí, testy a zpracování obrázků nesmějí běžet na Raspberry Pi.
The working copy lives on a Raspberry Pi with little RAM and an SD card. On the Pi only edit files, run
`node scripts/validate-content.mjs` (no dependencies) and use git. **No** `npm install/ci`, `astro build`, Playwright,
Docker, dev server, image batch processing or self-hosted runner. Everything heavy runs on GitHub-hosted runners:
- `ci.yml` — every PR and push to `main`: secret check, content validation, `astro check`, ESLint, Vitest, build,
  Playwright e2e, screenshots (artifact `test-output`, 3 days). `main` then deploys.
- `lockfile.yml` (manual) — regenerates `package-lock.json` on a runner after changing `package.json`.
Read results with `gh run view --repo HuyKenny/damenic`, download screenshots with `gh run download -n test-output`.

## Non-negotiable product rules
- It must be obvious from the first screen that this is a simulation ("Simulace rozvozu. Žádné skutečné platby ani doručení.").
- No payment gateway, no card/bank/personal fields, no real restaurants, couriers or orders, no link to Foodora/DámeJídlo.
- No fake reviews/ratings, no LocalBusiness/Offer schema for fictional places, no invented operator details (the real ones, Kenny's, are in about/privacy/footer since 11. 11. 2026: Ha Duy Huy, IČO 07876823).
- Ingredient prices are **illustrative** (`priceSource: "illustrative"`) until a verified shop feed exists. Never call them current.
- Keep the three cost figures apart: simulated delivery value / consumed ingredients / whole packs. A negative difference is shown as such.
- Affiliate partners stay `enabled: false` until an integration is confirmed; never show `#` buttons. Rohlik.cz is enabled via the short path `/go/rohlik`
  (302 in `public/_redirects`, Disallow in robots; static CJ link supplied by Kenny, 11. 11. 2026): `PartnerCta.astro` on recipes and the shopping list, always `rel="sponsored"`,
  always with the visible "Reklama / skutečný obchod" note; no item transfer, no logo.
- The only real contact is `info@damenic.cz` (`src/lib/contact.ts`, Kenny 11. 11. 2026), only as a mailto link: no contact form.
  Courier copy (pun names, "Právě teď" lines, canned chat replies) lives in `src/islands/Tracker.tsx`; keep a visible "smyšlená postava".

## v2 (11. 11. 2026): delivery-app redesign
- Look: Wolt/Foodora patterns in DámeNic red: Canva logo/icons/illustrations in `src/assets/brand/` (logo retraced as SVG in
  `src/components/Logo.astro` and `public/favicon.svg`), Bricolage Grotesque + Figtree, pink #FFE9EA surfaces, yellow stickers.
- 44 fictional restaurants in 15 cuisines (`CATEGORIES` in `src/content.config.ts`), ~440 menu items with EU allergens,
  ~125 recipes. Restaurants carry simulated `minOrder`, `priceLevel`, `hours` (Prague time), `pickup`, `tags`, `promo`, `logo`.
- Filters/sorting: `src/lib/filters.ts` + island `RestaurantBrowser` (state in the query string, canonical stays /restaurace/).
  No rating filter: the restaurants are fictional and have no real ratings.
- Pricing: `totals(cart, catalog, opts)` in `src/lib/cart.ts` handles pickup, tip, restaurant promos, promo codes (NIC, NANECISTO),
  minimum order. Checkout options live in `$checkout` (`src/lib/stores.ts`).
- Photos: Pexels records in `src/data/assets.json` with `downloadUrl`; CI downloads them (`scripts/fetch-photos.mjs`, cached).
  Do not commit Pexels files. Old Wikimedia photos still live in `src/assets/photos/` in git.
- SEO: recipe hubs `/recepty/kuchyne/<id>/`, `/recepty/rychle/`, `/recepty/bez-masa/` (`src/lib/hubs.ts`), own sitemaps
  (`src/pages/sitemap-*.xml.ts`, git lastmod, recipe images), one indexed dish page per recipe (`primaryDishForRecipe`).
- Tests pin the browser clock to Prague noon (`atNoon`) because restaurants have opening hours.

## v3.1 (14. 11. 2026): holidays, drinks, cakes
- 340 recipes, 65 restaurants. Occasions (`src/lib/occasions.ts`, recipe `occasions`) give hubs `/recepty/prilezitosti/<id>/` and a
  seasonal rail; CI rebuilds weekly so the season follows the calendar. Categories `koktejly` and `dorty` added.
- Alcohol: flag the ingredient (`alcohol: true`), set the recipe's `alcohol`, always add a non-alcoholic substitution; places
  selling alcohol say 18+. Never joke about drinking.
- Content agents write new ingredients to `src/data/_extra/<batch>.json`; merge them into `ingredients.json` before committing
  (CI builds without `_extra`). Recipes linked from a dish reuse the dish photo.

Voice: `COPY_GUIDE.md` (creative, simulation always obvious, recipes are facts). Restaurant descriptions must contain "smyšlen" or "fiktivn" (validator).

## Security / SEO guardrails (v2.5)
- Analytics only with consent: GTM (`GTM_ID`) is injected by `Consent.tsx` after "Povolit"; never add a Google/third-party script to the HTML directly.
- Strict CSP (Astro `security.csp` + `public/_headers`). New inline scripts or third-party origins must keep `tests/e2e/csp.spec.ts` green; never
  add `'unsafe-inline'` to script-src. Inline `style=""` attributes are allowed (style-src-attr).
- `scripts/seo-audit.mjs` gates CI: indexable pages need one h1, self canonical, sitemap entry; no broken internal links; no `kqzyfj` in HTML.
- Wrangler does not upload dot folders (`.well-known`): use redirects.
- Zone settings (HTTPS, TLS, WAF, DNSSEC) are in `scripts/damenic/cloudflare-hardening.py` in the workspace.

## Architecture
- Astro 7 static output, no adapter, Preact islands only where interactive, nanostores for shared state (`src/lib/stores.ts`).
- Content: JSON in `src/data/` validated by Zod (`src/content.config.ts`) and by `scripts/validate-content.mjs` (cross-file rules).
- Browser state: versioned localStorage keys in `src/lib/storage.ts`; every reader validates and falls back.
- Money: integer haléře everywhere (`src/lib/money.ts`).
- Simulation: `src/lib/simulation.ts` derives state from `createdAt` + `etaMinutes` + the order's `speed`; nothing is written per tick.
  Since 11. 11. 2026 tracking runs in **real time** (`speed: 1`, Kenny's choice); orders saved earlier load with `speed: 10` and
  `openedAt = createdAt`. The run ends at `atDoor` (doorbell via Web Audio, once per tab session, toggle `damenic:bell:v1`);
  `openDoor` sets `openedAt` and only then the finale shows. `HeaderCart` shows the active order pill on every page.
- Orders: `/objednavka/#<id>`, immutable snapshot (`src/lib/orders.ts`), max 20, 90-day expiry.
- Hosting: Cloudflare Workers Static Assets (`wrangler.jsonc`, no `main` = no Worker code, no billed requests). No D1/KV/cron.
- Photos: records in `src/data/assets.json` (see ASSETS.md): ~415 from Pexels (downloaded in CI, never in git) plus the older
  Wikimedia Commons set in `src/assets/photos/`. Optimised by Astro at build time on the runner. Pexels `downloadUrl` must come
  from the API `src` (some originals are PNG → add `&fm=jpg`); guessing `pexels-photo-<id>.jpeg` gives 404.

Docs: IMPLEMENTATION_STATUS.md, ASSETS.md, DEPLOYMENT.md, CONTENT_GUIDE.md.
