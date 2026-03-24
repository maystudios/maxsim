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

  it('appends a session header with the correct date', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain(`## Session ${today()}`);
  });

  it('includes session ID (first 8 chars) in the header', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, 'abc12345xyz', [], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('(abc12345)');
  });

  it('includes stop_reason in square brackets in the header', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], 'user_exit', undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('[user_exit]');
  });

  it('writes "no commits recorded this session" when commits array is empty', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('- no commits recorded this session');
  });

  it('writes each commit on its own line with "- commit:" prefix', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, ['abc1234 fix bug', 'def5678 add feature'], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('- commit: abc1234 fix bug');
    expect(content).toContain('- commit: def5678 add feature');
  });

  it('records the commit count on a summary line', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, ['a', 'b', 'c'], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).toContain('- 3 commit(s) made this session');
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
    expect(content).toContain('(session1)');
    expect(content).toContain('(session2)');
  });

  it('omits stop_reason bracket when stop_reason is undefined', () => {
    const memPath = path.join(tmpDir, 'MEMORY.md');
    appendLearning(memPath, undefined, [], undefined, undefined);
    const content = fs.readFileSync(memPath, 'utf8');
    expect(content).not.toMatch(/\[.*\]/);
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
