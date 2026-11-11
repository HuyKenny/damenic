import type { APIRoute } from 'astro';
import { getImage } from 'astro:assets';
import { allRecipes, photo } from '@/lib/content';
import { RECIPE_HUBS } from '@/lib/hubs';
import { lastmod, urlset, xml, type SitemapUrl } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const GET: APIRoute = async () => {
  const recipes = await allRecipes();
  const urls: SitemapUrl[] = [{ loc: `${SITE.url}/recepty/`, lastmod: lastmod('src/data/recipes') }];
  for (const hub of await RECIPE_HUBS()) urls.push({ loc: `${SITE.url}/recepty/${hub.slug}/`, lastmod: lastmod('src/data/recipes') });
  for (const r of recipes) {
    const p = await photo(r.data.image);
    const img = p.meta ? new URL((await getImage({ src: p.meta, width: 1200, format: 'jpg' })).src, SITE.url).href : null;
    urls.push({ loc: `${SITE.url}/recepty/${r.id}/`, lastmod: lastmod(`src/data/recipes/${r.id}.json`), images: img ? [{ loc: img }] : [] });
  }
  return xml(urlset(urls));
};
