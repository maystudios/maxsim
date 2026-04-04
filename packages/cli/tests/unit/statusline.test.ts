// biome-ignore-all lint/style/noNonNullAssertion: test callbacks require non-null assertion
/**
 * Unit tests for hooks/maxsim-statusline.ts.
 *
 * The hook outputs a brief status string for the Claude Code terminal status
 * bar. It reads maxsim config and phase files to determine the current state.
 *
 * We mock readStdinJson to capture the callback, and use a real temp directory
 * to exercise the hook's filesystem logic end-to-end.
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
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-test-'));
  hookCallback = null;
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
    return undefined as never;
  });
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.doUnmock('../../src/hooks/shared.js');
  vi.resetModules();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper to load the hook with controlled mocks
// ---------------------------------------------------------------------------

async function loadHook() {
  vi.doMock('../../src/hooks/shared.js', () => ({
    readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
      hookCallback = cb;
    }),
    CLAUDE_DIR: '.claude',
  }));

  await import('../../src/hooks/maxsim-statusline.js');
}

/** Write a maxsim config.json to the temp project directory. */
function writeConfig(config: Record<string, unknown>): void {
  const configDir = path.join(tmpDir, '.claude', 'maxsim');
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'config.json'),
    JSON.stringify(config),
    'utf8',
  );
}


/** Get the status text that was written to stdout. */
function getStatusOutput(): string {
  const calls = stdoutSpy.mock.calls;
  return calls.map((c) => String(c[0])).join('');
}

// ---------------------------------------------------------------------------
// Output when config has currentPhase
// ---------------------------------------------------------------------------

describe('output when config has currentPhase', () => {
  it('outputs "MAXSIM > Phase N | status" when currentPhase is set', async () => {
    writeConfig({ currentPhase: 3, projectStatus: 'Testing' });
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    const output = getStatusOutput();
    expect(output).toContain('MAXSIM');
    expect(output).toContain('Phase 3');
    expect(output).toContain('Testing');
  });

  it('uses "In Progress" as default status when projectStatus is not set', async () => {
    writeConfig({ currentPhase: 1 });
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    const output = getStatusOutput();
    expect(output).toContain('Phase 1');
    expect(output).toContain('In Progress');
  });

  it('handles phase 0', async () => {
    writeConfig({ currentPhase: 0, projectStatus: 'Planning' });
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    const output = getStatusOutput();
    expect(output).toContain('Phase 0');
    expect(output).toContain('Planning');
  });
});

// ---------------------------------------------------------------------------
// Output when config has no currentPhase
// ---------------------------------------------------------------------------

describe('output when config has no currentPhase', () => {
  it('outputs status without phase number when currentPhase is absent', async () => {
    writeConfig({ projectStatus: 'Reviewing' });
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    const output = getStatusOutput();
    expect(output).toContain('MAXSIM');
    expect(output).toContain('Reviewing');
    expect(output).not.toContain('Phase');
  });

  it('uses "In Progress" as default when both currentPhase and projectStatus are absent', async () => {
    writeConfig({});
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    const output = getStatusOutput();
    expect(output).toContain('MAXSIM');
    expect(output).toContain('In Progress');
  });

  it('outputs status from projectStatus when currentPhase is a non-number', async () => {
    writeConfig({ currentPhase: 'not-a-number', projectStatus: 'Custom Status' });
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    const output = getStatusOutput();
    expect(output).toContain('Custom Status');
    expect(output).not.toContain('Phase');
  });
});

// ---------------------------------------------------------------------------
// Output when no config exists (phase files are irrelevant — config-only)
// ---------------------------------------------------------------------------

describe('output when no config exists but phase files exist', () => {
  it('outputs "MAXSIM > Ready" when phase files exist but no config (config-only approach)', async () => {
    // Phase files in .claude/maxsim/phases/ are not consulted — only config matters
    const phasesDir = path.join(tmpDir, '.claude', 'maxsim', 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(path.join(phasesDir, 'phase-1.json'), '{}', 'utf8');

    await loadHook();

    hookCallback!({ cwd: tmpDir });

    const output = getStatusOutput();
    expect(output).toContain('MAXSIM');
    expect(output).toContain('Ready');
  });
});

// ---------------------------------------------------------------------------
// Output "MAXSIM > Ready" when nothing exists
// ---------------------------------------------------------------------------

describe('output when nothing exists', () => {
  it('outputs "MAXSIM > Ready" when no config and no phase files exist', async () => {
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    const output = getStatusOutput();
    expect(output).toContain('MAXSIM');
    expect(output).toContain('Ready');
  });

  it('outputs "MAXSIM > Ready" when .claude directory does not exist at all', async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-empty-'));
    try {
      await loadHook();

      hookCallback!({ cwd: emptyDir });

      const output = getStatusOutput();
      expect(output).toContain('MAXSIM');
      expect(output).toContain('Ready');
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Exit code is always 0
// ---------------------------------------------------------------------------

describe('exit code', () => {
  it('exits 0 when config has currentPhase', async () => {
    writeConfig({ currentPhase: 2, projectStatus: 'Building' });
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 when no config exists', async () => {
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 when phase files exist but no config', async () => {
    const phasesDir = path.join(tmpDir, '.claude', 'maxsim', 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });
    fs.writeFileSync(path.join(phasesDir, 'phase-1.json'), '{}', 'utf8');
    await loadHook();

    hookCallback!({ cwd: tmpDir });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 when cwd is not provided (uses process.cwd fallback)', async () => {
    await loadHook();

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
