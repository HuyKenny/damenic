import { expect, test } from '@playwright/test';
import { hydrated, kc } from './helpers';

test('changing servings recalculates amounts and costs', async ({ page }) => {
  await page.goto('/recepty/pizza-margherita/');
  const tools = page.getByTestId('recipe-tools');
  await expect(tools.getByTestId('servings')).toHaveText('2');
  const flour = tools.locator('[data-ingredient="mouka-hladka"] b');
  await expect(flour).toHaveText('330 g');
  const consumed2 = kc(await tools.getByTestId('cost-consumed').innerText());
  await tools.getByRole('button', { name: 'Více porcí' }).click();
  await tools.getByRole('button', { name: 'Více porcí' }).click();
  await expect(tools.getByTestId('servings')).toHaveText('4');
  await expect(flour).toHaveText('660 g');
  const consumed4 = kc(await tools.getByTestId('cost-consumed').innerText());
  expect(consumed4).toBeGreaterThan(consumed2 * 1.8);
  expect(consumed4).toBeLessThan(consumed2 * 2.2);
  // Whole packs are never cheaper than what is consumed.
  expect(kc(await tools.getByTestId('cost-packs').innerText())).toBeGreaterThanOrEqual(consumed4);
  await expect(tools.getByTestId('cost-delivery')).toBeVisible();
});

test('recipe page has visible-content Recipe data and no ratings', async ({ page }) => {
  await page.goto('/recepty/svickova-na-smetane/');
  const data = await page.locator('script[type="application/ld+json"]').allTextContents();
  const recipe = data.map((d) => JSON.parse(d)).find((d) => d['@type'] === 'Recipe');
  expect(recipe).toBeTruthy();
  expect(recipe.aggregateRating).toBeUndefined();
  expect(recipe.review).toBeUndefined();
  expect(recipe.nutrition).toBeUndefined();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(recipe.name);
});

test('shopping list merges recipes and "Mám doma" lowers only the purchase', async ({ page }) => {
  await page.goto('/recepty/pizza-margherita/');
  await page.getByTestId('add-to-list').click();
  await page.goto('/recepty/pizza-sunka-zampiony/');
  await page.getByTestId('add-to-list').click();
  await page.goto('/nakupni-seznam/');
  await expect(page.getByTestId('list-recipe')).toHaveCount(2);
  const flour = page.locator('[data-testid="shop-line"][data-ingredient="mouka-hladka"]');
  await expect(flour.getByTestId('shop-amount')).toHaveText('660 g');

  const toBuy = kc(await page.getByTestId('list-to-buy').innerText());
  const consumed = kc(await page.getByTestId('list-consumed').innerText());
  await flour.getByTestId('have').click();
  await expect(flour.getByTestId('have')).toHaveAttribute('aria-pressed', 'true');
  expect(kc(await page.getByTestId('list-to-buy').innerText())).toBeLessThan(toBuy);
  expect(kc(await page.getByTestId('list-consumed').innerText())).toBe(consumed);

  await flour.locator('input[type=checkbox]').check();
  await page.reload();
  await expect(flour.getByTestId('have')).toHaveAttribute('aria-pressed', 'true');
  await expect(flour.locator('input[type=checkbox]')).toBeChecked();
});

test('search tolerates missing diacritics and has an empty state', async ({ page }) => {
  await page.goto('/');
  await hydrated(page.locator('.header'));
  const box = page.getByRole('combobox');
  await box.fill('svickova');
  await expect(page.getByRole('option').first()).toContainText('Svíčková');
  await box.press('Enter');
  await expect(page).toHaveURL(/svickova/);
  await page.goto('/');
  await hydrated(page.locator('.header'));
  await page.getByRole('combobox').fill('qqqqzz');
  await expect(page.locator('.search__empty')).toBeVisible();
});

test('partner call to action is hidden while the partner is disabled', async ({ page }) => {
  // Rohlik.cz is switched off in partners.json (enabled: false). Re-enable there and restore the assertions from git history (PartnerCta.astro).
  for (const path of ['/recepty/pizza-margherita/', '/nakupni-seznam/', '/', '/restaurace/']) {
    await page.goto(path);
    await expect(page.getByTestId('partner-cta')).toHaveCount(0);
    expect(await page.content()).not.toContain('kqzyfj.com');
  }
});
