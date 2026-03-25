/**
 * Vitest global setup for E2E tests.
 *
 * Runs once before all test files. Validates that the environment
 * has the prerequisites for E2E testing and prints a warning if not.
 */

export function setup(): void {
  const hasToken = Boolean(process.env.GITHUB_TOKEN) || (() => {
    try {
      const { execFileSync } = require('node:child_process');
      const token = execFileSync('gh', ['auth', 'token'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      return token.length > 0;
    } catch {
      return false;
    }
  })();

  if (!hasToken) {
    console.warn(
      '\n  [E2E] No GITHUB_TOKEN env var and `gh auth token` failed.\n' +
      '  [E2E] E2E tests will be SKIPPED.\n' +
      '  [E2E] Set GITHUB_TOKEN or run `gh auth login` to enable them.\n',
    );
  }
}

export function teardown(): void {
  // Nothing to tear down globally.
}
