/**
 * Unit tests for hooks/maxsim-capture-learnings.ts utilities.
 *
 * Tests cover:
 *  - appendLearning: structured entry format, stop_reason, pattern summary
 *  - pruneMemory: trimming to MEMORY_MAX_LINES
 *  - sessionCommits: per-session range query with fallback
 *
 * Note: vi.mock() calls are hoisted to the top of the module by Vitest.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Hoist mock for node:child_process so it is in place when the hook is imported.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawnSync: vi.fn(actual.spawnSync),
  };
});

import * as childProcess from 'node:child_process';
import {
  appendLearning,
  pruneMemory,
  sessionCommits,
  extractPattern,
  MEMORY_MAX_LINES,
  today,
} from '../../src/hooks/maxsim-capture-learnings.js';

const spawnSyncMock = vi.mocked(childProcess.spawnSync);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUCCESS_RESULT: ReturnType<typeof childProcess.spawnSync> = {
  pid: 0,
  output: [],
  stdout: Buffer.from(''),
  stderr: Buffer.from(''),
  status: 0,
  signal: null,
  error: undefined,
};

const FAIL_RESULT: ReturnType<typeof childProcess.spawnSync> = {
  ...SUCCESS_RESULT,
  status: 1,
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-learnings-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// today()
// ---------------------------------------------------------------------------

describe('today', () => {
  it('returns a YYYY-MM-DD formatted string', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// appendLearning
// ---------------------------------------------------------------------------

describe('appendLearning', () => {
  it('creates the memory directory if it does not exist', () => {
    const memPath = path.join(tmpDir, 'sub', 'dir', 'MEMORY.md');
    appendLearning(memPath, undefined, [], undefined, undefined);
    expect(fs.existsSync(path.dirname(memPath))).toBe(true);
  });

  it('appends a session header with the correct date in pipe-delimited format', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, 'sess1234abcd', [], 'user_exit', undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain(`### ${today()} | sess1234 | user_exit | 0 commits`);
  });

  it('includes session ID (first 8 chars) in the header', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, 'abc12345xyz', [], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('| abc12345 |');
  });

  it('includes stop_reason in the pipe-delimited header', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], 'user_exit', undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('| user_exit |');
  });

  it('writes "no commits recorded this session" when commits array is empty', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('- no commits recorded this session');
  });

  it('writes all commits on a single "- commits:" line', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, ['abc1234 fix bug', 'def5678 add feature'], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('- commits: abc1234 fix bug, def5678 add feature');
  });

  it('records the commit count in the header', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, ['a', 'b', 'c'], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('| 3 commits');
  });

  it('includes pattern summary when provided', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], undefined, 'Refactored the auth module');
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('- pattern: Refactored the auth module');
  });

  it('does not write a pattern line when patternSummary is undefined', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).not.toContain('- pattern:');
  });

  it('appends multiple entries without overwriting existing content', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    fs.writeFileSync(memPath, '# Existing content\n', 'utf8');
    appendLearning(memPath, 'session1', ['commit-a'], 'user_exit', undefined);
    appendLearning(memPath, 'session2', ['commit-b'], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('# Existing content');
    expect(content).toContain('| session1 |');
    expect(content).toContain('| session2 |');
  });

  it('uses "unknown" for stop_reason when undefined', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('| unknown |');
  });
});

// ---------------------------------------------------------------------------
// pruneMemory
// ---------------------------------------------------------------------------

describe('pruneMemory', () => {
  it(`does not modify a file with ${MEMORY_MAX_LINES} lines or fewer`, () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    const lines = Array.from({ length: MEMORY_MAX_LINES }, (_, i) => `line ${i + 1}`);
    const original = lines.join('\n');
    fs.writeFileSync(memPath, original, 'utf8');
    pruneMemory(memPath);
    expect(fs.readFileSync(memPath, 'utf8')).toBe(original);
  });

  it('trims from the top when the file exceeds MEMORY_MAX_LINES', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    // Write 200 lines (20 over limit of 180)
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`);
    fs.writeFileSync(memPath, lines.join('\n'), 'utf8');
    pruneMemory(memPath);
    const result = fs.readFileSync(memPath, 'utf8').split('\n');
    expect(result.length).toBe(MEMORY_MAX_LINES);
    // Should keep LAST 180 lines (line 21 to line 200)
    expect(result[0]).toBe('line 21');
    expect(result[result.length - 1]).toBe('line 200');
  });

  it('does not throw when the file does not exist', () => {
    const memPath = path.join(tmpDir, 'nonexistent', 'MEMORY.md');
    expect(() => pruneMemory(memPath)).not.toThrow();
  });

  it('keeps exactly MEMORY_MAX_LINES lines when the file is exactly one over', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    const lines = Array.from({ length: MEMORY_MAX_LINES + 1 }, (_, i) => `entry-${i}`);
    fs.writeFileSync(memPath, lines.join('\n'), 'utf8');
    pruneMemory(memPath);
    const result = fs.readFileSync(memPath, 'utf8').split('\n');
    expect(result.length).toBe(MEMORY_MAX_LINES);
    // First line (oldest) must have been dropped
    expect(result[0]).toBe('entry-1');
  });
});

// ---------------------------------------------------------------------------
// sessionCommits
// ---------------------------------------------------------------------------

describe('sessionCommits', () => {
  it('returns commits from git log range when available', () => {
    spawnSyncMock.mockReturnValueOnce({
      ...SUCCESS_RESULT,
      stdout: 'abc1234 fix bug\ndef5678 add feature\n' as unknown as Buffer,
    });

    const result = sessionCommits('/some/project', 'startsha');
    expect(result).toEqual(['abc1234 fix bug', 'def5678 add feature']);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'git',
      ['log', '--oneline', 'startsha..HEAD'],
      expect.objectContaining({ cwd: '/some/project' }),
    );
  });

  it('falls back to recentCommits when git log range exits non-zero', () => {
    // First call: the sessionCommits range query — fails
    spawnSyncMock.mockReturnValueOnce({ ...FAIL_RESULT });
    // Second call: the recentCommits fallback — succeeds
    spawnSyncMock.mockReturnValueOnce({
      ...SUCCESS_RESULT,
      stdout: 'fallback1\nfallback2\n' as unknown as Buffer,
    });

    const result = sessionCommits('/some/project', 'startsha');
    expect(result).toEqual(['fallback1', 'fallback2']);
  });

  it('falls back to recentCommits when git log range returns empty output', () => {
    // First call: range query returns empty string
    spawnSyncMock.mockReturnValueOnce({ ...SUCCESS_RESULT, stdout: '' as unknown as Buffer });
    // Second call: fallback
    spawnSyncMock.mockReturnValueOnce({
      ...SUCCESS_RESULT,
      stdout: 'recent1\n' as unknown as Buffer,
    });

    const result = sessionCommits('/some/project', 'startsha');
    expect(result).toEqual(['recent1']);
  });

  it('falls back gracefully when spawnSync throws', () => {
    // First call: throws
    spawnSyncMock.mockImplementationOnce(() => { throw new Error('git not found'); });
    // Second call: fallback succeeds
    spawnSyncMock.mockReturnValueOnce({
      ...SUCCESS_RESULT,
      stdout: 'fallback-commit\n' as unknown as Buffer,
    });

    const result = sessionCommits('/some/project', 'startsha');
    expect(result).toEqual(['fallback-commit']);
  });
});

// ---------------------------------------------------------------------------
// extractPattern
// ---------------------------------------------------------------------------

describe('extractPattern', () => {
  it('returns undefined for empty/whitespace input', () => {
    expect(extractPattern('')).toBeUndefined();
    expect(extractPattern('   ')).toBeUndefined();
    expect(extractPattern('\n\n')).toBeUndefined();
  });

  it('finds a line starting with "Pattern:" prefix', () => {
    const msg = 'Some preamble.\nPattern: always run tests before committing.\nMore text.';
    expect(extractPattern(msg)).toBe('Pattern: always run tests before committing.');
  });

  it('finds a line starting with "Learning:" prefix', () => {
    const msg = 'Debugging session complete.\nLearning: the config file must be UTF-8.';
    expect(extractPattern(msg)).toBe('Learning: the config file must be UTF-8.');
  });

  it('finds a bullet-prefixed learning line', () => {
    const msg = 'Summary:\n- Found that the API rate limits at 100 req/s.';
    expect(extractPattern(msg)).toBe('- Found that the API rate limits at 100 req/s.');
  });

  it('extracts bullet points when there are 1-5 of them', () => {
    const msg = 'Results:\n- Added auth module\n- Fixed login bug\n- Updated tests';
    expect(extractPattern(msg)).toBe('- Added auth module; - Fixed login bug; - Updated tests');
  });

  it('falls back to the last sentence when no prefix or bullets match', () => {
    const msg = 'I refactored several files. The build is now green. All tests pass.';
    expect(extractPattern(msg)).toBe('All tests pass.');
  });

  it('caps result at 200 characters', () => {
    const longLine = `Pattern: ${'x'.repeat(300)}`;
    const result = extractPattern(longLine);
    expect(result).toBeDefined();
    expect(result?.length).toBe(200);
  });

  it('uses last 200 chars as final fallback when no sentences found', () => {
    const msg = `no punctuation here just a long stream of words ${'word '.repeat(50)}`;
    const result = extractPattern(msg);
    expect(result).toBeDefined();
    expect(result?.length).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// Edge cases: stop_hook_active guard, isMaxsimProject false, error catch
// ---------------------------------------------------------------------------

describe('capture-learnings hook edge cases', () => {
  let hookCallback: ((input: Record<string, unknown>) => void) | null = null;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    hookCallback = null;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
      return undefined as never;
    });
    // Reset module cache so vi.doMock takes effect on next import
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.doUnmock('node:child_process');
    vi.resetModules();
  });

  it('calls process.exit(0) when stop_hook_active is true (guard fires early)', async () => {
    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => []),
    }));

    // Also mock child_process since the module imports spawnSync
    vi.doMock('node:child_process', () => ({
      spawnSync: vi.fn(() => ({
        pid: 0, output: [], stdout: '', stderr: '', status: 0, signal: null, error: undefined,
      })),
    }));

    await import('../../src/hooks/maxsim-capture-learnings.js');
    hookCallback!({ stop_hook_active: true, cwd: tmpDir });

    // The guard calls process.exit(0) before any processing.
    // Since our mock doesn't actually halt, exit(0) is called first.
    expect(exitSpy).toHaveBeenCalledWith(0);
    // First call should be the early exit from stop_hook_active guard
    expect(exitSpy.mock.calls[0][0]).toBe(0);
  });

  it('calls process.exit(0) when isMaxsimProject returns false (early exit)', async () => {
    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => false),
      recentCommits: vi.fn(() => []),
    }));

    vi.doMock('node:child_process', () => ({
      spawnSync: vi.fn(() => ({
        pid: 0, output: [], stdout: '', stderr: '', status: 0, signal: null, error: undefined,
      })),
    }));

    await import('../../src/hooks/maxsim-capture-learnings.js');
    hookCallback!({ cwd: tmpDir });

    // isMaxsimProject returns false => process.exit(0) called
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(exitSpy.mock.calls[0][0]).toBe(0);
  });

  it('exits 0 and does not crash when an error occurs during processing', async () => {
    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => {
        throw new Error('unexpected error');
      }),
      recentCommits: vi.fn(() => []),
    }));

    vi.doMock('node:child_process', () => ({
      spawnSync: vi.fn(() => ({
        pid: 0, output: [], stdout: '', stderr: '', status: 0, signal: null, error: undefined,
      })),
    }));

    await import('../../src/hooks/maxsim-capture-learnings.js');
    expect(() => hookCallback!({ cwd: tmpDir })).not.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
