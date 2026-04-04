/**
 * Vitest global setup for E2E tests.
 *
 * Runs once before all test files. Validates that the environment
 * has the prerequisites for E2E testing (GitHub token + remote)
 * and prints diagnostic info. Teardown cleans orphaned temp resources.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// ── Token + Remote Detection ────────────────────────────────────────

function hasGitHubToken(): boolean {
  if (process.env.GITHUB_TOKEN) return true;
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return token.length > 0;
  } catch {
    return false;
  }
}

function hasGitHubRemote(): boolean {
  try {
    const url = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return url.includes('github.com');
  } catch {
    return false;
  }
}

function getRemoteUrl(): string {
  try {
    return execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '(unknown)';
  }
}

// ── Orphaned Resource Cleanup ───────────────────────────────────────

const E2E_TMP_PREFIX = 'maxsimcli-e2e-test-';

/**
 * Remove stale temp directories from previous E2E runs.
 * Only removes directories older than 1 hour to avoid interfering
 * with concurrent test runs.
 */
function cleanOrphanedTempDirs(): number {
  const tmpBase = os.tmpdir();
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  let cleaned = 0;

  try {
    const entries = fs.readdirSync(tmpBase, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith(E2E_TMP_PREFIX)) {
        continue;
      }
      const fullPath = path.join(tmpBase, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < oneHourAgo) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          cleaned++;
        }
      } catch {
        // Skip entries we cannot stat or remove.
      }
    }
  } catch {
    // Cannot read tmpdir — nothing to clean.
  }

  return cleaned;
}

// ── Global Setup / Teardown ─────────────────────────────────────────

export function setup(): void {
  const tokenOk = hasGitHubToken();
  const remoteOk = hasGitHubRemote();

  if (!tokenOk || !remoteOk) {
    const reasons: string[] = [];
    if (!tokenOk) reasons.push('No GITHUB_TOKEN and `gh auth token` failed');
    if (!remoteOk) reasons.push('No GitHub remote detected on origin');

    console.warn(
      '\n  [E2E] Prerequisites not met — E2E tests will be SKIPPED.\n' +
      reasons.map((r) => `  [E2E]   - ${r}`).join('\n') + '\n' +
      '  [E2E] Set GITHUB_TOKEN or run `gh auth login`, and ensure a GitHub remote.\n',
    );
    return;
  }

  const remoteUrl = getRemoteUrl();
  console.log(
    `\n  [E2E] Target repo: ${remoteUrl}\n` +
    `  [E2E] Token source: ${process.env.GITHUB_TOKEN ? 'GITHUB_TOKEN env' : 'gh auth token'}\n`,
  );
}

export function teardown(): void {
  const cleaned = cleanOrphanedTempDirs();
  if (cleaned > 0) {
    console.log(`  [E2E] Teardown: cleaned ${cleaned} orphaned temp dir(s).\n`);
  }
}
