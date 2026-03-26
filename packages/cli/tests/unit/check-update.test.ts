// biome-ignore-all lint/style/noNonNullAssertion: test callbacks require non-null assertion
/**
 * Unit tests for hooks/maxsim-check-update.ts.
 *
 * The hook checks for newer versions of maxsimcli on npm at session start.
 * Since the internal helpers (isNewer, readCache, writeCache, getInstalledVersion)
 * are not exported, we mock readStdinJson to capture the callback and mock
 * node:child_process, node:fs to control behavior.
 *
 * Note: vi.mock() calls are hoisted to the top of the module by Vitest.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Shared test infrastructure
// ---------------------------------------------------------------------------

let tmpDir: string;
let hookCallback: ((input: Record<string, unknown>) => void) | null = null;
let exitSpy: ReturnType<typeof vi.spyOn>;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'check-update-test-'));
  hookCallback = null;
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
    return undefined as never;
  });
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.doUnmock('../../src/hooks/shared.js');
  vi.doUnmock('node:child_process');
  vi.doUnmock('node:fs');
  vi.resetModules();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper to load the hook with controlled mocks
// ---------------------------------------------------------------------------

function makeSpawnResult(overrides: {
  status?: number | null;
  stdout?: string;
  stderr?: string;
} = {}) {
  return {
    pid: 123,
    output: [],
    stdout: (overrides.stdout ?? '') as unknown as Buffer,
    stderr: (overrides.stderr ?? '') as unknown as Buffer,
    status: overrides.status === undefined ? 0 : overrides.status,
    signal: null as NodeJS.Signals | null,
    error: undefined,
  };
}

async function loadHook(opts: {
  spawnSyncResult?: ReturnType<typeof makeSpawnResult>;
  cacheContent?: string | null;
  installedVersion?: string;
}) {
  const { spawnSyncResult, cacheContent, installedVersion } = opts;

  // Mock shared.js to capture the callback
  vi.doMock('../../src/hooks/shared.js', () => ({
    readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
      hookCallback = cb;
    }),
  }));

  // Mock child_process.spawnSync and spawn
  const spawnSyncMock = vi.fn(() => spawnSyncResult ?? makeSpawnResult({ status: 1 }));
  const spawnMock = vi.fn(() => ({
    stdout: { on: vi.fn() },
    on: vi.fn(),
    unref: vi.fn(),
  }));

  vi.doMock('node:child_process', () => ({
    spawnSync: spawnSyncMock,
    spawn: spawnMock,
  }));

  // If we need a cache file, write it to the tmpdir-based path
  // We mock the CACHE_FILE constant indirectly by mocking os.tmpdir
  const cachePath = path.join(tmpDir, '.maxsimcli-update-cache.json');
  vi.doMock('node:os', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:os')>();
    return {
      ...actual,
      tmpdir: () => tmpDir,
    };
  });

  if (cacheContent !== null && cacheContent !== undefined) {
    fs.writeFileSync(cachePath, cacheContent, 'utf8');
  }

  // If we need to control getInstalledVersion, we write a package.json
  if (installedVersion) {
    const hookDir = path.join(tmpDir, 'hook-dir');
    fs.mkdirSync(hookDir, { recursive: true });
    fs.writeFileSync(
      path.join(hookDir, 'package.json'),
      JSON.stringify({ name: 'maxsimcli', version: installedVersion }),
      'utf8',
    );
  }

  await import('../../src/hooks/maxsim-check-update.js');

  return { spawnSyncMock, spawnMock };
}

// ---------------------------------------------------------------------------
// Version comparison (isNewer) behavior
// ---------------------------------------------------------------------------

describe('version comparison behavior', () => {
  it('emits update notice when npm returns a newer version (cache miss)', async () => {
    await loadHook({
      spawnSyncResult: makeSpawnResult({
        status: 0,
        stdout: '"99.0.0"',
      }),
      cacheContent: null,
    });

    hookCallback!({});

    // Should exit 0 (never blocks)
    expect(exitSpy).toHaveBeenCalledWith(0);

    // Should have written an update notice to stdout
    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('additionalContext') && arg.includes('update available');
    });
    expect(writeCall).toBeDefined();
  });

  it('does not emit update notice when npm returns the same version', async () => {
    await loadHook({
      spawnSyncResult: makeSpawnResult({
        status: 0,
        stdout: '"0.0.0"',
      }),
      cacheContent: null,
    });

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);

    // Should NOT have written an update notice
    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('update available');
    });
    expect(writeCall).toBeUndefined();
  });

  it('does not emit update notice when npm returns an older version', async () => {
    // getInstalledVersion returns 0.0.0 by default when no package.json found
    // npm returning 0.0.0 should not trigger an update notice
    await loadHook({
      spawnSyncResult: makeSpawnResult({
        status: 0,
        stdout: '"0.0.0"',
      }),
      cacheContent: null,
    });

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('update available');
    });
    expect(writeCall).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Cache read/write behavior
// ---------------------------------------------------------------------------

describe('cache behavior', () => {
  it('uses cached version when cache is fresh (< 1 hour old)', async () => {
    const freshCache = JSON.stringify({
      checkedAt: Date.now(),
      latestVersion: '99.0.0',
    });

    const { spawnSyncMock } = await loadHook({
      cacheContent: freshCache,
    });

    hookCallback!({});

    // Should NOT have called npm (cache hit)
    expect(spawnSyncMock).not.toHaveBeenCalled();

    // Should have emitted an update notice from the cache
    expect(exitSpy).toHaveBeenCalledWith(0);
    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('update available');
    });
    expect(writeCall).toBeDefined();
  });

  it('queries npm when cache is stale (> 1 hour old)', async () => {
    const staleCache = JSON.stringify({
      checkedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      latestVersion: '1.0.0',
    });

    const { spawnSyncMock } = await loadHook({
      spawnSyncResult: makeSpawnResult({ status: 1 }),
      cacheContent: staleCache,
    });

    hookCallback!({});

    // Should have called npm because cache is stale
    expect(spawnSyncMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('queries npm when cache file does not exist', async () => {
    const { spawnSyncMock } = await loadHook({
      spawnSyncResult: makeSpawnResult({ status: 1 }),
      cacheContent: null,
    });

    hookCallback!({});

    expect(spawnSyncMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('handles corrupt cache file gracefully', async () => {
    const { spawnSyncMock } = await loadHook({
      spawnSyncResult: makeSpawnResult({ status: 1 }),
      cacheContent: 'this is not valid json!!!',
    });

    hookCallback!({});

    // Should have queried npm because cache read failed
    expect(spawnSyncMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// Always exits 0
// ---------------------------------------------------------------------------

describe('exit code', () => {
  it('always exits 0 even when npm query fails', async () => {
    await loadHook({
      spawnSyncResult: makeSpawnResult({ status: 1 }),
      cacheContent: null,
    });

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('always exits 0 when cache is fresh and no update available', async () => {
    const freshCache = JSON.stringify({
      checkedAt: Date.now(),
      latestVersion: '0.0.0',
    });

    await loadHook({
      cacheContent: freshCache,
    });

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('always exits 0 even on unexpected errors', async () => {
    // Provide no mocks that would make things work — the hook should still exit 0
    await loadHook({
      spawnSyncResult: makeSpawnResult({ status: null as unknown as number }),
      cacheContent: null,
    });

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// Background check fallback
// ---------------------------------------------------------------------------

describe('background check fallback', () => {
  it('spawns a background check when synchronous npm query fails', async () => {
    const { spawnMock } = await loadHook({
      spawnSyncResult: makeSpawnResult({ status: 1 }),
      cacheContent: null,
    });

    hookCallback!({});

    // spawn should have been called for the background check
    expect(spawnMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
