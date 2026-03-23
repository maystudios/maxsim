/**
 * Unit tests for packages/cli/src/github/client.ts
 *
 * NOTE: classifyGhError is a private (unexported) function. Its behaviour is
 * tested indirectly through ghJson() and ghExec(), which both delegate to it
 * when execFileSync throws.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (hoisted before imports) ─────────────────────────────

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

// Provide a minimal Octokit stub so getOctokit() can construct an instance
// without hitting the network or needing a real gh token.
// IMPORTANT: vi.fn() wraps implementations as arrow functions, which are not
// constructable. We must use a named function expression so `new` works.
vi.mock('@octokit/rest', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const OctokitMock: any = vi.fn(function OctokitStub() { return {}; });
  // plugin() is called as Octokit.plugin(retry, throttling) and must return
  // something that can be used with `new`.
  OctokitMock.plugin = vi.fn().mockReturnValue(OctokitMock);
  return { Octokit: OctokitMock };
});

vi.mock('@octokit/plugin-retry', () => ({ retry: vi.fn() }));
vi.mock('@octokit/plugin-throttling', () => ({ throttling: vi.fn() }));

// ── Imports ───────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { Octokit } from '@octokit/rest';
import {
  getRepoInfo,
  ghJson,
  ghExec,
  getOctokit,
  resetClient,
} from '../../src/github/client.js';
import type { GhResult, RepoInfo } from '../../src/github/types.js';

// Typed alias so TypeScript knows this is a mock
const mockExecFileSync = execFileSync as ReturnType<typeof vi.fn>;
const MockOctokit = Octokit as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

/** Make execFileSync return a value for every call until overridden. */
function stubExec(returnValue: string): void {
  mockExecFileSync.mockReturnValue(returnValue);
}

/** Make execFileSync throw on every call until overridden. */
function failExec(message: string): void {
  mockExecFileSync.mockImplementation(() => {
    throw new Error(message);
  });
}

// ─────────────────────────────────────────────────────────────────────
// resetClient()
// ─────────────────────────────────────────────────────────────────────

