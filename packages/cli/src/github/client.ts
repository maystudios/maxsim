/**
 * GitHub client — authentication, Octokit setup, gh CLI wrapper.
 */

import { execFileSync } from 'node:child_process';
import { Octokit } from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import type { RepoInfo, GhResult } from './types.js';

// ── Singleton ─────────────────────────────────────────────────────────

let _octokit: Octokit | null = null;
let _repoInfo: RepoInfo | null = null;

/** Get or create the authenticated Octokit instance. */
export function getOctokit(): Octokit {
  if (_octokit) return _octokit;

  const token = getGhToken();
  const OctokitWithPlugins = Octokit.plugin(retry, throttling);

  _octokit = new OctokitWithPlugins({
    auth: token,
    throttle: {
      onRateLimit: (_retryAfter: number, _options: Record<string, unknown>, _oct: Octokit, retryCount: number) => {
        return retryCount < 2;
      },
      onSecondaryRateLimit: () => {
        return false;
      },
    },
  });

  return _octokit;
}

/** Get the GitHub token from gh CLI. */
function getGhToken(): string {
  try {
    const token = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!token) {
      throw new Error('Empty token returned by gh auth token');
    }

    return token;
  } catch {
    throw new Error(
      'GitHub authentication required. Run: gh auth login',
    );
  }
}

/** Detect repo owner and name from git remote. */
export function getRepoInfo(): RepoInfo {
  if (_repoInfo) return _repoInfo;

  try {
    const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const match = remoteUrl.match(
      /(?:github\.com)[/:]([^/]+)\/([^/.]+?)(?:\.git)?$/,
    );

    if (!match) {
      throw new Error(`Cannot parse GitHub owner/repo from remote: ${remoteUrl}`);
    }

    const [, owner, repo] = match;

    // Detect if owner is org or user
    let isOrg = false;
    try {
      const typeCheck = execFileSync('gh', ['api', `/users/${owner}`, '-q', '.type'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim();
      isOrg = typeCheck === 'Organization';
    } catch {
      // Default to user if detection fails
    }

    _repoInfo = { owner, repo, isOrg };
    return _repoInfo;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Cannot parse')) {
      throw err;
    }
    throw new Error(
      'Not a git repository with a GitHub remote. Run: git remote add origin <url>',
    );
  }
}

/** Execute a gh CLI command and return parsed JSON. */
export function ghJson<T>(args: string[]): GhResult<T> {
  try {
    const stdout = execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    try {
      return { ok: true, data: JSON.parse(stdout) as T };
    } catch {
      return { ok: true, data: stdout.trim() as unknown as T };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    if (msg.includes('404') || msg.includes('Not Found')) {
      return { ok: false, error: msg, code: 'NOT_FOUND' };
    }
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('auth')) {
      return { ok: false, error: msg, code: 'UNAUTHORIZED' };
    }
    if (msg.includes('403') || msg.includes('rate limit')) {
      return { ok: false, error: msg, code: 'RATE_LIMITED' };
    }
    if (msg.includes('422') || msg.includes('Validation')) {
      return { ok: false, error: msg, code: 'VALIDATION' };
    }

    return { ok: false, error: msg, code: 'UNKNOWN' };
  }
}

/** Execute a gh CLI command and return raw stdout. */
export function ghExec(args: string[]): GhResult<string> {
  try {
    const stdout = execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true, data: stdout.trim() };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg, code: 'UNKNOWN' };
  }
}

/** Wrap an async Octokit operation with error classification. */
export async function withGhResult<T>(
  fn: () => Promise<T>,
): Promise<GhResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = (err as { status?: number }).status;

    if (status === 404) return { ok: false, error: msg, code: 'NOT_FOUND' };
    if (status === 401) return { ok: false, error: msg, code: 'UNAUTHORIZED' };
    if (status === 403) return { ok: false, error: msg, code: 'RATE_LIMITED' };
    if (status === 422) return { ok: false, error: msg, code: 'VALIDATION' };

    return { ok: false, error: msg, code: 'UNKNOWN' };
  }
}

/** Reset cached singletons (for testing). */
export function resetClient(): void {
  _octokit = null;
  _repoInfo = null;
}
