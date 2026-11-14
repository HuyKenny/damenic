import type { APIRoute } from 'astro';
import { allRestaurants, primaryDishForRecipe } from '@/lib/content';
import { ideaHubs } from '@/lib/hubs';
import { lastmod, urlset, xml, type SitemapUrl } from '@/lib/seo';
import { SITE } from '@/lib/site';

export const GET: APIRoute = async () => {
  const urls: SitemapUrl[] = ['/', '/restaurace/', '/jak-to-funguje/', '/o-projektu/', '/soukromi/', '/dopaminove-objednavani/', '/pro-media/', ...(await ideaHubs()).map((h) => h.path)].map((p) => ({ loc: `${SITE.url}${p}`, lastmod: lastmod('src/pages') }));
  for (const r of await allRestaurants()) urls.push({ loc: `${SITE.url}/restaurace/${r.id}/`, lastmod: lastmod(`src/data/restaurants/${r.id}.json`) });
  for (const dishId of (await primaryDishForRecipe()).values()) urls.push({ loc: `${SITE.url}/jidla/${dishId}/`, lastmod: lastmod(`src/data/dishes/${dishId}.json`) });
  return xml(urlset(urls));
};
