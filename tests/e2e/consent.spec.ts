import { expect, test } from '@playwright/test';

// Starts with an empty browser: no stored choice.
test.use({ storageState: { cookies: [], origins: [] } });

const gtm = /googletagmanager\.com\/gtm\.js/;

test('nothing is requested from Google until the visitor accepts', async ({ page }, testInfo) => {
  const requested: string[] = [];
  await page.route(gtm, (route) => {
    requested.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: 'window.__gtmStub = true;' });
  });
  await page.goto('/');
  await expect(page.getByTestId('consent')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('consent-banner.png') });
  await page.waitForLoadState('networkidle');
  expect(requested).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { dataLayer?: unknown[] }).dataLayer)).toBeUndefined();

  await page.getByTestId('consent-accept').click();
  await expect(page.getByTestId('consent')).toHaveCount(0);
  await expect.poll(() => requested.length).toBe(1);
  expect(requested[0]).toContain('id=GTM-TDBTTH67');
  expect(await page.evaluate(() => (window as unknown as { __gtmStub?: boolean }).__gtmStub)).toBe(true);

  // The choice is remembered: no banner, and Tag Manager loads again on the next page.
  await page.goto('/recepty/');
  await expect(page.getByTestId('consent')).toHaveCount(0);
  await expect.poll(() => requested.length).toBe(2);
});

test('declining keeps Google out, is remembered and can be changed later', async ({ page }) => {
  const requested: string[] = [];
  await page.route(gtm, (route) => {
    requested.push(route.request().url());
    return route.fulfill({ contentType: 'application/javascript', body: '' });
  });
  await page.goto('/');
  await page.getByTestId('consent-deny').click();
  await expect(page.getByTestId('consent')).toHaveCount(0);
  await page.goto('/restaurace/');
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('consent')).toHaveCount(0);
  expect(requested).toEqual([]);

  // The footer link reopens the choice.
  await page.locator('footer [data-consent-open]').click();
  await expect(page.getByTestId('consent')).toBeVisible();
  await page.getByTestId('consent-accept').click();
  await expect.poll(() => requested.length).toBe(1);
});
