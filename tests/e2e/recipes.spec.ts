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

test('Rohlik.cz call to action: short /go/ link, still labelled as an ad, only on recipes and the shopping list', async ({ page }) => {
  await page.goto('/recepty/pizza-margherita/');
  const tools = page.getByTestId('recipe-tools');
  const cta = tools.getByTestId('partner-cta');
  await expect(cta).toBeVisible();
  await expect(cta).toContainText('Reklama');
  await expect(cta).toContainText('mimo simulaci');
  const link = cta.getByTestId('partner-link');
  await expect(link).toHaveAttribute('href', '/go/rohlik');
  await expect(link).toHaveAttribute('rel', /sponsored/);
  await expect(link).toHaveAttribute('target', '_blank');
  expect(await page.content()).not.toContain('kqzyfj');
  // Under the two buttons, before the cost box.
  const order = await page.evaluate(() => {
    const q = (s: string) => document.querySelector(s)!;
    const after = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return after(q('[data-testid=add-to-list]'), q('[data-testid=partner-cta]')) && after(q('[data-testid=partner-cta]'), q('[data-testid=costs]'));
  });
  expect(order).toBe(true);

  await page.goto('/nakupni-seznam/');
  await expect(page.getByTestId('partner-link')).toHaveAttribute('href', '/go/rohlik');

  for (const path of ['/', '/restaurace/', '/jidla/pizza-margherita/']) {
    await page.goto(path);
    await expect(page.getByTestId('partner-cta')).toHaveCount(0);
  }
});

test('recipe filters: facets narrow the list, URL keeps the state, static sections come back', async ({ page }) => {
  await page.goto('/recepty/');
  await hydrated(page.locator('body'));
  await expect(page.locator('#recipe-static')).toBeVisible();
  await page.getByTestId('show-all-recipes').click();
  await expect(page.locator('#recipe-static')).toBeHidden();
  const all = await page.getByTestId('recipe-count').innerText();
  expect(parseInt(all, 10)).toBeGreaterThan(100);
  await page.getByRole('button', { name: 'Bez masa', exact: true }).first().click();
  await page.getByRole('button', { name: 'Do 30 minut' }).click();
  await expect(page).toHaveURL(/dieta=veg/);
  await expect(page).toHaveURL(/cas=30/);
  const narrowed = parseInt(await page.getByTestId('recipe-count').innerText(), 10);
  expect(narrowed).toBeGreaterThan(0);
  expect(narrowed).toBeLessThan(parseInt(all, 10));
  await page.getByTestId('recipe-search').fill('zzzneexistuje');
  await expect(page.getByTestId('recipe-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Zrušit filtry' }).first().click();
  await page.getByTestId('recipe-search').fill('');
  await expect(page.locator('#recipe-static')).toBeVisible();
});

test('recipe filters: alcohol facet separates drinks, "co mám doma" ranks by missing ingredients', async ({ page }) => {
  await page.goto('/recepty/?alkohol=only&typ=napoj');
  await hydrated(page.locator('body'));
  const n = parseInt(await page.getByTestId('recipe-count').innerText(), 10);
  expect(n).toBeGreaterThan(5);
  await expect(page.getByTestId('recipe-results').locator('.tag--adult').first()).toBeVisible();
  await page.goto('/recepty/?doma=vejce,mouka-hladka');
  await expect(page.getByTestId('recipe-count')).toContainText('recept');
  await expect(page.getByTestId('recipe-results')).toContainText('surovin');
});
