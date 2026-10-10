import { defineConfig } from 'vitest/config';

export default defineConfig({
  oxc: {
    jsx: {
      runtime: 'automatic',
    },
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts', 'packages/**/*.test.ts', 'services/**/*.test.ts'],
  },
});
