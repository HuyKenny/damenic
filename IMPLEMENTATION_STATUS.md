# Implementation status

Updated: 2026-11-11. Only results that actually ran are recorded here.

## v2 (2026-11-11): delivery-app redesign
- Look: Canva logo (retraced as SVG), favicons, 16 category icons, 4 illustrations; Bricolage Grotesque + Figtree; red/pink/yellow tokens.
- Catalogue: 44 fictional restaurants in 15 cuisines, 439 menu items with EU allergens, spiciness and vegan flags; 125 recipes
  (95 new ones chosen by Marketing Miner search volume), 235 ingredients.
- Browsing: category strip, quick chips, filter dialog (cuisine, free delivery, promo, open now, delivery time, price level,
  diet, pickup, new, no minimum), five sorts, state in the query string. No rating filter (fictional places have no ratings).
- Restaurant page: cover, monogram, facts, delivery/pickup switch, section tabs with scrollspy, menu search, "Tip kuchyně",
  dish sheet with photo, allergens, required/optional options.
- Cart: drawer + /kosik/, upsell row, minimum order bar, restaurant promos. Checkout: time slots from opening hours,
  courier note presets, tip, promo codes NIC / NANECISTO, four demo payment tiles, still no personal or payment field.
- Tracker: ETA ring, courier avatar, joke call/chat dialog, scheduled orders, reversed route for pickup.
- SEO: recipe hubs per cuisine + quick + meatless, FAQ + FAQPage, Recipe JSON-LD with 3 image ratios and HowToSection,
  own sitemaps with git lastmod and images, one indexed dish page per recipe, SearchAction to /hledat/, IndexNow after deploy.
- Photos: 415 Pexels records (3 helper agents picked them from thumbnail contact sheets; no photo files on the Pi or in git),
  CI downloads and caches them. 7 placeholders remain: al-taglio-rossa-ani-kousek, krevetove-chipsy-nebude,
  malinova-omacka-upecem, nakladana-zelenina-neurcito, ovocne-knedliky (dish + recipe), rajcatova-ryze-nic.
  29 recipes without an own photo reuse the photo of their dish.

### v2 verification (actually run, 2026-11-11, GitHub-hosted runners)
- CI run 42973879110: content validation, `astro check`, ESLint, build with all 415 photos downloaded: pass.
- Vitest: 48 tests in 5 files pass (new: filters, cart pricing with pickup/tip/promos/minimum).
- Playwright e2e: 25 tests pass (new: filters + URL state, dish sheet, minimum order, tip/promo/pickup totals, hubs/sitemaps).
- Screenshots 360/390/768/1440 reviewed by eye; fixed from them: separator dot starting a wrapped facts line on tiles.
- IndexNow: first ping right after the key went live returned 403, the next deploy's ping returned 200 (306 URLs).

## v2.1 (2026-11-11): real-time tracking (Kenny's request)
- New orders run in real time (speed 1); orders stored earlier keep 10× and open as delivered.
- Tracker: mm:ss countdown, "Doručení kolem HH:MM", countdown in the tab title, stage times in the timeline, new stages
  "Kurýr je za rohem" and "Kurýr stojí před dveřmi", illustrative distance, pulsing marker. At the end a doorbell dialog
  (Web Audio ding-dong + vibration, once per tab session, can be switched off) and "Otevřít dveře"; pickup ends with "Vyzvednout".
- Active order pill on every page ("Kurýr dorazí za 9 min", "Kurýr je u dveří!").
- Fixed on the way: the catalogue was 906 px wide on phones (sr-only sort label escaped the filter scroller), which hid the
  bottom tab bar there; the mobile e2e test now checks /restaurace/ and names overflowing elements.
- CI: 52 unit tests, 26 e2e tests pass; door, pill and finale screenshots reviewed.

