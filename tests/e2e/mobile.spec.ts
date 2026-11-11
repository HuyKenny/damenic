import { expect, test } from '@playwright/test';
import { addMargherita } from './helpers';

test('mobile: bottom cart bar, menu, no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  for (const path of ['/', '/restaurace/prazdna-pec/', '/jidla/pizza-margherita/', '/recepty/svickova-na-smetane/', '/kosik/', '/pokladna/']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto('/');
  const tabs = page.getByRole('navigation', { name: 'Navigace aplikace' });
  await expect(tabs.getByRole('link', { name: 'Recepty' })).toBeVisible();
  await addMargherita(page);
  await page.goto('/restaurace/prazdna-pec/');
  await expect(page.locator('.cartbar')).toBeVisible();
  await expect(page.locator('.cartbar')).toContainText('Zobrazit košík');
});
