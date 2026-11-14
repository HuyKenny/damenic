import { expect, test } from '@playwright/test';

const PAGES: [string, RegExp][] = [
  ['/dopaminove-objednavani/', /Dopaminové objednávání/],
  ['/co-k-veceri/', /Co k večeři/],
  ['/co-na-obed/', /Co na oběd/],
  ['/napady-na-veceri/', /Nápady na večeři/],
  ['/co-dnes-varit/', /Co dnes vařit/],
  ['/pro-media/', /pro média/i],
];

test('brand pages exist, have one h1 and parsable structured data', async ({ page }) => {
  for (const [path, h1] of PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(h1);
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    for (const j of ld) expect(() => JSON.parse(j), path).not.toThrow();
  }
});

test('idea pages list recipes and a visible FAQ; the manifest names both phrases and cites sources', async ({ page }) => {
  await page.goto('/co-k-veceri/');
  expect(await page.locator('article.card').count()).toBeGreaterThanOrEqual(12);
  await expect(page.getByRole('heading', { name: 'Časté otázky' })).toBeVisible();
  await page.goto('/dopaminove-objednavani/');
  const text = await page.locator('article').innerText();
  expect(text).toContain('dopaminové nakupování');
  await expect(page.getByRole('link', { name: 'PubMed' }).first()).toHaveAttribute('href', /pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/);
});

test('home carries the category name and the organization entity', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.sticker').first()).toHaveText('Dopaminové objednávání');
  const org = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((j) => JSON.parse(j)).find((d) => d['@type'] === 'Organization');
  expect(org.alternateName).toContain('Damenic');
  expect(org.slogan).toContain('Dopaminové objednávání');
});
