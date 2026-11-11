import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Parses public/_headers (Cloudflare format: a path line, then indented "Name: value" lines).
function parse(text: string) {
  const rules = new Map<string, Record<string, string>>();
  let path: string | null = null;
  for (const raw of text.split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      path = raw.trim();
      rules.set(path, {});
    } else if (path) {
      const i = raw.indexOf(':');
      rules.get(path)![raw.slice(0, i).trim().toLowerCase()] = raw.slice(i + 1).trim();
    }
  }
  return rules;
}

describe('public/_headers', () => {
  const rules = parse(readFileSync('public/_headers', 'utf8'));
  const all = rules.get('/*')!;

  it('sets the hardening headers on every response', () => {
    expect(all['strict-transport-security']).toMatch(/max-age=\d{8,}/);
    expect(all['x-content-type-options']).toBe('nosniff');
    expect(all['x-frame-options']).toBe('DENY');
    expect(all['referrer-policy']).toBeTruthy();
    expect(all['permissions-policy']).toContain('camera=()');
    expect(all['cross-origin-opener-policy']).toBe('same-origin');
  });

  it('forbids framing, plugins and foreign form targets in the header CSP', () => {
    const csp = all['content-security-policy']!;
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) expect(csp).toContain(d);
    // Script/style rules live in the per-page meta tag; a header script-src would block Astro's inline islands.
    expect(csp).not.toContain('script-src');
  });

  it('caches hashed build output forever and nothing else that way', () => {
    expect(rules.get('/_astro/*')!['cache-control']).toBe('public, max-age=31536000, immutable');
    for (const [path, h] of rules) if (path !== '/_astro/*') expect(h['cache-control'] ?? '').not.toContain('immutable');
  });

  it('keeps affiliate redirects out of search', () => {
    expect(rules.get('/go/*')!['x-robots-tag']).toContain('noindex');
  });
});
