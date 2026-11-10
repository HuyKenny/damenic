import { test } from '@playwright/test';

// Not assertions: full screens for a human (or Claude) to look at. One file per screen and width.
const shot = async (page: import('@playwright/test').Page, name: string, testInfo: import('@playwright/test').TestInfo) => {
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `shots/${testInfo.project.name}/${name}.png`, fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/${testInfo.project.name}/${name}-mid.png`, fullPage: false });
};

test('main screens', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-11-10T12:00:00') });
  await page.goto('/');
  await shot(page, '01-home', testInfo);
  await page.goto('/restaurace/prazdna-pec/');
  await shot(page, '02-restaurace', testInfo);
  await page.goto('/jidla/pizza-margherita/');
  await page.getByTestId('add-form').getByLabel('32 cm').check();
  await page.getByTestId('add-form').getByRole('button', { name: /Přidat do košíku/ }).click();
  await shot(page, '03-jidlo', testInfo);
  await page.goto('/kosik/');
  await shot(page, '04-kosik', testInfo);
  await page.goto('/pokladna/');
  await shot(page, '05-pokladna', testInfo);
  await page.getByTestId('confirm-order').click();
  await page.clock.runFor(1500);
  await page.waitForURL(/objednavka/);
  await page.clock.runFor(130_000);
  await shot(page, '06-tracking', testInfo);
  await page.getByTestId('skip').click();
  await shot(page, '07-finale', testInfo);
  await page.goto('/recepty/pizza-margherita/');
  await page.getByTestId('add-to-list').click();
  await shot(page, '08-recept', testInfo);
  await page.goto('/nakupni-seznam/');
  await shot(page, '09-nakupni-seznam', testInfo);
});
