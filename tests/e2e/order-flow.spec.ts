import { expect, test } from '@playwright/test';
import { MARGHERITA, addMargherita, atNoon, cartCount, hydrated, kc, watchConsole } from './helpers';

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
    await atNoon(page);
    const errors = watchConsole(page);
    await addMargherita(page);
    await page.goto('/pokladna/');
    // The only text field is the simulated promo code. Nothing asks for a name, address, phone, e-mail or card.
    await expect(page.locator('main input:not([name=promo]):not([type=hidden]), main textarea, main select')).toHaveCount(0);
    await expect(page.locator('main [autocomplete^=cc-], main [type=email], main [type=tel], main [autocomplete=name], main [autocomplete*=address]')).toHaveCount(0);
    await expect(page.getByText('Objednávka je pouze simulovaná. Nic neplatíš a žádné jídlo nebude doručeno.')).toBeVisible();
    await expect(page.getByTestId('checkout-real')).toContainText('0 Kč');
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

  test('real-time tracking: countdown, courier at the door, open, finishes once', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-11T11:00:00Z') }); // noon in Prague: restaurants open
    await addMargherita(page);
    await page.goto('/pokladna/');
    await page.getByTestId('confirm-order').click();
    await page.clock.runFor(1500);
    await page.waitForURL(/\/objednavka\/#/);
    const tracker = page.getByTestId('tracker');
    await expect(tracker).toHaveAttribute('data-stage', /accepted|preparing/);
    await expect(page.getByText('Skutečné minuty · smyšlené jídlo')).toBeVisible();
    await expect(page.getByTestId('courier')).toBeVisible();

    // The courier chat answers with a canned line and points to the one real contact (mailto only, nothing is sent).
    await page.getByTestId('chat-courier').click();
    await expect(page.getByTestId('courier-chat')).toBeVisible();
    await expect(page.getByTestId('feedback-mail')).toHaveAttribute('href', /^mailto:info@damenic\.cz\?subject=/);
    await page.getByRole('button', { name: 'Zpátky ke sledování' }).click();
    await expect(page.getByTestId('eta')).toHaveText(/^\d{1,2}:\d{2}$/);
    await expect(page).toHaveTitle(/^\(\d{1,2}:\d{2}\) /);

    // Prázdná pec: 30 min. Real minutes now, not 10× faster.
    await page.clock.runFor(10 * 60_000);
    await expect(tracker).toHaveAttribute('data-stage', 'preparing');
    await page.reload();
    await expect(page.getByTestId('tracker')).toHaveAttribute('data-stage', 'preparing');

    await page.clock.runFor(10 * 60_000);
    await expect(page.getByTestId('tracker')).toHaveAttribute('data-stage', 'onTheWay');
    await expect(page.getByTestId('distance')).toContainText('km');

    // While the courier rides, other pages show the active order.
    await page.goto('/restaurace/');
    await expect(page.getByTestId('orderbar')).toContainText('Kurýr dorazí za');
    await page.getByTestId('orderbar').click();
    await expect(page.getByTestId('tracker')).toBeVisible();

    await page.clock.runFor(8 * 60_000);
    await expect(page.getByTestId('tracker')).toHaveAttribute('data-stage', 'nearby');
    await page.clock.runFor(3 * 60_000);
    await expect(page.getByTestId('tracker')).toHaveAttribute('data-status', 'atDoor');
    await expect(page.getByTestId('door-dialog')).toBeVisible();
    await expect(page).toHaveTitle(/Kurýr je u dveří/);

    // Closing the call keeps the door button on the page; a refresh does not deliver by itself.
    await page.getByRole('button', { name: 'Ještě chvíli' }).click();
    await page.reload();
    await expect(page.getByTestId('tracker')).toHaveAttribute('data-status', 'atDoor');
    await page.getByTestId('door-dialog-open').click();

    const finale = page.getByTestId('finale');
    await expect(finale).toBeVisible();
    await expect(finale).toContainText('DámeNic doručilo přesně to, co slíbilo. Nic.');
    await expect(page.getByTestId('finale-compare')).toBeVisible();
    await expect(page.getByTestId('share-empty')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('finale')).toBeVisible();
    const count = await page.evaluate(() => JSON.parse(localStorage.getItem('damenic:orders:v1') ?? '{}').orders.length);
    expect(count).toBe(1);
    await page.goto('/restaurace/');
    await expect(page.getByTestId('orderbar')).toHaveCount(0);
  });

  test('skip and the way to the recipe and shopping list', async ({ page }) => {
    await atNoon(page);
    await addMargherita(page);
    await page.goto('/pokladna/');
    await page.getByTestId('confirm-order').click();
    await page.waitForURL(/\/objednavka\/#/);
    await page.getByTestId('skip').click();
    await expect(page.getByTestId('door-dialog')).toBeVisible();
    await page.getByTestId('door-dialog-open').click();
    await expect(page.getByTestId('finale')).toBeVisible();
    await page.getByRole('link', { name: 'Uvařit si to doma' }).first().click();
    await expect(page).toHaveURL(/\/recepty\/pizza-margherita\/$/);
    await page.goBack();
    await page.getByTestId('to-shopping').click();
    await expect(page).toHaveURL(/\/nakupni-seznam\/$/);
    await expect(page.getByTestId('list-recipe')).toHaveCount(1);
  });

  test('an order saved before real-time tracking still opens as delivered', async ({ page }) => {
    await atNoon(page);
    await page.goto('/');
    await page.evaluate(() => {
      const order = {
        v: 1, id: 'legacy01', createdAt: Date.now() - 3600_000, city: 'Praha', dropPoint: 'Nikde 0',
        restaurant: { id: 'prazdna-pec', slug: 'prazdna-pec', name: 'Pizzerie Prázdná pec', etaMinutes: 30 },
        lines: [{ dishId: 'margherita', dishSlug: 'margherita', page: false, name: 'Pizza Margherita', qty: 1, unitPrice: 18900, options: [], recipe: null, image: '' }],
        totals: { subtotal: 18900, delivery: 0, fee: 0, total: 18900, count: 1 }, skippedAt: null, cancelledAt: null,
      };
      localStorage.setItem('damenic:orders:v1', JSON.stringify({ v: 1, orders: [order] }));
    });
    await page.goto('/objednavka/#legacy01');
    await expect(page.getByTestId('finale')).toBeVisible();
  });

  test('cancel keeps the order as cancelled', async ({ page }) => {
    await atNoon(page);
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

test.describe('delivery app v2', () => {
  test('filters narrow the list and live in the URL', async ({ page }) => {
    await page.goto('/restaurace/');
    const count = page.getByTestId('result-count');
    await expect(count).toContainText(/restaurac/);
    const all = await page.getByTestId('restaurant-card').count();
    await page.getByTestId('cat-pizza').click();
    await expect(page).toHaveURL(/k=pizza/);
    const pizza = await page.getByTestId('restaurant-card').count();
    expect(pizza).toBeGreaterThan(0);
    expect(pizza).toBeLessThan(all);
    await page.reload();
    await expect(page.getByTestId('cat-pizza')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('open-filters').click();
    await page.getByRole('dialog', { name: 'Filtry' }).getByRole('button', { name: 'Zrušit vše' }).click();
    await page.getByTestId('apply-filters').click();
    await expect(page.getByTestId('restaurant-card')).toHaveCount(all);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://damenic.cz/restaurace/');
  });

  test('dish sheet opens from the menu and validates required options', async ({ page }) => {
    await page.goto('/restaurace/prazdna-pec/');
    const item = page.locator('.menuitem', { hasText: 'Pizza Margherita' });
    await item.scrollIntoViewIfNeeded();
    await hydrated(item);
    await item.getByTestId('open-dish').click();
    const sheet = page.getByRole('dialog', { name: 'Pizza Margherita' });
    await expect(sheet).toBeVisible();
    await sheet.getByRole('button', { name: /Do košíku/ }).click();
    await expect(sheet.getByRole('alert')).toContainText('Velikost');
    await sheet.getByLabel('40 cm').check();
    await sheet.getByRole('button', { name: /Do košíku/ }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByTestId('cart-count').first()).toHaveText('1');
  });

  test('minimum order blocks checkout until reached', async ({ page }) => {
    await page.goto('/jidla/cheeseburger-klasicky/');
    const form = page.getByTestId('add-form');
    for (const group of await form.locator('fieldset').all()) if (await group.getByText('Povinné').count()) await group.locator('input').first().check();
    await form.getByRole('button', { name: /Do košíku/ }).click();
    await page.goto('/kosik/');
    await expect(page.getByTestId('min-order')).toBeVisible();
    await expect(page.getByTestId('to-checkout')).toBeDisabled();
    await page.getByTestId('cart-line').getByRole('button', { name: 'Přidat kus' }).click();
    await expect(page.getByTestId('min-order')).toBeHidden();
    await expect(page.getByTestId('to-checkout')).toHaveAttribute('href', '/pokladna/');
  });

  test('tip, promo code and pickup change the simulated total once', async ({ page }) => {
    await atNoon(page);
    await addMargherita(page);
    await page.goto('/pokladna/');
    const total = () => page.getByTestId('sum-total').innerText().then(kc);
    const base = await total();
    await page.getByTestId('tip-20').click();
    expect(await total()).toBe(base + 20);
    await page.getByTestId('promo-input').fill('nic');
    await page.getByTestId('promo-apply').click();
    await expect(page.getByTestId('sum-discount')).toBeVisible();
    expect(await total()).toBe(base + 20 - 50);
    await page.getByTestId('mode-pickup').first().click();
    await expect(page.getByTestId('drop-point')).toContainText('výdejní okénko');
    expect(await total()).toBe(base - 50); // no tip and no delivery when picking up
    await page.getByTestId('confirm-order').click();
    await page.waitForURL(/\/objednavka\/#/);
    const order = await page.evaluate(() => JSON.parse(localStorage.getItem('damenic:orders:v1') ?? '{}').orders[0]);
    expect(order.mode).toBe('pickup');
    expect(order.totals.discount).toBe(5000);
    // Pickup ends at the counter: no doorbell, a "Vyzvednout" button instead.
    await page.getByTestId('skip').click();
    await expect(page.getByTestId('open-door')).toContainText('Vyzvednout');
    await expect(page.getByTestId('door-dialog')).toHaveCount(0);
    await page.getByTestId('open-door').click();
    await expect(page.getByTestId('finale')).toContainText('Taška je vyzvednutá');
  });

  test('recipe hub and sitemaps exist', async ({ page, request }) => {
    await page.goto('/recepty/kuchyne/ceska/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('české kuchyně');
    const idx = await request.get('/sitemap-index.xml');
    expect(idx.status()).toBe(200);
    const rec = await (await request.get('/sitemap-recepty.xml')).text();
    expect(rec).toContain('/recepty/svickova-na-smetane/');
    expect(rec).toContain('<image:loc>');
    const pages = await (await request.get('/sitemap-stranky.xml')).text();
    expect(pages).not.toContain('/kosik/');
  });
});

