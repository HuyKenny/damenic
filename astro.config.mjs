// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Fully static site: no adapter, no SSR. Served by Cloudflare Workers Static Assets.
// Sitemaps are own endpoints (src/pages/sitemap-*.xml.ts) so recipes can carry images and git-based lastmod.
export default defineConfig({
  site: 'https://damenic.cz',
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
  integrations: [preact()],
  image: { responsiveStyles: true },
});
