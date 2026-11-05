import { defineConfig, devices } from '@playwright/test';

/**
 * E2E (5.6). Runs against `vite preview` of the production build (HTTPS with a self-signed cert).
 * Projects:
 *  - movil: the star journey on a Pixel 5 profile, specs in e2e/<front>/*.spec.ts
 *  - avion: the offline promise (load online, wait for the SW, go offline, reload), e2e/**\/*.avion.spec.ts
 */
const PORT = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `https://localhost:${PORT}/`,
    ignoreHTTPSErrors: true,
    // `ignoreHTTPSErrors` does not cover service worker scripts: Chromium refuses to register a worker
    // over the self-signed preview certificate without this switch, so the airplane-mode gates need it.
    launchOptions: { args: ['--ignore-certificate-errors'] },
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'movil', use: { ...devices['Pixel 5'] }, testIgnore: /\.avion\.spec\.ts$/ },
    { name: 'avion', use: { ...devices['Pixel 5'], serviceWorkers: 'allow' }, testMatch: /\.avion\.spec\.ts$/ },
  ],
  webServer: {
    command: `npm run build -w @rikuy/web && npm run preview -w @rikuy/web -- --port ${PORT} --strictPort`,
    url: `https://localhost:${PORT}/`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
