// biome-ignore-all lint/style/noNonNullAssertion: test callbacks require non-null assertion
/**
 * Unit tests for hooks/maxsim-session-start.ts.
 *
 * Since the hook's internal helpers (readFirstLines, readLastLines) are not
 * exported, we test the hook by mocking its dependencies (fs, shared utilities,
 * process.exit, process.stdout.write) and then dynamically importing the module
 * so the top-level readStdinJson callback is captured and invocable.
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

/**
 * readFirstLines and readLastLines are private in the hook module.
 * We re-implement them here to test their exact logic in isolation, then
 * also verify the overall hook behaviour via integration-style tests that
 * exercise the full module through a temp directory on disk.
 */

// Mirror of the hook's readFirstLines
function readFirstLines(filePath: string, maxLines: number): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(0, maxLines);
    return lines.join('\n').trim();
  } catch {
    return '';
  }
}

// Mirror of the hook's readLastLines
function readLastLines(filePath: string, maxLines: number): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-maxLines).join('\n').trim();
  } catch {
    return '';
  }
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// readFirstLines (logic mirror tests)
// ---------------------------------------------------------------------------

describe('readFirstLines', () => {
  it('returns the first N lines of a file', () => {
    const filePath = path.join(tmpDir, 'test.md');
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    const result = readFirstLines(filePath, 5);
    expect(result).toBe('line 1\nline 2\nline 3\nline 4\nline 5');
  });

  it('returns all lines when file has fewer than maxLines', () => {
    const filePath = path.join(tmpDir, 'short.md');
    fs.writeFileSync(filePath, 'only one line', 'utf8');

    const result = readFirstLines(filePath, 200);
    expect(result).toBe('only one line');
  });

  it('returns empty string when file does not exist', () => {
    const result = readFirstLines(path.join(tmpDir, 'nonexistent.md'), 100);
    expect(result).toBe('');
  });

  it('trims trailing whitespace', () => {
    const filePath = path.join(tmpDir, 'whitespace.md');
    fs.writeFileSync(filePath, 'line 1\nline 2\n\n\n', 'utf8');

    const result = readFirstLines(filePath, 10);
    expect(result).toBe('line 1\nline 2');
  });

  it('handles empty file', () => {
    const filePath = path.join(tmpDir, 'empty.md');
    fs.writeFileSync(filePath, '', 'utf8');

    const result = readFirstLines(filePath, 200);
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// readLastLines (logic mirror tests)
// ---------------------------------------------------------------------------

describe('readLastLines', () => {
  it('returns the last N non-empty lines of a file', () => {
    const filePath = path.join(tmpDir, 'test.tsv');
    const lines = Array.from({ length: 20 }, (_, i) => `row ${i + 1}`);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

    const result = readLastLines(filePath, 5);
    expect(result).toBe('row 16\nrow 17\nrow 18\nrow 19\nrow 20');
  });

  it('filters out empty lines before slicing', () => {
    const filePath = path.join(tmpDir, 'gaps.tsv');
    fs.writeFileSync(filePath, 'a\n\nb\n\nc\n\nd\n\ne', 'utf8');

    const result = readLastLines(filePath, 3);
    expect(result).toBe('c\nd\ne');
  });

  it('returns all non-empty lines when fewer than maxLines', () => {
    const filePath = path.join(tmpDir, 'small.tsv');
    fs.writeFileSync(filePath, 'one\ntwo', 'utf8');

    const result = readLastLines(filePath, 10);
    expect(result).toBe('one\ntwo');
  });

  it('returns empty string when file does not exist', () => {
    const result = readLastLines(path.join(tmpDir, 'nonexistent.tsv'), 10);
    expect(result).toBe('');
  });

  it('returns empty string for empty file', () => {
    const filePath = path.join(tmpDir, 'empty.tsv');
    fs.writeFileSync(filePath, '', 'utf8');

    const result = readLastLines(filePath, 10);
    expect(result).toBe('');
  });

  it('returns empty string for file with only empty lines', () => {
    const filePath = path.join(tmpDir, 'blanks.tsv');
    fs.writeFileSync(filePath, '\n\n\n\n', 'utf8');

    const result = readLastLines(filePath, 10);
    expect(result).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Hook context injection output format (integration-style)
// ---------------------------------------------------------------------------

describe('session-start hook (integration)', () => {
  /**
   * Run the hook module in a controlled way by mocking readStdinJson to
   * capture the callback, then invoking it with test input. We also mock
   * process.exit, process.stdout.write, isMaxsimProject, and recentCommits.
   */
  let hookCallback: ((input: Record<string, unknown>) => void) | null = null;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  // We need to mock the shared module and dynamically import the hook.
  // Since vi.mock is hoisted, we set it up at the top of the describe block
  // using beforeEach + vi.doMock (not hoisted) to reset between tests.

  beforeEach(async () => {
    hookCallback = null;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
      return undefined as never;
    });
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    // Use vi.doMock (non-hoisted) so we can set fresh mocks per test.
    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => []),
    }));

    // Dynamically import the hook so the module-level code runs with mocks.
    await import('../../src/hooks/maxsim-session-start.js');
  });

  afterEach(() => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
  });

  it('captures the readStdinJson callback', () => {
    expect(hookCallback).toBeTypeOf('function');
  });

  it('exits 0 when project is not a maxsim project', async () => {
    // Re-mock with isMaxsimProject returning false
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => false),
      recentCommits: vi.fn(() => []),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    expect(hookCallback).toBeTypeOf('function');

    hookCallback!({ cwd: tmpDir });
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('outputs JSON with hookSpecificOutput envelope when git history exists', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => ['abc1234 fix bug', 'def5678 add feature']),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    // Find the stdout.write call with additionalContext
    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });

    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Recent Git History');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('abc1234 fix bug');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('def5678 add feature');
  });

  it('includes MEMORY.md content when the file exists', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    // Create the MEMORY.md file in the expected location
    const memoryDir = path.join(tmpDir, '.claude', 'agent-memory', 'maxsim-learner');
    fs.mkdirSync(memoryDir, { recursive: true });
    fs.writeFileSync(
      path.join(memoryDir, 'MEMORY.md'),
      '# Learned Patterns\n- Always run tests\n- Check lint before commit',
      'utf8',
    );

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => []),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });

    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Learned Patterns (MEMORY.md)');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Always run tests');
  });

  it('includes TSV tail content when autoresearch-results.tsv exists', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    // Create the TSV file
    const tsvDir = path.join(tmpDir, '.claude', 'agent-memory', 'maxsim-learner');
    fs.mkdirSync(tsvDir, { recursive: true });
    const tsvLines = Array.from({ length: 20 }, (_, i) => `metric_${i}\t${i * 10}`);
    fs.writeFileSync(
      path.join(tsvDir, 'autoresearch-results.tsv'),
      tsvLines.join('\n'),
      'utf8',
    );

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => []),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });

    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Metric Trends (autoresearch-results.tsv)');
    // Should contain the last 10 lines (metric_10 through metric_19)
    expect(parsed.hookSpecificOutput.additionalContext).toContain('metric_19');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('metric_10');
  });

  it('outputs nothing and exits 0 when no sections have content', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    // Create a fully populated settings.json so the missing-hooks detector
    // does not fire and produce output on its own.
    const settingsDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(settingsDir, { recursive: true });
    const fullSettings = {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: 'node maxsim-check-update.cjs' }] },
          { hooks: [{ type: 'command', command: 'node maxsim-session-start.cjs' }] },
        ],
        Notification: [
          { hooks: [{ type: 'command', command: 'node maxsim-notification-sound.cjs' }] },
        ],
        Stop: [
          { hooks: [{ type: 'command', command: 'node maxsim-stop-sound.cjs' }] },
          { hooks: [{ type: 'command', command: 'node maxsim-capture-learnings.cjs' }] },
        ],
        TeammateIdle: [
          { hooks: [{ type: 'command', command: 'node maxsim-teammate-idle.cjs' }] },
        ],
        TaskCompleted: [
          { hooks: [{ type: 'command', command: 'node maxsim-task-completed.cjs' }] },
        ],
      },
    };
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(fullSettings, null, 2),
    );

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => []),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    // No hookSpecificOutput should have been written
    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });
    expect(writeCall).toBeUndefined();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('gracefully handles when MEMORY.md does not exist', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => ['abc commit']),
    }));

    await import('../../src/hooks/maxsim-session-start.js');

    // Should not throw, even though MEMORY.md doesn't exist
    expect(() => hookCallback!({ cwd: tmpDir })).not.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(0);

    // Should still output git history
    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });
    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Recent Git History');
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain('MEMORY.md');
  });

  it('gracefully handles when TSV file does not exist', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => ['abc commit']),
    }));

    await import('../../src/hooks/maxsim-session-start.js');

    expect(() => hookCallback!({ cwd: tmpDir })).not.toThrow();

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });
    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain('autoresearch-results.tsv');
  });

  it('uses process.cwd() when input.cwd is not provided', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    const isMaxsimProjectMock = vi.fn(() => false);
    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: isMaxsimProjectMock,
      recentCommits: vi.fn(() => []),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({});

    // isMaxsimProject should have been called with process.cwd() as fallback
    expect(isMaxsimProjectMock).toHaveBeenCalledWith(process.cwd());
  });

  it('combines all sections with double newlines', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    // Create both MEMORY.md and TSV
    const dataDir = path.join(tmpDir, '.claude', 'agent-memory', 'maxsim-learner');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'MEMORY.md'), '# Memory content', 'utf8');
    fs.writeFileSync(path.join(dataDir, 'autoresearch-results.tsv'), 'metric\t100', 'utf8');

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => ['abc1234 some commit']),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });

    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());

    // All three sections present, separated by double newlines
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Recent Git History');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Learned Patterns (MEMORY.md)');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Metric Trends (autoresearch-results.tsv)');

    // Verify sections are joined by double newlines
    const sections = parsed.hookSpecificOutput.additionalContext.split('\n\n');
    expect(sections.length).toBeGreaterThanOrEqual(3);
  });

  it('warns about missing hooks when settings.json has no hooks section', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    // Create a settings.json with no hooks section
    const settingsDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify({ env: {} }, null, 2),
    );

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => []),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });

    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Warning: Missing MaxsimCLI Hooks');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('npx maxsimcli');
  });

  it('warns about missing hooks when settings.json does not exist', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => []),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });

    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Warning: Missing MaxsimCLI Hooks');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('settings.json missing');
  });

  it('does not warn when all hooks are registered', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    // Create settings.json with all hooks registered
    const settingsDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(settingsDir, { recursive: true });
    const fullSettings = {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: 'node maxsim-check-update.cjs' }] },
          { hooks: [{ type: 'command', command: 'node maxsim-session-start.cjs' }] },
        ],
        Notification: [
          { hooks: [{ type: 'command', command: 'node maxsim-notification-sound.cjs' }] },
        ],
        Stop: [
          { hooks: [{ type: 'command', command: 'node maxsim-stop-sound.cjs' }] },
          { hooks: [{ type: 'command', command: 'node maxsim-capture-learnings.cjs' }] },
        ],
        TeammateIdle: [
          { hooks: [{ type: 'command', command: 'node maxsim-teammate-idle.cjs' }] },
        ],
        TaskCompleted: [
          { hooks: [{ type: 'command', command: 'node maxsim-task-completed.cjs' }] },
        ],
      },
    };
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(fullSettings, null, 2),
    );

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => ['abc commit']),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });

    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    // Should have git history but NOT missing hooks warning
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Recent Git History');
    expect(parsed.hookSpecificOutput.additionalContext).not.toContain('## Warning: Missing MaxsimCLI Hooks');
  });

  it('warns about partial hooks when only some hooks are registered', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    // Create settings.json with only partial hooks
    const settingsDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(settingsDir, { recursive: true });
    const partialSettings = {
      hooks: {
        SessionStart: [
          { hooks: [{ type: 'command', command: 'node maxsim-session-start.cjs' }] },
        ],
        // Missing: Notification, Stop, TeammateIdle, TaskCompleted
      },
    };
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      JSON.stringify(partialSettings, null, 2),
    );

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => []),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    hookCallback!({ cwd: tmpDir });

    const writeCall = stdoutSpy.mock.calls.find((call) => {
      const arg = String(call[0]);
      return arg.includes('hookSpecificOutput');
    });

    expect(writeCall).toBeDefined();
    const parsed = JSON.parse(String(writeCall![0]).trim());
    expect(parsed.hookSpecificOutput.additionalContext).toContain('## Warning: Missing MaxsimCLI Hooks');
    // Should list specific missing hooks
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Notification');
    expect(parsed.hookSpecificOutput.additionalContext).toContain('Stop');
  });

  it('handles malformed settings.json gracefully (no crash)', async () => {
    vi.doUnmock('../../src/hooks/shared.js');
    vi.resetModules();
    hookCallback = null;

    // Create a malformed settings.json
    const settingsDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(settingsDir, { recursive: true });
    fs.writeFileSync(
      path.join(settingsDir, 'settings.json'),
      'this is not valid json!!!',
    );

    vi.doMock('../../src/hooks/shared.js', () => ({
      readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
        hookCallback = cb;
      }),
      CLAUDE_DIR: '.claude',
      isMaxsimProject: vi.fn(() => true),
      recentCommits: vi.fn(() => ['abc commit']),
    }));

    await import('../../src/hooks/maxsim-session-start.js');
    expect(() => hookCallback!({ cwd: tmpDir })).not.toThrow();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
