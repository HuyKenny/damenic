# Assets

Every image used on the site has a record in `src/data/assets.json` (`AssetRecord`): file, kind, Czech alt text, source,
source URL, author, licence, licence URL, changes made, and whether it is temporary. The validator fails on a record without
source information or with a missing file; `STRICT_ASSETS=1` also fails on missing or temporary assets.

## Sources in use
| Asset | Source | Licence |
|---|---|---|
| Food and restaurant photos (`src/assets/photos/`) | Wikimedia Commons, one file per asset, see `assets.json` | CC0 / Public domain / CC BY / CC BY-SA as recorded |
| Logo, favicon, empty-bag illustration, courier map | Own SVG code in this repo (`src/components/Logo.astro`, `EmptyBag.astro`, `src/islands/CourierMap.tsx`) | own |
| UI icons | Lucide (`lucide-static`) | ISC |
| Font | Plus Jakarta Sans (`@fontsource-variable/plus-jakarta-sans`) | SIL Open Font License 1.1 |

CC BY and CC BY-SA require attribution: author, licence and source are listed per file in `assets.json`. Photos are only
resized and cropped for display.

## Canva
Canva is connected in Claude Code sessions. Canva-made graphics (if added) must be exported to files in this repo, never
hot-linked to temporary Canva export URLs. Do not commit standalone Canva stock elements to this public repo unless the
licence allows redistribution; prefer own vector shapes.

## Missing / temporary
See IMPLEMENTATION_STATUS.md, section "Assets".
