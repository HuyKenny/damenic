#!/usr/bin/env node
// Technical SEO audit of the built site (dist/). No dependencies. Errors fail CI, warnings are printed.
//   node scripts/seo-audit.mjs [dist]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const ORIGIN = 'https://damenic.cz';
const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(DIST);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const urlOf = (f) => {
  const r = '/' + relative(DIST, f).replaceAll('\\', '/');
  return r.endsWith('/index.html') ? r.slice(0, -'index.html'.length) : r;
};
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}=("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((x) => x !== undefined);
const decode = (s) => s.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');

// ---------- sitemap ----------
const sitemapUrls = new Set();
for (const f of files.filter((x) => /sitemap-[^/]*\.xml$/.test(x) && !x.endsWith('sitemap-index.xml'))) {
  for (const m of readFileSync(f, 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)) sitemapUrls.add(m[1]);
}
if (!sitemapUrls.size) err('sitemap', 'no URLs found in sitemap-*.xml');

// ---------- pages ----------
const pages = new Map(); // url -> { indexable, title, description }
const titles = new Map();
const descriptions = new Map();
const existsUrl = (u) => {
  const path = decodeURIComponent(u.split('#')[0].split('?')[0]);
  if (!path.startsWith('/')) return true;
  if (path.startsWith('/go/') || path.startsWith('/cdn-cgi/')) return true; // redirects live in _redirects, not in dist
  const f = join(DIST, path);
  if (path.endsWith('/')) return existsSync(join(f, 'index.html'));
  return existsSync(f) || existsSync(join(f, 'index.html'));
};

for (const f of htmlFiles) {
  const url = urlOf(f);
  if (url === '/404.html') continue;
  const html = readFileSync(f, 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  const robots = decode(attr(head.match(/<meta[^>]+name="robots"[^>]*>/i)?.[0] ?? '', 'content') ?? '');
  const indexable = !/noindex/i.test(robots);
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const description = decode(attr(head.match(/<meta[^>]+name="description"[^>]*>/i)?.[0] ?? '', 'content') ?? '');
  const canonical = attr(head.match(/<link[^>]+rel="canonical"[^>]*>/i)?.[0] ?? '', 'href');
  const body = html.slice(html.indexOf('</head>'));

  if (!/<html[^>]+lang="cs"/.test(html)) err(url, 'html lang="cs" missing');
  if (!/name="viewport"/.test(head)) err(url, 'viewport meta missing');
  if (!title) err(url, 'empty <title>');
  if (!description) err(url, 'meta description missing');
  const h1 = (body.match(/<h1[\s>]/g) ?? []).length;
  if (h1 !== 1) err(url, `${h1} <h1> elements (want exactly 1)`);

  if (indexable) {
    if (!canonical) err(url, 'indexable page without canonical');
    else if (canonical !== ORIGIN + url) err(url, `canonical ${canonical} is not the page itself`);
    if (!sitemapUrls.has(ORIGIN + url)) warn(url, 'indexable but not in the sitemap');
    for (const og of ['og:title', 'og:description', 'og:image', 'og:url']) if (!head.includes(`property="${og}"`)) err(url, `${og} missing`);
    if (title.length > 65) warn(url, `title is ${title.length} chars`);
    if (description.length < 50 || description.length > 160) warn(url, `description is ${description.length} chars`);
    titles.set(title, [...(titles.get(title) ?? []), url]);
    descriptions.set(description, [...(descriptions.get(description) ?? []), url]);
  } else if (sitemapUrls.has(ORIGIN + url)) err(url, 'noindex page is listed in the sitemap');
  pages.set(url, { indexable });

  // images need an alt attribute (empty is fine for decoration)
  for (const tag of html.match(/<img\b[^>]*>/g) ?? []) if (!/\salt=/.test(tag)) err(url, `<img> without alt: ${tag.slice(0, 80)}`);
  // structured data must parse
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(m[1]);
    } catch {
      err(url, 'invalid JSON-LD');
    }
  }
  // internal links must resolve
  for (const m of html.matchAll(/<a\b[^>]*\shref="(\/[^"]*)"/g)) {
    const href = decode(m[1]);
    if (!existsUrl(href)) err(url, `broken internal link ${href}`);
  }
  // the affiliate URL lives only in public/_redirects
  if (html.includes('kqzyfj.com')) err(url, 'affiliate URL is exposed in HTML (use /go/…)');
}

for (const u of sitemapUrls) {
  const path = u.replace(ORIGIN, '');
  if (!u.startsWith(ORIGIN + '/')) err('sitemap', `foreign URL ${u}`);
  else if (!pages.has(path)) err('sitemap', `${u} has no page in ${DIST}`);
}
for (const [t, urls] of titles) if (urls.length > 1) warn(urls[0], `duplicate title shared with ${urls.length - 1} more page(s): ${t.slice(0, 60)}`);
for (const [d, urls] of descriptions) if (urls.length > 1) warn(urls[0], `duplicate description shared with ${urls.length - 1} more page(s)`);

// robots.txt must point to the sitemap
const robots = existsSync(join(DIST, 'robots.txt')) ? readFileSync(join(DIST, 'robots.txt'), 'utf8') : '';
if (!robots.includes(`Sitemap: ${ORIGIN}/sitemap-index.xml`)) err('robots.txt', 'Sitemap line missing');

const indexable = [...pages.values()].filter((p) => p.indexable).length;
console.log(`seo-audit: ${pages.size} pages (${indexable} indexable), ${sitemapUrls.size} sitemap URLs, ${errors.length} errors, ${warnings.length} warnings`);
for (const w of warnings.slice(0, 25)) console.log('  warn  ' + w);
if (warnings.length > 25) console.log(`  … and ${warnings.length - 25} more warnings`);
for (const e of errors.slice(0, 60)) console.log('  ERROR ' + e);
if (errors.length > 60) console.log(`  … and ${errors.length - 60} more errors`);
process.exit(errors.length ? 1 : 0);
