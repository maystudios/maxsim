import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    globalSetup: ['./tests/e2e/globalSetup.ts'],
    include: ['tests/e2e/**/*.test.ts'],
  },
});
