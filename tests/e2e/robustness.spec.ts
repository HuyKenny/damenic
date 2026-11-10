import { expect, test } from '@playwright/test';
import { addMargherita, cartCount } from './helpers';

test('corrupted local data is reset with a notice', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('damenic:cart:v1', '{"v":1,"items":[{"broken":');
      localStorage.setItem('damenic:orders:v1', '"nonsense"');
      sessionStorage.setItem('seeded', '1');
    }
  });
  await page.goto('/kosik/');
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.locator('.toast')).toContainText('poškozená');
});

test('cart line for a dish that no longer exists is dropped', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'damenic:cart:v1',
      JSON.stringify({ v: 1, restaurantId: 'prazdna-pec', items: [{ key: 'zmizele|', dishId: 'zmizele-jidlo', qty: 1, choices: {} }] }),
    );
  });
  await page.goto('/kosik/');
  await expect(page.getByTestId('cart-empty')).toBeVisible();
  await expect(page.locator('.toast')).toContainText('už v nabídce není');
});

test('site works when storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Object.defineProperty(window, 'localStorage', { get: blocked });
  });
  await addMargherita(page);
  expect(await cartCount(page)).toBe(1);
  await expect(page.locator('.toast')).toContainText('nepovolil ukládání');
});

test('real 404 response', async ({ request }) => {
  const res = await request.get('/tohle-neexistuje/');
  expect(res.status()).toBe(404);
});

test('private pages are noindex, public pages canonical', async ({ page }) => {
  for (const path of ['/kosik/', '/pokladna/', '/objednavka/', '/moje-objednavky/', '/nakupni-seznam/']) {
    await page.goto(path);
    await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', /noindex/);
  }
  await page.goto('/recepty/');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://damenic.cz/recepty/');
  await expect(page.locator('.simstrip')).toContainText('Simulace rozvozu. Žádné skutečné platby ani doručení.');
});

test('wiping local data', async ({ page }) => {
  await addMargherita(page);
  await page.goto('/soukromi/');
  await page.getByTestId('wipe').click();
  await page.getByTestId('wipe-confirm').click();
  expect(await cartCount(page)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('damenic:cart:v1'))).toBeNull();
});
