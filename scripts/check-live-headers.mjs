#!/usr/bin/env node
// Post-deploy smoke check of the live site: security headers, caching, redirects. No dependencies.
//   node scripts/check-live-headers.mjs [https://damenic.cz]
const ORIGIN = process.argv[2] ?? 'https://damenic.cz';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (url, init = {}) => fetch(url, { redirect: 'manual', ...init });

async function run() {
  const problems = [];
  const ok = (cond, msg) => cond || problems.push(msg);

  const home = await get(`${ORIGIN}/`);
  const h = (name) => home.headers.get(name) ?? '';
  ok(home.status === 200, `/ returned ${home.status}`);
  ok(/max-age=\d{8,}/.test(h('strict-transport-security')), 'HSTS missing');
  ok(h('x-content-type-options') === 'nosniff', 'X-Content-Type-Options missing');
  ok(h('x-frame-options') === 'DENY', 'X-Frame-Options missing');
  ok(h('referrer-policy') !== '', 'Referrer-Policy missing');
  ok(h('permissions-policy').includes('camera=()'), 'Permissions-Policy missing');
  ok(h('content-security-policy').includes("frame-ancestors 'none'"), 'header CSP (frame-ancestors) missing');
  const html = await home.text();
  ok(/<meta http-equiv="content-security-policy"/i.test(html), 'meta CSP missing in HTML');

  const asset = html.match(/\/_astro\/[^"')\s]+\.(?:css|js|woff2)/)?.[0];
  if (asset) {
    const a = await get(`${ORIGIN}${asset}`);
    ok(/immutable/.test(a.headers.get('cache-control') ?? ''), `${asset} is not immutable`);
  }

  const go = await get(`${ORIGIN}/go/rohlik`);
  ok(go.status === 302 && /kqzyfj\.com/.test(go.headers.get('location') ?? ''), `/go/rohlik gave ${go.status}`);

  const http = await get(ORIGIN.replace('https:', 'http:') + '/');
  ok(http.status === 301 || http.status === 308, `http:// returned ${http.status} (want a redirect to https)`);
  const www = await get(ORIGIN.replace('://', '://www.') + '/recepty/');
  ok(www.status === 301 && (www.headers.get('location') ?? '').startsWith(`${ORIGIN}/recepty/`), `www returned ${www.status} (want 301 to the apex)`);

  const missing = await get(`${ORIGIN}/tohle-tu-neni/`);
  ok(missing.status === 404, `unknown URL returned ${missing.status}`);
  const sec = await get(`${ORIGIN}/.well-known/security.txt`);
  ok(sec.status === 200, `security.txt returned ${sec.status}`);
  return problems;
}

// Cloudflare needs a moment after a deploy: retry a few times before reporting.
let problems = [];
for (let i = 0; i < 6; i++) {
  problems = await run();
  if (!problems.length) break;
  await sleep(10_000);
}
if (problems.length) {
  console.log('live check FAILED:\n - ' + problems.join('\n - '));
  process.exit(1);
}
console.log('live check OK');