describe('resetClient()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // After resetAllMocks() all mock implementations are cleared.
    // Re-stub the Octokit constructor (must be a real function, not an arrow,
    // so that `new OctokitWithPlugins(...)` works) and its .plugin() method.
    MockOctokit.mockImplementation(function OctokitStub() { return {}; });
    MockOctokit.plugin = vi.fn().mockReturnValue(MockOctokit);
    resetClient();
  });

  it('clears the cached Octokit instance so the constructor is called again after reset', () => {
    // Prime the token fetch so getOctokit() succeeds
    stubExec('ghs_faketoken\n');
    getOctokit();

    // Reset clears the singleton
    resetClient();

    // Second call must construct a fresh instance
    stubExec('ghs_faketoken\n');
    getOctokit();

    // MockOctokit (the plugged-in class) was constructed twice
    expect(MockOctokit).toHaveBeenCalledTimes(2);
  });

  it('clears the cached RepoInfo so getRepoInfo() re-executes on the next call', () => {
    // First successful resolution
    mockExecFileSync
      .mockReturnValueOnce('https://github.com/owner-a/repo-a.git\n') // git remote
      .mockReturnValueOnce('User\n');                                  // gh api .type

    const first: RepoInfo = getRepoInfo();
    expect(first.owner).toBe('owner-a');

    // After reset the cache is gone
    resetClient();

    // Second resolution returns different data
    mockExecFileSync
      .mockReturnValueOnce('https://github.com/owner-b/repo-b.git\n')
      .mockReturnValueOnce('Organization\n');

    const second: RepoInfo = getRepoInfo();
    expect(second.owner).toBe('owner-b');
    expect(second.repo).toBe('repo-b');
    expect(second.isOrg).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
// getRepoInfo()
// ─────────────────────────────────────────────────────────────────────

describe('getRepoInfo()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetClient();
  });

  // ── Success cases ──────────────────────────────────────────────────

  it('parses HTTPS remote URL and returns owner, repo, isOrg=false for a user', () => {
    mockExecFileSync
      .mockReturnValueOnce('https://github.com/alice/my-project.git\n')
      .mockReturnValueOnce('User\n');

    const info = getRepoInfo();
    expect(info.owner).toBe('alice');
    expect(info.repo).toBe('my-project');
    expect(info.isOrg).toBe(false);
  });

  it('parses SSH remote URL (git@github.com:owner/repo.git)', () => {
    mockExecFileSync
      .mockReturnValueOnce('git@github.com:myorg/myrepo.git\n')
      .mockReturnValueOnce('Organization\n');

    const info = getRepoInfo();
    expect(info.owner).toBe('myorg');
    expect(info.repo).toBe('myrepo');
    expect(info.isOrg).toBe(true);
  });

  it('parses HTTPS remote URL without .git suffix', () => {
    mockExecFileSync
      .mockReturnValueOnce('https://github.com/alice/my-project\n')
      .mockReturnValueOnce('User\n');

    const info = getRepoInfo();
    expect(info.owner).toBe('alice');
    expect(info.repo).toBe('my-project');
  });

  it('defaults isOrg=false when the gh api type-check call fails', () => {
    mockExecFileSync
      .mockReturnValueOnce('https://github.com/bob/cool-tool.git\n')
      .mockImplementationOnce(() => { throw new Error('gh: not authenticated'); });

    const info = getRepoInfo();
    expect(info.owner).toBe('bob');
    expect(info.repo).toBe('cool-tool');
    expect(info.isOrg).toBe(false);
  });

  it('caches the result — execFileSync is not called again on the second invocation', () => {
    mockExecFileSync
      .mockReturnValueOnce('https://github.com/alice/my-project.git\n')
      .mockReturnValueOnce('User\n');

    const first = getRepoInfo();
    const second = getRepoInfo();

    expect(first).toBe(second); // same cached reference
    // execFileSync was only called for the first resolution (2 calls: git remote + gh api)
    expect(mockExecFileSync).toHaveBeenCalledTimes(2);
  });

  // ── Failure cases ──────────────────────────────────────────────────

  it('throws with a helpful message when git remote call fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('fatal: not a git repository');
    });

    expect(() => getRepoInfo()).toThrow(
      'Not a git repository with a GitHub remote. Run: git remote add origin <url>',
    );
  });

  it('throws with a parse error when the remote URL is not a GitHub URL', () => {
    mockExecFileSync
      .mockReturnValueOnce('https://gitlab.com/someone/something.git\n')
      .mockReturnValueOnce('User\n'); // won't be reached

    expect(() => getRepoInfo()).toThrow('Cannot parse GitHub owner/repo from remote');
  });

  it('throws when remote URL is completely unrecognisable', () => {
    mockExecFileSync.mockReturnValueOnce('not-a-url\n');

    expect(() => getRepoInfo()).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────
// ghJson<T>()
// ─────────────────────────────────────────────────────────────────────

describe('ghJson()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetClient();
  });

  // ── Success ────────────────────────────────────────────────────────

  it('returns { ok: true, data } with the parsed JSON object on success', () => {
    stubExec(JSON.stringify({ number: 1, title: 'Test issue' }));

    const result = ghJson<{ number: number; title: string }>(['issue', 'view', '1', '--json', 'number,title']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.number).toBe(1);
      expect(result.data.title).toBe('Test issue');
    }
  });

  it('returns { ok: true, data } with a JSON array on success', () => {
    stubExec(JSON.stringify([{ id: 1 }, { id: 2 }]));

    const result = ghJson<Array<{ id: number }>>(['issue', 'list', '--json', 'id']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(1);
    }
  });

  it('passes the args array directly to execFileSync', () => {
    stubExec('{}');
    const args = ['api', '/repos/owner/repo'];
    ghJson(args);

    expect(mockExecFileSync).toHaveBeenCalledWith('gh', args, expect.any(Object));
  });

  // ── Non-JSON response ──────────────────────────────────────────────

  it('returns UNKNOWN error when execFileSync returns non-JSON text', () => {
    stubExec('this is not json');

    const result = ghJson(['issue', 'view', '1']);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNKNOWN');
      expect(result.error).toBe('Unexpected non-JSON response');
    }
  });

  it('returns UNKNOWN error when execFileSync returns an empty string', () => {
    stubExec('');

    const result = ghJson(['issue', 'list']);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNKNOWN');
    }
  });

  // ── Error classification (via classifyGhError) ─────────────────────

  it('classifies 404 / Not Found errors as NOT_FOUND', () => {
    failExec('HTTP 404: Not Found');
    const result = ghJson(['issue', 'view', '9999']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
  });

  it('classifies "Not Found" string without status code as NOT_FOUND', () => {
    failExec('resource Not Found');
    const result = ghJson(['api', '/repos/x/y']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
  });

  it('classifies 401 / Unauthorized errors as UNAUTHORIZED', () => {
    failExec('HTTP 401: Unauthorized');
    const result = ghJson(['issue', 'list']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNAUTHORIZED');
  });

  it('classifies auth-related errors as UNAUTHORIZED', () => {
    failExec('authentication required: run gh auth login');
    const result = ghJson(['issue', 'list']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNAUTHORIZED');
  });

  it('classifies 403 / Forbidden (non-rate-limit) errors as FORBIDDEN', () => {
    failExec('HTTP 403: Forbidden');
    const result = ghJson(['issue', 'create']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('classifies 403 with "rate limit" in the message as RATE_LIMITED', () => {
    failExec('HTTP 403: rate limit exceeded');
    const result = ghJson(['issue', 'list']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('RATE_LIMITED');
  });

  it('classifies 422 / Validation errors as VALIDATION', () => {
    failExec('HTTP 422: Validation Failed');
    const result = ghJson(['issue', 'create', '--title', '']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('VALIDATION');
  });

  it('classifies "Validation" string without status code as VALIDATION', () => {
    failExec('Validation error on field "title"');
    const result = ghJson(['issue', 'create']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('VALIDATION');
  });

  it('classifies unrecognised errors as UNKNOWN', () => {
    failExec('Something completely unexpected happened');
    const result = ghJson(['api', '/whatever']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNKNOWN');
      expect(result.error).toContain('Something completely unexpected happened');
    }
  });

  it('handles non-Error throws by converting them to a string error message', () => {
    mockExecFileSync.mockImplementation(() => { throw 'raw string error'; });
    const result = ghJson(['api', '/test']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('raw string error');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// ghExec()
// ─────────────────────────────────────────────────────────────────────

describe('ghExec()', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetClient();
  });

  // ── Success ────────────────────────────────────────────────────────

  it('returns { ok: true, data } with trimmed stdout string on success', () => {
    stubExec('  some output with surrounding whitespace  \n');

    const result = ghExec(['pr', 'view', '--web']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('some output with surrounding whitespace');
    }
  });

  it('returns { ok: true, data: "" } when command produces empty output', () => {
    stubExec('');

    const result = ghExec(['workflow', 'run', 'ci.yml']);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe('');
    }
  });

  it('passes the args array directly to execFileSync', () => {
    stubExec('ok');
    const args = ['label', 'create', 'bug', '--color', 'red'];
    ghExec(args);

    expect(mockExecFileSync).toHaveBeenCalledWith('gh', args, expect.any(Object));
  });

  // ── Failure / error classification ────────────────────────────────

  it('returns NOT_FOUND when execFileSync throws a 404 error', () => {
    failExec('HTTP 404: Not Found');
    const result = ghExec(['issue', 'view', '9999']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('NOT_FOUND');
  });

  it('returns UNAUTHORIZED when execFileSync throws a 401 error', () => {
    failExec('HTTP 401: Unauthorized');
    const result = ghExec(['auth', 'status']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('UNAUTHORIZED');
  });

  it('returns FORBIDDEN when execFileSync throws a 403 error without rate limit', () => {
    failExec('HTTP 403: Forbidden');
    const result = ghExec(['repo', 'delete']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('FORBIDDEN');
  });

  it('returns RATE_LIMITED when execFileSync throws a 403 rate limit error', () => {
    failExec('HTTP 403: rate limit exceeded for user');
    const result = ghExec(['api', '/rate_limit']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('RATE_LIMITED');
  });

  it('returns VALIDATION when execFileSync throws a 422 error', () => {
    failExec('HTTP 422: Unprocessable Entity');
    const result = ghExec(['issue', 'edit', '1', '--milestone', 'nonexistent']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('VALIDATION');
  });

  it('returns UNKNOWN for unclassified errors and preserves the error message', () => {
    failExec('network timeout');
    const result = ghExec(['api', '/repos/owner/repo']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('UNKNOWN');
      expect(result.error).toBe('network timeout');
    }
  });

  it('handles non-Error throws by stringifying them', () => {
    mockExecFileSync.mockImplementation(() => { throw 42; });
    const result = ghExec(['api', '/test']);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('42');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────
// classifyGhError() — indirect tests via ghJson / ghExec
// These are grouped separately to document the classification contract.
// ─────────────────────────────────────────────────────────────────────

describe('classifyGhError() — error classification contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetClient();
  });

  const classify = (message: string): GhResult<unknown> => {
    mockExecFileSync.mockImplementation(() => { throw new Error(message); });
    return ghJson(['any', 'command']);
  };

  describe('NOT_FOUND', () => {
    it('matches the literal string "404"', () => {
      const r = classify('error 404');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('NOT_FOUND');
    });

    it('matches "Not Found" (case-sensitive)', () => {
      const r = classify('Not Found for this resource');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('NOT_FOUND');
    });
  });

  describe('UNAUTHORIZED', () => {
    it('matches the literal string "401"', () => {
      const r = classify('401 bad credentials');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('UNAUTHORIZED');
    });

    it('matches "Unauthorized" (case-sensitive)', () => {
      const r = classify('Unauthorized request');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('UNAUTHORIZED');
    });

    it('matches substring "auth" (e.g. "gh auth login")', () => {
      const r = classify('please run gh auth login first');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('UNAUTHORIZED');
    });
  });

  describe('FORBIDDEN vs RATE_LIMITED (both triggered by 403)', () => {
    it('classifies plain 403 without "rate limit" as FORBIDDEN', () => {
      const r = classify('HTTP 403: Forbidden — insufficient permissions');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('FORBIDDEN');
    });

    it('classifies 403 containing "rate limit" (lowercase) as RATE_LIMITED', () => {
      const r = classify('HTTP 403: api rate limit exceeded');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('RATE_LIMITED');
    });

    it('classifies 403 + "RATE LIMIT" (uppercase) as RATE_LIMITED via toLowerCase()', () => {
      // The source checks msg.toLowerCase().includes('rate limit')
      const r = classify('403 Forbidden: You have exceeded the RATE LIMIT');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('RATE_LIMITED');
    });

    it('matches "Forbidden" string without a status code as FORBIDDEN', () => {
      const r = classify('action is Forbidden for this token scope');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('FORBIDDEN');
    });
  });

  describe('VALIDATION', () => {
    it('matches the literal string "422"', () => {
      const r = classify('422 Unprocessable Entity');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('VALIDATION');
    });

    it('matches "Validation" (case-sensitive)', () => {
      const r = classify('Validation error: title is required');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('VALIDATION');
    });
  });

  describe('UNKNOWN', () => {
    it('is the fallback when nothing matches', () => {
      const r = classify('ECONNRESET: connection reset by peer');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.code).toBe('UNKNOWN');
    });

    it('preserves the original error message verbatim', () => {
      const msg = 'something totally bespoke';
      const r = classify(msg);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toBe(msg);
    });
  });
});
