import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { productionPage, resetRoutes } from './tests/browser/commands';

export const browserConfig = defineConfig({
  test: {
    include: ['tests/browser/**/*.spec.ts'],
    setupFiles: ['./tests/browser/setup.ts'],
    globalSetup: ['./tests/browser/globalSetup.ts'],
    maxWorkers: 2,
    fileParallelism: false,
    testTimeout: 45_000,
    expect: { poll: { timeout: 15_000 } },
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
      screenshotFailures: false,
      trace: 'off',
      commands: { productionPage, resetRoutes },
    },
  },
});
