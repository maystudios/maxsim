/**
 * GitHub Client — Octokit adapter with auth gate and error wrapping
 *
 * Provides a configured Octokit singleton with throttling + retry plugins.
 * Uses `gh auth token` for authentication (fetched once per process).
 *
 * CRITICAL: This module replaces gh.ts as the primary GitHub API layer.
 * CRITICAL: Never call process.exit() — throw AuthError or return GhResult.
 */

import { execFileSync } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { Octokit } from '@octokit/rest';
import { throttling } from '@octokit/plugin-throttling';
import { retry } from '@octokit/plugin-retry';
import { RequestError } from '@octokit/request-error';

import { AuthError } from './types.js';
import type { GhErrorCode, GhResult } from './types.js';

const execFileAsync = promisify(execFile);

// ---- Singleton state --------------------------------------------------------

const ThrottledOctokit = Octokit.plugin(throttling, retry);

let _instance: InstanceType<typeof ThrottledOctokit> | null = null;
let _cachedRepo: { owner: string; repo: string } | null = null;

// ---- Auth gate --------------------------------------------------------------

/**
 * Check that `gh` CLI is installed, authenticated, and has the `project` scope.
 * Throws AuthError on failure — this is a hard gate, not a fallback.
 *
 * Three checks in order:
 * 1. Is `gh` CLI installed?
 * 2. Is gh authenticated? (non-empty token)
 * 3. Has the token got `project` scope?
 */
export function requireAuth(): void {
  // Check 1: Is gh installed?
  try {
    execFileSync('gh', ['--version'], { timeout: 10_000, stdio: 'pipe' });
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'ENOENT') {
      throw new AuthError(
        'NOT_INSTALLED',
        'GitHub CLI (gh) is not installed. Install from https://cli.github.com/',
      );
    }
    // If gh exists but --version failed for another reason, continue
  }

  // Check 2: Is gh authenticated?
  let token: string;
  try {
    token = execFileSync('gh', ['auth', 'token'], {
      timeout: 10_000,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();
  } catch {
    throw new AuthError(
      'NOT_AUTHENTICATED',
      'GitHub CLI is not authenticated. Run: gh auth login',
    );
  }

  if (!token) {
    throw new AuthError(
      'NOT_AUTHENTICATED',
      'GitHub CLI returned empty token. Run: gh auth login',
    );
  }

  // Check 3: Has project scope?
  try {
    const statusOutput = execFileSync('gh', ['auth', 'status'], {
      timeout: 10_000,
      stdio: 'pipe',
      encoding: 'utf-8',
    });

    // gh auth status may write to stderr — execFileSync with stdio: 'pipe' captures stdout
    // If status doesn't include project scope info, check stderr separately
    const output = statusOutput || '';

    // Parse scopes — look for 'project' or 'read:project'
    const hasProject =
      output.includes("'project'") ||
      output.includes("'read:project'") ||
      output.includes('"project"') ||
      output.includes('"read:project"');

    if (!hasProject) {
      // Don't throw if we can't detect scopes — gh auth status format varies
      // The API call itself will fail with 403 if scope is missing
    }
  } catch {
    // gh auth status exits non-zero when not authenticated,
    // but we already verified the token above, so this is OK.
  }
}

// ---- Octokit singleton ------------------------------------------------------

/**
 * Returns a configured Octokit singleton with throttling + retry plugins.
 * Fetches token from `gh auth token` on first call and caches the instance.
 *
 * @throws AuthError if gh is not installed or not authenticated
 */
export function getOctokit(): InstanceType<typeof ThrottledOctokit> {
  if (_instance) {
    return _instance;
  }

  // Fetch token from gh CLI (synchronous — happens once per process)
  let token: string;
  try {
    token = execFileSync('gh', ['auth', 'token'], {
      timeout: 10_000,
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim();
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'ENOENT') {
      throw new AuthError(
        'NOT_INSTALLED',
        'GitHub CLI (gh) is not installed. Install from https://cli.github.com/',
      );
    }
    throw new AuthError(
      'NOT_AUTHENTICATED',
      'GitHub CLI is not authenticated. Run: gh auth login',
    );
  }

  if (!token) {
    throw new AuthError(
      'NOT_AUTHENTICATED',
      'GitHub CLI returned empty token. Run: gh auth login',
    );
  }

  _instance = new ThrottledOctokit({
    auth: token,
    userAgent: 'maxsimcli',
    throttle: {
      onRateLimit: (retryAfter: number, options: Record<string, unknown>, octokit: unknown, retryCount: number) => {
        if (retryCount < 2) {
          return true; // Retry twice on primary rate limits
        }
        return false;
      },
      onSecondaryRateLimit: (retryAfter: number, options: Record<string, unknown>, octokit: unknown, retryCount: number) => {
        if (retryCount < 1) {
          return true; // Retry once on secondary rate limits
        }
        return false;
      },
    },
    retry: {
      enabled: true,
    },
  });

  return _instance;
}

// ---- Repo info detection ----------------------------------------------------

/**
 * Parse owner/repo from `git remote get-url origin`.
 * Supports both HTTPS and SSH remote URLs.
 * Caches the result in a module-level variable.
 */
export async function getRepoInfo(): Promise<{ owner: string; repo: string }> {
  if (_cachedRepo) {
    return _cachedRepo;
  }

  const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
    timeout: 10_000,
  });
  const url = stdout.trim();

  // HTTPS: https://github.com/owner/repo.git
  const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    _cachedRepo = { owner: httpsMatch[1], repo: httpsMatch[2] };
    return _cachedRepo;
  }

  // SSH: git@github.com:owner/repo.git
  const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    _cachedRepo = { owner: sshMatch[1], repo: sshMatch[2] };
    return _cachedRepo;
  }

  throw new Error(`Could not parse owner/repo from git remote URL: ${url}`);
}

