// @ts-check
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// Fully static site: no adapter, no SSR. Served by Cloudflare Workers Static Assets.
// Sitemaps are own endpoints (src/pages/sitemap-*.xml.ts) so recipes can carry images and git-based lastmod.
export default defineConfig({
  site: 'https://damenic.cz',
  output: 'static',
  trailingSlash: 'always',
  // One fewer round trip on the critical path for first-time visitors (the CSS is ~12 kB brotli); measured with Lighthouse.
  build: { format: 'directory', inlineStylesheets: 'always' },
  compressHTML: true,
  integrations: [preact()],
  image: { responsiveStyles: true },
  // Everything is first-party (fonts and images are self-hosted), so the policy can be strict. Astro puts per-page hashes of its own
  // inline scripts and styles into a <meta> CSP; inline style="" attributes cannot be hashed, hence style-src-attr. The header
  // CSP in public/_headers adds frame-ancestors and friends. tests/e2e/csp.spec.ts fails on any violation.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "media-src 'self'",
        "frame-src 'none'",
        "manifest-src 'self'",
      ],
      // 'inline-speculation-rules' lets the inline <script type="speculationrules"> in Base.astro run (prefetch of internal links).
      scriptDirective: { resources: ["'self'", "'inline-speculation-rules'"] },
      styleDirective: { resources: ["'self'", { resource: "'unsafe-inline'", kind: 'attribute' }] },
    },
  },
});
