// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';

// Pages that hold only the visitor's local state: never in the sitemap, always noindex.
const PRIVATE = ['/404/', '/kosik/', '/pokladna/', '/objednavka/', '/moje-objednavky/', '/nakupni-seznam/'];

// Fully static site: no adapter, no SSR. Served by Cloudflare Workers Static Assets.
export default defineConfig({
  site: 'https://damenic.cz',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
  integrations: [
    preact(),
    sitemap({ filter: (page) => !PRIVATE.some((p) => new URL(page).pathname === p) }),
  ],
  image: { responsiveStyles: true },
});
