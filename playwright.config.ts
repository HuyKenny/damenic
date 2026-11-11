import { defineConfig, devices } from '@playwright/test';

// Runs only on GitHub-hosted runners, against the production build served by `astro preview`.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'cs-CZ',
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:4321', localStorage: [{ name: 'damenic:consent:v1', value: 'denied' }] }] }, // the consent banner is tested in consent.spec.ts
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: { command: 'npm run preview', url: 'http://localhost:4321', reuseExistingServer: false, timeout: 60_000 },
});
