// biome-ignore-all lint/style/noNonNullAssertion: test callbacks require non-null assertion
/**
 * Unit tests for hooks/maxsim-teammate-idle.ts.
 *
 * The hook checks for pending tasks in ~/.claude/tasks/{team_name}/ and
 * exits 2 with a redirect message if any exist, otherwise exits 0.
 *
 * Since the internal helpers (hasPendingTasks) are not exported, we mock
 * readStdinJson to capture the callback, and use a real temp directory to
 * exercise the hook's filesystem logic end-to-end.
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

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teammate-idle-test-'));
  hookCallback = null;
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
    return undefined as never;
  });
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.doUnmock('../../src/hooks/shared.js');
  vi.doUnmock('node:os');
  vi.resetModules();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper: load the hook with controlled mocks
// ---------------------------------------------------------------------------

async function loadHook(homeDir: string) {
  vi.doMock('../../src/hooks/shared.js', () => ({
    readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
      hookCallback = cb;
    }),
  }));

  // Mock os.homedir to return our temp directory
  vi.doMock('node:os', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:os')>();
    return {
      ...actual,
      homedir: vi.fn(() => homeDir),
    };
  });

  await import('../../src/hooks/maxsim-teammate-idle.js');
}

// ---------------------------------------------------------------------------
// Detection of pending tasks
// ---------------------------------------------------------------------------

describe('pending task detection', () => {
  it('detects pending tasks when files exist in the tasks directory', async () => {
    const teamName = 'my-team';
    const tasksDir = path.join(tmpDir, '.claude', 'tasks', teamName);
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tasksDir, 'task-001.md'), 'Do something', 'utf8');

    await loadHook(tmpDir);
    hookCallback!({ team_name: teamName });

    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('detects multiple pending tasks', async () => {
    const teamName = 'dev-team';
    const tasksDir = path.join(tmpDir, '.claude', 'tasks', teamName);
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tasksDir, 'task-001.md'), 'First task', 'utf8');
    fs.writeFileSync(path.join(tasksDir, 'task-002.md'), 'Second task', 'utf8');
    fs.writeFileSync(path.join(tasksDir, 'task-003.md'), 'Third task', 'utf8');

    await loadHook(tmpDir);
    hookCallback!({ team_name: teamName });

    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('detects tasks regardless of file extension', async () => {
    const teamName = 'mixed-team';
    const tasksDir = path.join(tmpDir, '.claude', 'tasks', teamName);
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tasksDir, 'task.json'), '{}', 'utf8');

    await loadHook(tmpDir);
    hookCallback!({ team_name: teamName });

    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

// ---------------------------------------------------------------------------
// Exit 2 with "Pick up the next available task" message
// ---------------------------------------------------------------------------

describe('exit 2 with redirect message', () => {
  it('writes "Pick up the next available task." to stderr when tasks exist', async () => {
    const teamName = 'test-team';
    const tasksDir = path.join(tmpDir, '.claude', 'tasks', teamName);
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tasksDir, 'pending.md'), 'content', 'utf8');

    await loadHook(tmpDir);
    hookCallback!({ team_name: teamName });

    expect(exitSpy).toHaveBeenCalledWith(2);
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).toContain('Pick up the next available task.');
  });

  it('includes a trailing newline in the stderr message', async () => {
    const teamName = 'test-team';
    const tasksDir = path.join(tmpDir, '.claude', 'tasks', teamName);
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tasksDir, 'task.md'), 'do stuff', 'utf8');

    await loadHook(tmpDir);
    hookCallback!({ team_name: teamName });

    // The hook writes 'Pick up the next available task.\n'
    expect(stderrSpy).toHaveBeenCalledWith('Pick up the next available task.\n');
  });
});

// ---------------------------------------------------------------------------
// Exit 0 when no pending tasks
// ---------------------------------------------------------------------------

describe('exit 0 (no pending tasks)', () => {
  it('exits 0 when the tasks directory is empty', async () => {
    const teamName = 'empty-team';
    const tasksDir = path.join(tmpDir, '.claude', 'tasks', teamName);
    fs.mkdirSync(tasksDir, { recursive: true });
    // Directory exists but has no files

    await loadHook(tmpDir);
    hookCallback!({ team_name: teamName });

    expect(exitSpy).toHaveBeenCalledWith(0);
    // stderr should not have been called with the redirect message
    const stderrOutput = stderrSpy.mock.calls.map((c) => String(c[0])).join('');
    expect(stderrOutput).not.toContain('Pick up the next available task');
  });

  it('exits 0 when team_name is not provided', async () => {
    await loadHook(tmpDir);
    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 when team_name is undefined', async () => {
    await loadHook(tmpDir);
    hookCallback!({ team_name: undefined });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// Handling when tasks directory does not exist
// ---------------------------------------------------------------------------

describe('tasks directory missing', () => {
  it('exits 0 when the tasks directory does not exist', async () => {
    await loadHook(tmpDir);
    // team_name is set but no tasks directory was created
    hookCallback!({ team_name: 'nonexistent-team' });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('does not throw when the tasks directory does not exist', async () => {
    await loadHook(tmpDir);
    expect(() => hookCallback!({ team_name: 'no-dir' })).not.toThrow();
  });

  it('exits 0 when the .claude directory itself does not exist', async () => {
    // Use a completely empty tmpDir (no .claude directory)
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'idle-empty-'));
    try {
      await loadHook(emptyDir);
      hookCallback!({ team_name: 'some-team' });
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('error handling', () => {
  it('never crashes — exits 0 on unexpected errors', async () => {
    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
    }));

    // Mock os.homedir to throw
    vi.doMock('node:os', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:os')>();
      return {
        ...actual,
        homedir: vi.fn(() => {
          throw new Error('homedir failed');
        }),
      };
    });

    await import('../../src/hooks/maxsim-teammate-idle.js');
    hookCallback!({ team_name: 'crash-team' });

    // The catch-all should prevent the crash and exit 0
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('constructs the tasks path as ~/.claude/tasks/{team_name}', async () => {
    const teamName = 'path-test-team';
    const tasksDir = path.join(tmpDir, '.claude', 'tasks', teamName);
    fs.mkdirSync(tasksDir, { recursive: true });
    fs.writeFileSync(path.join(tasksDir, 'task.md'), 'content', 'utf8');

    await loadHook(tmpDir);
    hookCallback!({ team_name: teamName });

    // Verify it found the task (exit 2 means it checked the right path)
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
