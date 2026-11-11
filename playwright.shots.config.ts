import { defineConfig } from '@playwright/test';

// Screenshots of the main screens at four widths, uploaded as a CI artifact for visual review.
export default defineConfig({
  testDir: 'tests/shots',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4321',
    locale: 'cs-CZ',
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:4321', localStorage: [{ name: 'damenic:consent:v1', value: 'denied' }] }] }, // the consent banner is tested in consent.spec.ts
  },
  projects: [
    { name: 'w360', use: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
    { name: 'w390', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } },
    { name: 'w768', use: { viewport: { width: 768, height: 1024 }, deviceScaleFactor: 1 } },
    { name: 'w1440', use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  ],
  webServer: { command: 'npm run preview', url: 'http://localhost:4321', reuseExistingServer: false, timeout: 60_000 },
});
