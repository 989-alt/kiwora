import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  // Parallel WebKit + Chromium workers run this 8 GB machine out of memory (page crashes), so run one at a time.
  workers: 1,
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    {
      name: 'galaxy-tab',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        viewport: { width: 1280, height: 800 },
        hasTouch: true,
      },
    },
    {
      name: 'ipad',
      use: {
        ...devices['Desktop Safari'],
        browserName: 'webkit',
        viewport: { width: 1180, height: 820 },
        hasTouch: true,
      },
    },
  ],
})