### Lighthouse after the performance fixes (2026-11-11, mobile lab, run 42979860023)
| Page | Perf | A11y | Best | SEO | LCP | CLS |
|---|---|---|---|---|---|---|
| / | 98 | 100 | 100 | 100 | 1.8 s | 0 |
| /restaurace/ | 99 | 100 | 100 | 100 | 2.0 s | 0 |
| /restaurace/prazdna-pec/ | 99 | 100 | 100 | 100 | 1.6 s | 0.001 |
| /jidla/svickova-na-smetane/ | 99 | 100 | 100 | 100 | 2.1 s | 0 |
| /recepty/pizza-margherita/ | 99 | 100 | 100 | 100 | 1.7 s | 0 |
| /recepty/kuchyne/ceska/ | 99 | 100 | 100 | 100 | 1.9 s | 0 |
| /kosik/ | 100 | 100 | 100 | 63 (noindex) | 1.5 s | 0.032 |

The home page varies between runs (a second run gave Perf 86, TBT 510 ms); the other pages stay at 98–100.
Fixes that got there: metric-matched fallback fonts (CLS 0.16 → 0), static home grid instead of the filter island,
content-visibility on home rails, stable default order on hydration, reserved height on storage pages, monogram contrast.

## v2.2 (2026-11-11): courier copy + real contact
- Four fictional pun-named couriers (Prokop Prázdný, Nikola Nicová, Vojta Vzduch, Ema Éterová) with vehicle, motto and a
  per-stage "Právě teď" line; card heading "Tvůj kurýr" with a "smyšlená postava" tag.
- "Napsat" opens a courier chat with a canned per-stage reply plus a mailto to info@damenic.cz (subject carries the order id);
  "Zavolat" keeps the non-existent number joke and the same contact box.
- Tag "Skutečné minuty · smyšlené jídlo"; reorder buttons "Nic mi chutnalo. Ještě jednou!" / "Dát ničemu druhou šanci".
- info@damenic.cz also in the footer, /o-projektu/ and /soukromi/ (operator details still missing).
- Mail delivery: Cloudflare Email Routing (info@ → napis@sbalit.cz) is set up by
  `scripts/damenic/email-routing.py` in the workspace; run by Kenny (DNS change).

## v2.3 (2026-11-11): copywriting pass (Kenny: "mega kreativní")
- Voice guide in `COPY_GUIDE.md`: pointa na konci, kontrast hlad × nic, tykání, simulace vždy zřejmá, recepty jako fakta.
- Rewritten: SITE description, home (rails, banners, sections, steps), footer, how-it-works, about, cart/checkout/state pages,
  recipe hub intros, finale, 439 dish descriptions + `about` texts and 44 restaurant descriptions (agents drafted, applied
  with `json.dumps` literal swaps so file formatting stays; validator still requires "smyšlen/fiktivn" in restaurant text).
- Frozen strings (tests): sim notice, "Objednat nanečisto za 0 Kč", finale line "DámeNic doručilo přesně to, co slíbilo. Nic.".

## v2.4 (2026-11-11): Rohlik.cz call to action
- `PartnerCta.astro` under the recipe buttons and on the shopping list: "Na tohle už kurýr doopravdy přijede", yellow button, "Reklama" and
  "Skutečný obchod, mimo simulaci" tags, `rel="sponsored nofollow noopener"`. Data in `partners.json`; privacy, about and how-it-works mention it.

## v1 (2026-11-10)
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
- Shop/affiliate partner: Rohlik.cz enabled 11. 11. 2026 (Kenny's CJ link, not click-tested: Kenny should open it once to confirm the advertiser is approved).

- `www.damenic.cz` answers 200 with the same pages (canonical points to the apex). A www → apex 301 Redirect Rule still has to be created on the zone.
- Google Search Console: domain not verified yet; `scripts/damenic/gsc-setup.py` in the workspace does it (DNS TXT change, needs Kenny).

## Assets
- 62 of 65 photos from Wikimedia Commons (CC0 / PD / CC BY / CC BY-SA), each checked by eye, records in `src/data/assets.json`.
- Placeholders (no suitable licensed photo): `dish-malinova-limonada-hospoda`, `dish-nealkoholicke-pivo-hospoda` (every photo showed a
  brand), `dish-cockovy-dal-s-ryzi` (removed: origin of the Commons upload was doubtful).
- Weaker matches worth replacing later: burger-niva-cibule, salat-halloumi-kuskus, zeleninove-kari-s-tofu, zelny-salat-kebab, hovezi-durum.
- v1 logo/illustrations were own SVG/PIL drawings; v2 replaced them with Canva assets (see above).
