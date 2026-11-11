import { expect, test } from '@playwright/test';
import { addMargherita } from './helpers';

test('mobile: bottom cart bar, menu, no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  for (const path of ['/', '/restaurace/', '/restaurace/prazdna-pec/', '/jidla/pizza-margherita/', '/recepty/svickova-na-smetane/', '/recepty/kuchyne/ceska/', '/kosik/', '/pokladna/']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    // Name the elements that stick out, so a failure says what to fix.
    const culprits = await page.evaluate(() => {
      const w = document.documentElement.clientWidth;
      return [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          // Children of horizontal scrollers may stick out; the scroller itself and fixed bars may not.
          return r.right > w + 1 && r.width > 0 && !el.parentElement?.closest('.catstrip, .filterbar, .rail, .menunav, dialog, .tabbar');
        })
        .slice(0, 6)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(el.getBoundingClientRect().left)}–${Math.round(el.getBoundingClientRect().right)})`);
    });
    expect(overflow, `${path}: ${culprits.join(', ')}`).toBeLessThanOrEqual(0);
    await expect(page.getByRole('navigation', { name: 'Navigace aplikace' }), path).toBeInViewport();
  }
  await page.goto('/');
  const tabs = page.getByRole('navigation', { name: 'Navigace aplikace' });
  await expect(tabs.getByRole('link', { name: 'Recepty' })).toBeVisible();
  await addMargherita(page);
  await page.goto('/restaurace/prazdna-pec/');
  await expect(page.locator('.cartbar')).toBeVisible();
  await expect(page.locator('.cartbar')).toContainText('Zobrazit košík');
});
