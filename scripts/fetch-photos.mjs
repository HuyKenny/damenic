// Downloads photos listed in src/data/assets.json that have a downloadUrl and are not present yet.
// Runs on GitHub runners before the build (cached between runs). Never needed on the Raspberry Pi.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/assets/photos';
mkdirSync(DIR, { recursive: true });
const assets = JSON.parse(readFileSync('src/data/assets.json', 'utf8')).filter((a) => a.downloadUrl);
const todo = assets.filter((a) => !existsSync(join(DIR, a.file)));
console.log(`photos: ${assets.length} remote, ${todo.length} to download`);
let failed = 0;
const queue = [...todo];
// Wikimedia answers parallel bursts with HTTP 429: serialize its downloads with a gap between them.
let wikiChain = Promise.resolve();
const wikiSlot = () => {
  const turn = wikiChain.then(() => new Promise((r) => setTimeout(r, 1200)));
  wikiChain = turn;
  return turn;
};
async function worker() {
  while (queue.length) {
    const a = queue.shift();
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        if (a.source === 'wikimedia') await wikiSlot();
        // Wikimedia policy asks for a descriptive User-Agent with a project URL; generic ones get throttled on shared runner IPs.
        const ua = a.source === 'wikimedia' ? 'damenic-build/1.0 (https://damenic.cz; static recipe site, build-time image fetch) node-fetch' : 'damenic-build (static site)';
        const res = await fetch(a.downloadUrl, { headers: { 'User-Agent': ua } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 2000) throw new Error('too small');
        writeFileSync(join(DIR, a.file), buf);
        break;
      } catch (e) {
        if (attempt === 5) {
          failed++;
          console.error(`photo ${a.id}: ${e.message}`);
        } else await new Promise((r) => setTimeout(r, (/429/.test(e.message) ? 8000 : 1000) * attempt));
      }
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
if (failed) {
  console.error(`${failed} photos failed`);
  process.exit(1);
}
