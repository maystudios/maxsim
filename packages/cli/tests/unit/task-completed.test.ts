// biome-ignore-all lint/style/noNonNullAssertion: test callbacks require non-null assertion
// biome-ignore-all lint/complexity/useLiteralKeys: dynamic key access in tests
/**
 * Unit tests for hooks/maxsim-task-completed.ts.
 *
 * The hook runs verification gates (test, build, lint) via spawnSync and exits 2
 * on failure. Since the internal helpers are not exported, we mock the shared
 * module to capture the readStdinJson callback, and mock node:child_process and
 * node:fs to control gate execution and package.json detection.
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
let stderrSpy: ReturnType<typeof vi.spyOn>;
let _stdoutSpy: ReturnType<typeof vi.spyOn>;

/**
 * Build a mock spawnSync result.
 */
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

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-completed-test-'));
  hookCallback = null;
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
    return undefined as never;
  });
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  _stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
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

async function loadHookWithMocks(opts: {
  packageJson?: Record<string, unknown> | null;
  spawnResults?: Record<string, ReturnType<typeof makeSpawnResult>>;
}) {
  const { packageJson, spawnResults = {} } = opts;

  // Write a package.json to the temp directory if provided
  if (packageJson !== null && packageJson !== undefined) {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify(packageJson),
      'utf8',
    );
  }

  // Mock shared.js to capture the callback
  vi.doMock('../../src/hooks/shared.js', () => ({
    readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
      hookCallback = cb;
    }),
  }));

  // Mock node:child_process to control gate results
  const spawnSyncMock = vi.fn(
    (_command: string, args: string[]) => {
      // Determine which gate by looking at args
      if (args.includes('test')) {
        return spawnResults['test'] ?? makeSpawnResult();
      }
      if (args.includes('run') && args.includes('build')) {
        return spawnResults['build'] ?? makeSpawnResult();
      }
      if (args.includes('run') && args.includes('lint')) {
        return spawnResults['lint'] ?? makeSpawnResult();
      }
      return makeSpawnResult();
    },
  );

  vi.doMock('node:child_process', () => ({
    spawnSync: spawnSyncMock,
  }));

  await import('../../src/hooks/maxsim-task-completed.js');

  return { spawnSyncMock };
}

// ---------------------------------------------------------------------------
// readPackageScripts detection
// ---------------------------------------------------------------------------

