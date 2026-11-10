# Implementation status

Updated: 2026-11-10. Only results that actually ran are recorded here.

## Done (code written)
- Catalogue: 6 fictional restaurants, 30 main dishes with options, sides and drinks, 30 recipes, 160 ingredients with illustrative prices.
- Full flow: restaurant → dish with validated options → cart (one restaurant, confirm before replacing, merge identical lines,
  edit options/quantity) → checkout without any personal or payment field → one immutable local order → tracker
  (6 stages, 10× speed, SVG map with moving courier, skip/cancel, refresh-safe) → finale with cost comparison → recipe → shopping list.
- Recipes: portion switcher, split times, three cost figures, print styles, Recipe JSON-LD from visible content only.
- Shopping list: merges ingredients across recipes in base units, departments, "Mám doma", ticking, copy, print, persistence.
- Search without diacritics, sample city picker, order history (max 20, 90 days), wipe-local-data button.
- SEO: titles/descriptions, canonical, sitemap without private pages, noindex on local-state pages, breadcrumbs + BreadcrumbList, OG image, 404.
- Tests written: Vitest unit tests (cart, simulation, orders, costs, units, shopping list, storage) and Playwright e2e + screenshot run.

## Verification
Pending first CI run. See GitHub Actions for results.

## Blocked / needs Kenny
- Operator name and contact for `/o-projektu/` and `/soukromi/` (condition for a public launch; not invented).
- Shop/affiliate partner for the shopping list: none confirmed, module stays disabled.

## Assets
- Food photos: Wikimedia Commons, curated per dish (see `src/data/assets.json`).
- Logo, favicon, OG image and illustrations: own vector/PIL drawings in the repo. Canva was connected late in the session and not used yet.
