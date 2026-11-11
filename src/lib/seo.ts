// Build-time SEO helpers (sitemaps, lastmod). Never import from an island.
import { execFileSync } from 'node:child_process';

const cache = new Map<string, string>();
const buildDate = new Date().toISOString();

/** Last commit date of a file (CI checks out full history); falls back to the build time. */
export function lastmod(file: string): string {
  if (cache.has(file)) return cache.get(file)!;
  let out = buildDate;
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (d) out = new Date(d).toISOString();
  } catch {
    /* not a git checkout */
  }
  cache.set(file, out);
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  images?: { loc: string; title?: string }[];
}

export function urlset(urls: SitemapUrl[]): string {
  const body = urls
    .map(
      (u) =>
        `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}${(u.images ?? [])
          .map((i) => `<image:image><image:loc>${esc(i.loc)}</image:loc></image:image>`)
          .join('')}</url>`,
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${body}</urlset>`;
}

export const xml = (body: string) => new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
