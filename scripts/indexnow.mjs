// After a deploy: tell IndexNow (Bing, Seznam, Yandex…) about URLs changed in the last 2 days.
// The key is public by design (it is served at /<key>.txt), so it lives in the repo.
import { readFileSync, readdirSync } from 'node:fs';

const KEY = 'f08000e7508028a259b32800f7286ec7';
const HOST = 'damenic.cz';
const since = Date.now() - 2 * 24 * 3600 * 1000;
const urls = [];
for (const f of readdirSync('dist').filter((f) => /^sitemap-(?!index).*\.xml$/.test(f))) {
  const xml = readFileSync(`dist/${f}`, 'utf8');
  for (const m of xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:<lastmod>([^<]+)<\/lastmod>)?/g)) {
    if (!m[2] || Date.parse(m[2]) >= since) urls.push(m[1]);
  }
}
if (!urls.length) {
  console.log('indexnow: nothing changed');
  process.exit(0);
}
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log(`indexnow: ${urls.length} URLs, HTTP ${res.status}`);
