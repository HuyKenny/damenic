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
      // An element only widens the page when no ancestor clips it horizontally.
      const clipped = (el: Element) => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox !== 'visible') return true;
        }
        return false;
      };
      return [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          const pos = getComputedStyle(el).position;
          return r.right > w + 1 && r.width > 0 && pos !== 'fixed' && !clipped(el);
        })
        .slice(0, 6)
        .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(el.getBoundingClientRect().left)}–${Math.round(el.getBoundingClientRect().right)})`)
        .concat(`scrollWidth ${document.documentElement.scrollWidth}`);
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
