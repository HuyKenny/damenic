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

## Verification (actually run, 2026-11-10)
All on GitHub-hosted runners (`ubuntu-latest`); nothing was installed, built or tested on the Raspberry Pi.
- CI run 42908096817 and later: secret check, content validation, `astro check`, ESLint, build: pass.
- Vitest: 41 tests in 4 files pass (cart, simulation + orders, units/costs/shopping/search, storage fallback).
- Playwright e2e (Chromium): 20 tests pass: required options, quantity, distinct configurations, restaurant switch dialog,
  refresh persistence, empty cart, checkout without personal/payment fields, double click → one order, tracker with
  controlled clock (stage after refresh, finish once), skip, cancel, unknown order, recipe servings and costs, Recipe JSON-LD
  without ratings, shopping list merge + "Mám doma" + persistence, search without diacritics + empty state, corrupted
  storage, dropped catalogue item, blocked storage, real 404, noindex/canonical, wiping local data, mobile overflow/menu/cart bar.
- Screenshots at 360/390/768/1440 px for 9 screens reviewed by eye. Fixed from them: mobile grid overflow (31 px), gap under
  the simulation strip, finale appearing only on the next tick after skip, add button wrapping at 360 px, DEMO stamp over
  card text, recipe tools clickable before hydration, oversized hero.
- Lighthouse 13, mobile profile, lab data against https://damenic.cz (run `lighthouse`):

  | Page | Perf | A11y | Best | SEO | LCP | CLS |
  |---|---|---|---|---|---|---|
  | / | 98 | 100 | 100 | 100 | 1.8 s | 0 |
  | /restaurace/prazdna-pec/ | 98 | 100 | 100 | 100 | 1.8 s | 0.052 |
  | /jidla/svickova-na-smetane/ | 99 | 96 → fixed (button contrast) | 100 | 100 | 1.9 s | 0.049 |
  | /recepty/pizza-margherita/ | 99 | 100 | 100 | 100 | 1.8 s | 0 |
  | /kosik/ | 99 | 100 | 100 | 63 (noindex on purpose) | 1.6 s | 0.024 |

  Remaining CLS comes from the web font swap; it is under 0.1. These are lab numbers, not visitor data.
- Live checks: all main routes 200, unknown path 404, private pages carry `noindex, nofollow`, sitemap and robots served.

## Not verified
- Real browsers other than Chromium (Safari, Firefox) were not tested.
- Screen reader behaviour was not tested manually; only roles/labels and Lighthouse checks.

## Blocked / needs Kenny
- Operator name and contact for `/o-projektu/` and `/soukromi/` (condition for a public launch; not invented).
- Shop/affiliate partner for the shopping list: none confirmed, module stays disabled.

- `www.damenic.cz` answers 200 with the same pages (canonical points to the apex). A www → apex 301 Redirect Rule still has to be created on the zone.

## Assets
- 62 of 65 photos from Wikimedia Commons (CC0 / PD / CC BY / CC BY-SA), each checked by eye, records in `src/data/assets.json`.
- Placeholders (no suitable licensed photo): `dish-malinova-limonada-hospoda`, `dish-nealkoholicke-pivo-hospoda` (every photo showed a
  brand), `dish-cockovy-dal-s-ryzi` (removed: origin of the Commons upload was doubtful).
- Weaker matches worth replacing later: burger-niva-cibule, salat-halloumi-kuskus, zeleninove-kari-s-tofu, zelny-salat-kebab, hovezi-durum.
- Logo, favicon, OG image and illustrations: own SVG/PIL drawings in the repo. **Canva was not used**: it only got connected
  during the session; the logo was kept as own vector code because it stays sharp at 16 px and needs no licence.
