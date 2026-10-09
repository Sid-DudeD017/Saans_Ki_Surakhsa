import { defineConfig, devices } from '@playwright/test';

// E2E_BASE_URL points the tests at a server that's already running (e.g. http://localhost:3007);
// without it, Playwright starts `npm run dev` on port 3000 itself.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      // E2E_CHANNEL=chrome uses the installed Google Chrome instead of Playwright's own Chromium download.
      use: { ...devices['Desktop Chrome'], ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}) },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000, // the first compile of a dev server on a CI runner is slow
      },
});