describe('package.json detection', () => {
  it('detects test script from package.json', async () => {
    const { spawnSyncMock } = await loadHookWithMocks({
      packageJson: { scripts: { test: 'vitest run' } },
    });

    hookCallback!({ cwd: tmpDir });

    // spawnSync should have been called for 'npm test'
    const testCalls = spawnSyncMock.mock.calls.filter(
      (call: unknown[]) => (call[1] as string[]).includes('test'),
    );
    expect(testCalls.length).toBe(1);
  });

  it('detects build script from package.json', async () => {
    const { spawnSyncMock } = await loadHookWithMocks({
      packageJson: { scripts: { build: 'tsc' } },
    });

    hookCallback!({ cwd: tmpDir });

    const buildCalls = spawnSyncMock.mock.calls.filter(
      (call: unknown[]) => {
        const args = call[1] as string[];
        return args.includes('run') && args.includes('build');
      },
    );
    expect(buildCalls.length).toBe(1);
  });

  it('detects lint script from package.json', async () => {
    const { spawnSyncMock } = await loadHookWithMocks({
      packageJson: { scripts: { lint: 'eslint .' } },
    });

    hookCallback!({ cwd: tmpDir });

    const lintCalls = spawnSyncMock.mock.calls.filter(
      (call: unknown[]) => {
        const args = call[1] as string[];
        return args.includes('run') && args.includes('lint');
      },
    );
    expect(lintCalls.length).toBe(1);
  });

  it('detects all three scripts when present', async () => {
    const { spawnSyncMock } = await loadHookWithMocks({
      packageJson: {
        scripts: {
          test: 'vitest',
          build: 'tsc',
          lint: 'eslint .',
        },
      },
    });

    hookCallback!({ cwd: tmpDir });

    expect(spawnSyncMock).toHaveBeenCalledTimes(3);
  });

  it('skips gates when scripts object is empty', async () => {
    const { spawnSyncMock } = await loadHookWithMocks({
      packageJson: { scripts: {} },
    });

    hookCallback!({ cwd: tmpDir });

    expect(spawnSyncMock).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// Gate pass (exit 0)
// ---------------------------------------------------------------------------

describe('gate pass (exit 0)', () => {
  it('exits 0 when all gates succeed', async () => {
    await loadHookWithMocks({
      packageJson: {
        scripts: { test: 'vitest', build: 'tsc', lint: 'eslint .' },
      },
      spawnResults: {
        test: makeSpawnResult({ status: 0, stdout: 'All tests passed' }),
        build: makeSpawnResult({ status: 0, stdout: 'Build successful' }),
        lint: makeSpawnResult({ status: 0, stdout: 'No linting errors' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(0);
    // stderr should NOT have been called with failure output
    const stderrCalls = stderrSpy.mock.calls.filter(
      (call) => String(call[0]).includes('FAILED'),
    );
    expect(stderrCalls.length).toBe(0);
  });

  it('exits 0 when test passes and no build/lint scripts exist', async () => {
    await loadHookWithMocks({
      packageJson: { scripts: { test: 'vitest' } },
      spawnResults: {
        test: makeSpawnResult({ status: 0, stdout: 'Tests passed' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// Gate failure (exit 2)
// ---------------------------------------------------------------------------

describe('gate failure (exit 2)', () => {
  it('exits 2 when test gate fails', async () => {
    await loadHookWithMocks({
      packageJson: { scripts: { test: 'vitest' } },
      spawnResults: {
        test: makeSpawnResult({ status: 1, stderr: 'Test failed: foo.test.ts' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('writes failure report to stderr when a gate fails', async () => {
    await loadHookWithMocks({
      packageJson: { scripts: { test: 'vitest' } },
      spawnResults: {
        test: makeSpawnResult({ status: 1, stderr: 'FAIL: src/math.test.ts' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('test FAILED');
    expect(stderrOutput).toContain('FAIL: src/math.test.ts');
  });

  it('exits 2 when build gate fails', async () => {
    await loadHookWithMocks({
      packageJson: { scripts: { build: 'tsc' } },
      spawnResults: {
        build: makeSpawnResult({ status: 2, stderr: 'TSC compilation errors' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(2);
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('build FAILED');
  });

  it('exits 2 when lint gate fails', async () => {
    await loadHookWithMocks({
      packageJson: { scripts: { lint: 'eslint .' } },
      spawnResults: {
        lint: makeSpawnResult({ status: 1, stderr: 'Linting errors found' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(2);
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('lint FAILED');
  });

  it('reports all failures when multiple gates fail', async () => {
    await loadHookWithMocks({
      packageJson: {
        scripts: { test: 'vitest', build: 'tsc', lint: 'eslint .' },
      },
      spawnResults: {
        test: makeSpawnResult({ status: 1, stderr: 'Tests broken' }),
        build: makeSpawnResult({ status: 1, stderr: 'Build broken' }),
        lint: makeSpawnResult({ status: 0, stdout: 'Lint OK' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(2);
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('test FAILED');
    expect(stderrOutput).toContain('build FAILED');
    expect(stderrOutput).not.toContain('lint FAILED');
  });

  it('includes the failure output in the report format "=== name FAILED ==="', async () => {
    await loadHookWithMocks({
      packageJson: { scripts: { test: 'vitest' } },
      spawnResults: {
        test: makeSpawnResult({ status: 1, stdout: 'stdout output', stderr: 'stderr output' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('=== test FAILED ===');
    expect(stderrOutput).toContain('stdout output');
    expect(stderrOutput).toContain('stderr output');
  });
});

// ---------------------------------------------------------------------------
// Handling when no package.json exists
// ---------------------------------------------------------------------------

describe('no package.json', () => {
  it('exits 0 when package.json does not exist', async () => {
    await loadHookWithMocks({
      packageJson: null, // do not create package.json
    });

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('does not run any gates when package.json is missing', async () => {
    const { spawnSyncMock } = await loadHookWithMocks({
      packageJson: null,
    });

    hookCallback!({ cwd: tmpDir });

    expect(spawnSyncMock).not.toHaveBeenCalled();
  });

  it('exits 0 when package.json has no scripts key', async () => {
    await loadHookWithMocks({
      packageJson: { name: 'test-project', version: '1.0.0' },
    });

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// Timeout behavior
// ---------------------------------------------------------------------------

describe('timeout behavior', () => {
  it('passes a 120s timeout to spawnSync for each gate', async () => {
    const { spawnSyncMock } = await loadHookWithMocks({
      packageJson: { scripts: { test: 'vitest' } },
    });

    hookCallback!({ cwd: tmpDir });

    expect(spawnSyncMock).toHaveBeenCalled();
    const callArgs = spawnSyncMock.mock.calls[0];
    const options = callArgs[2] as { timeout?: number };
    expect(options.timeout).toBe(120_000);
  });

  it('treats a timed-out gate (non-zero exit) as a failure', async () => {
    await loadHookWithMocks({
      packageJson: { scripts: { test: 'vitest' } },
      spawnResults: {
        test: makeSpawnResult({ status: null as unknown as number, stderr: '' }),
      },
    });

    hookCallback!({ cwd: tmpDir });

    // status null (killed/timeout) => not 0 => failure
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('exits 0 when spawnSync throws an error', async () => {
    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
    }));

    // Mock spawnSync to throw
    vi.doMock('node:child_process', () => ({
      spawnSync: vi.fn(() => {
        throw new Error('process crashed');
      }),
    }));

    // Write a valid package.json
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { test: 'vitest' } }),
      'utf8',
    );

    await import('../../src/hooks/maxsim-task-completed.js');
    hookCallback!({ cwd: tmpDir });

    // The gate should report as failed because runGate catches the throw
    // and returns { passed: false, output: ... }
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('uses process.cwd() when input.cwd is not provided', async () => {
    await loadHookWithMocks({
      packageJson: null, // no package.json at cwd
    });

    // When cwd is not in input, it falls back to process.cwd()
    // Since there's no package.json at process.cwd() necessarily, this just tests no crash
    expect(() => hookCallback!({})).not.toThrow();
  });
});