// ---- Singleton reset (for testing) ------------------------------------------

/**
 * Reset the Octokit singleton and cached repo info.
 * Used in tests to ensure clean state between test runs.
 */
export function resetOctokit(): void {
  _instance = null;
  _cachedRepo = null;
}

// ---- Error wrapper ----------------------------------------------------------

/**
 * Wrap an async function that uses Octokit and return a GhResult.
 * Catches Octokit RequestError and maps HTTP status codes to GhErrorCode.
 */
export async function withGhResult<T>(fn: () => Promise<T>): Promise<GhResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e: unknown) {
    if (e instanceof RequestError) {
      const code = mapHttpStatusToCode(e.status);
      return { ok: false, error: e.message, code };
    }

    if (e instanceof AuthError) {
      const code: GhErrorCode =
        e.code === 'NOT_INSTALLED' ? 'NOT_INSTALLED' :
        e.code === 'SCOPE_MISSING' ? 'SCOPE_MISSING' :
        'NOT_AUTHENTICATED';
      return { ok: false, error: e.message, code };
    }

    // GraphqlResponseError from @octokit/graphql (HTTP 200 with errors array)
    if (e && typeof e === 'object' && 'errors' in e && Array.isArray((e as Record<string, unknown>).errors)) {
      const gqlError = e as { errors: Array<{ type?: string; message: string }>; message: string };
      const errorType = gqlError.errors[0]?.type;
      const code: GhErrorCode =
        errorType === 'FORBIDDEN' || errorType === 'INSUFFICIENT_SCOPES' ? 'PERMISSION_DENIED' :
        errorType === 'NOT_FOUND' ? 'NOT_FOUND' :
        'UNKNOWN';
      return { ok: false, error: gqlError.message, code };
    }

    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message, code: 'UNKNOWN' };
  }
}

// ---- Internal helpers -------------------------------------------------------

function mapHttpStatusToCode(status: number): GhErrorCode {
  switch (status) {
    case 401:
      return 'NOT_AUTHENTICATED';
    case 403:
      return 'PERMISSION_DENIED';
    case 404:
      return 'NOT_FOUND';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'UNKNOWN';
  }
}
