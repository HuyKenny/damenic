import type { APIRoute } from 'astro';
import { xml } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const GET: APIRoute = () =>
  xml(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['sitemap-recepty.xml', 'sitemap-stranky.xml']
      .map((f) => `<sitemap><loc>${SITE.url}/${f}</loc><lastmod>${new Date().toISOString()}</lastmod></sitemap>`)
      .join('')}</sitemapindex>`,
  );
