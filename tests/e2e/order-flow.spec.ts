import { expect, test } from '@playwright/test';
import { MARGHERITA, addMargherita, cartCount, kc, watchConsole } from './helpers';

test.describe('cart', () => {
  test('required options are enforced', async ({ page }) => {
    await page.goto(MARGHERITA);
    const form = page.getByTestId('add-form');
    await form.getByRole('button', { name: /Do košíku/ }).click();
    await expect(form.getByRole('alert')).toContainText('Vyber: Velikost');
    expect(await cartCount(page)).toBe(0);
  });

  test('add, change quantity, keep different configurations apart, survive refresh', async ({ page }) => {
    const errors = watchConsole(page);
    await addMargherita(page, '32 cm');
    await addMargherita(page, '32 cm');
    await addMargherita(page, '40 cm');
    await page.goto('/kosik/');
    const lines = page.getByTestId('cart-line');
    await expect(lines).toHaveCount(2);
    await expect(lines.first().getByTestId('line-qty')).toHaveText('2');
    expect(kc(await page.getByTestId('sum-subtotal').innerText())).toBe(2 * 189 + 249);

    await lines.first().getByRole('button', { name: 'Přidat kus' }).click();
    await expect(lines.first().getByTestId('line-qty')).toHaveText('3');
    expect(kc(await page.getByTestId('sum-subtotal').innerText())).toBe(3 * 189 + 249);
    const total = kc(await page.getByTestId('sum-total').innerText());
    expect(total).toBe(3 * 189 + 249 + kc(await page.getByTestId('sum-delivery').innerText()) + 15);

    await page.reload();
    await expect(page.getByTestId('cart-line')).toHaveCount(2);
    expect(await cartCount(page)).toBe(4);
    expect(errors).toEqual([]);
  });

  test('switching restaurants asks first and keeps the cart on cancel', async ({ page }) => {
    await addMargherita(page);
    await page.goto('/jidla/cheeseburger-klasicky/');
    const form = page.getByTestId('add-form');
    for (const group of await form.locator('fieldset').all()) {
      if (await group.getByText('Povinné').count()) await group.locator('input').first().check();
    }
    await form.getByRole('button', { name: /Do košíku/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Začít nový košík?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Nechat původní košík' }).click();
    await expect(dialog).toBeHidden();
    expect(await cartCount(page)).toBe(1);

    await form.getByRole('button', { name: /Do košíku/ }).click();
    await page.getByRole('dialog', { name: 'Začít nový košík?' }).getByRole('button', { name: 'Vyprázdnit a přidat' }).click();
    await page.goto('/kosik/');
    await expect(page.getByTestId('cart-line')).toHaveCount(1);
    await expect(page.getByTestId('cart-line')).toContainText(/cheeseburger/i);
  });

  test('empty cart offers a way back', async ({ page }) => {
    await page.goto('/kosik/');
    await expect(page.getByTestId('cart-empty').getByRole('link', { name: 'Vybrat jídlo' })).toHaveAttribute('href', '/restaurace/');
  });
});

test.describe('checkout and tracking', () => {
  test('checkout asks for no personal or payment data and double click creates one order', async ({ page }) => {
    const errors = watchConsole(page);
    await addMargherita(page);
    await page.goto('/pokladna/');
    await expect(page.locator('main input:not([type=hidden]), main textarea, main select')).toHaveCount(0);
    await expect(page.getByText('Objednávka je pouze simulovaná. Nic neplatíš a žádné jídlo nebude doručeno.')).toBeVisible();
    await expect(page.getByTestId('checkout-real')).toHaveText('0 Kč');
    const button = page.getByTestId('confirm-order');
    await expect(button).toHaveText('Objednat nanečisto za 0 Kč');
    await button.dblclick();
    await button.click({ force: true }).catch(() => {});
    await page.waitForURL(/\/objednavka\/#/);
    const orders = await page.evaluate(() => JSON.parse(localStorage.getItem('damenic:orders:v1') ?? '{}').orders.length);
    expect(orders).toBe(1);
    expect(await cartCount(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('tracking follows the clock, survives refresh and finishes once', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-10T12:00:00') });
    await addMargherita(page);
    await page.goto('/pokladna/');
    await page.getByTestId('confirm-order').click();
    await page.clock.runFor(1500);
    await page.waitForURL(/\/objednavka\/#/);
    const tracker = page.getByTestId('tracker');
    await expect(tracker).toHaveAttribute('data-stage', /accepted|preparing/);
    await expect(page.getByText('Zrychlená simulace 10×')).toBeVisible();

    await page.clock.runFor(60_000);
    await expect(tracker).toHaveAttribute('data-stage', 'preparing');
    await page.reload();
    await expect(page.getByTestId('tracker')).toHaveAttribute('data-stage', 'preparing');

    await page.clock.runFor(70_000);
    await expect(page.getByTestId('tracker')).toHaveAttribute('data-stage', 'onTheWay');

    await page.clock.runFor(60_000);
    const finale = page.getByTestId('finale');
    await expect(finale).toBeVisible();
    await expect(finale).toContainText('DámeNic doručilo přesně to, co slíbilo. Nic.');
    await expect(page.getByTestId('finale-compare')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('finale')).toBeVisible();
    const count = await page.evaluate(() => JSON.parse(localStorage.getItem('damenic:orders:v1') ?? '{}').orders.length);
    expect(count).toBe(1);
  });

  test('skip and the way to the recipe and shopping list', async ({ page }) => {
    await addMargherita(page);
    await page.goto('/pokladna/');
    await page.getByTestId('confirm-order').click();
    await page.waitForURL(/\/objednavka\/#/);
    await page.getByTestId('skip').click();
    await expect(page.getByTestId('finale')).toBeVisible();
    await page.getByRole('link', { name: 'Uvařit si to doma' }).first().click();
    await expect(page).toHaveURL(/\/recepty\/pizza-margherita\/$/);
    await page.goBack();
    await page.getByTestId('to-shopping').click();
    await expect(page).toHaveURL(/\/nakupni-seznam\/$/);
    await expect(page.getByTestId('list-recipe')).toHaveCount(1);
  });

  test('cancel keeps the order as cancelled', async ({ page }) => {
    await addMargherita(page);
    await page.goto('/pokladna/');
    await page.getByTestId('confirm-order').click();
    await page.waitForURL(/\/objednavka\/#/);
    await page.getByTestId('cancel').click();
    await page.getByTestId('cancel-confirm').click();
    await expect(page.getByTestId('tracker')).toHaveAttribute('data-status', 'cancelled');
    await page.goto('/moje-objednavky/');
    await expect(page.getByTestId('history-item')).toContainText('Zrušeno');
  });

  test('unknown or missing order', async ({ page }) => {
    await page.goto('/objednavka/#neexistuje');
    await expect(page.getByTestId('order-missing')).toContainText('Tuhle objednávku tady nevidíme');
    await page.goto('/objednavka/');
    await expect(page.getByTestId('order-missing')).toContainText('Žádná objednávka');
  });
});
