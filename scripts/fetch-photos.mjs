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
async function worker() {
  while (queue.length) {
    const a = queue.shift();
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await fetch(a.downloadUrl, { headers: { 'User-Agent': 'damenic-build (static site)' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 2000) throw new Error('too small');
        writeFileSync(join(DIR, a.file), buf);
        break;
      } catch (e) {
        if (attempt === 3) {
          failed++;
          console.error(`photo ${a.id}: ${e.message}`);
        } else await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
if (failed) {
  console.error(`${failed} photos failed`);
  process.exit(1);
}
