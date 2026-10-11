import { defineConfig } from 'vitest/config';

const TEST_DB_URL = "postgres://saans:saans@127.0.0.1:5433/saans_test";

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'packages/**/*.test.ts', 'services/**/*.test.ts'],
    globalSetup: './vitest.globalSetup.ts',
    env: {
      SAANS_DATABASE_URL: TEST_DB_URL,
    },
  },
});
