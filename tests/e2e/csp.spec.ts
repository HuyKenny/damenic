import { expect, test } from '@playwright/test';
import { atNoon, watchConsole } from './helpers';

// The site ships a strict Content-Security-Policy (meta tag from Astro + header). A violation would silently break an island,
// so every page type is loaded and any violation, console error or uncaught exception fails the test.
const PAGES = [
  '/',
  '/restaurace/',
  '/restaurace/prazdna-pec/',
  '/jidla/pizza-margherita/',
  '/recepty/',
  '/recepty/pizza-margherita/',
  '/recepty/kuchyne/ceska/',
  '/kosik/',
  '/pokladna/',
  '/objednavka/',
  '/moje-objednavky/',
  '/nakupni-seznam/',
  '/hledat/?q=pizza',
  '/jak-to-funguje/',
  '/o-projektu/',
  '/soukromi/',
  '/tohle-neexistuje/',
];

test('no page violates the Content-Security-Policy', async ({ page }) => {
  await atNoon(page);
  const errors = watchConsole(page);
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp), `CSP violations on ${path}`).toEqual([]);
    expect(await page.locator('meta[http-equiv="content-security-policy"]').count(), `CSP meta tag on ${path}`).toBe(1);
  }
  expect(errors).toEqual([]);
});

test('the CSP meta tag is strict: no unsafe-inline for scripts, no foreign origins', async ({ page }) => {
  await page.goto('/');
  const csp = (await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content')) ?? '';
  const script = csp.split(';').find((d) => d.trim().startsWith('script-src ')) ?? '';
  expect(script).not.toContain("'unsafe-inline'");
  expect(script).not.toContain('*');
  expect(csp).not.toMatch(/https?:\/\//);
  expect(csp).toContain("default-src 'self'");
});
