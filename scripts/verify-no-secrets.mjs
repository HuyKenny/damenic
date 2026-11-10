// Public repo guard: fails when a file looks like it contains a credential.
// Usage: node scripts/verify-no-secrets.mjs [dir]   (default: tracked source files)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = process.argv[2] ?? '.';
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '.wrangler', 'test-results', 'playwright-report', 'shots']);
const BINARY = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.ico', '.woff', '.woff2', '.gif']);
const PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{40,}\b/, 'GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS key'],
  [/\bsk_(live|test)_[A-Za-z0-9]{20,}\b/, 'Stripe key'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/(CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CF_API_KEY|API_KEY|SECRET|PASSWORD)\w*\s*[:=]\s*["']?[A-Za-z0-9_\-]{24,}/i, 'assigned secret'],
];
// Values of secrets available in CI must never appear in files either.
const LIVE = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'].map((k) => process.env[k]).filter((v) => v && v.length >= 16);

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (root === '.' && SKIP_DIRS.has(name)) continue;
      if (name === '.git' || name === 'node_modules') continue;
      walk(p);
    } else if (!BINARY.has(extname(name).toLowerCase()) && st.size < 3_000_000 && name !== 'package-lock.json') {
      const text = readFileSync(p, 'utf8');
      for (const [re, label] of PATTERNS) if (re.test(text)) hits.push(`${p}: ${label}`);
      for (const v of LIVE) if (text.includes(v)) hits.push(`${p}: live secret value`);
    }
  }
}
walk(root);
if (hits.length) {
  console.error('Possible secrets found:\n' + hits.join('\n'));
  process.exit(1);
}
console.log(`verify-no-secrets: OK (${root})`);
