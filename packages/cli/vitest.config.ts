import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30_000,
    passWithNoTests: false,
    include: ['tests/unit/**/*.test.ts'],
  },
});
