import { expect, type Page } from '@playwright/test';

export const MARGHERITA = '/jidla/pizza-margherita/';

/** Fails the test on any console error or uncaught exception. */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

export async function addMargherita(page: Page, size = '32 cm') {
  await page.goto(MARGHERITA);
  const form = page.getByTestId('add-form');
  await form.getByLabel(size).check();
  await form.getByRole('button', { name: /Přidat do košíku/ }).click();
  await expect(form.locator('.added')).toContainText('Přidáno do košíku');
}

export async function cartCount(page: Page) {
  return Number(await page.getByTestId('cart-count').first().innerText());
}

export const kc = (text: string) => Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
