/**
 * Unit tests for install/hooks.ts — installHooks and removeHooks.
 *
 * Strategy: vi.mock() is hoisted before imports, so we intercept getHooksDir
 * from copy.ts to return a temp-dir-based fake hooks source. copyDir (the real
 * implementation) then copies those dummy .cjs files into the project's
 * hooksDestDir, making all fs.existsSync() guards in installHooks pass.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Hoist mock before any import so that when hooks.ts imports copy.js it
// receives the mocked getHooksDir. copyDir is left as the real implementation
// so that the actual file-copy logic runs against our fake source tree.
// ---------------------------------------------------------------------------

// fakeHooksSrcDir is a module-level variable populated inside beforeEach.
// Because vi.mock factories are hoisted, we use a getter that reads the
// variable at call-time, not at module evaluation time.
let fakeHooksSrcDir = '';

vi.mock('../../src/install/copy.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/install/copy.js')>();
  return {
    ...actual,
    getHooksDir: () => fakeHooksSrcDir,
  };
});

// Import the module-under-test AFTER the mock declaration (Vitest hoists
// vi.mock() calls so the mock is in place when this import is resolved).
import { installHooks, removeHooks } from '../../src/install/hooks.js';

// ---------------------------------------------------------------------------
// Hook file names that installHooks looks for
// ---------------------------------------------------------------------------

const HOOK_FILES = [
  'maxsim-check-update.cjs',
  'maxsim-notification-sound.cjs',
  'maxsim-stop-sound.cjs',
  'maxsim-capture-learnings.cjs',
  'maxsim-statusline.cjs',
  'maxsim-session-start.cjs',
  'maxsim-teammate-idle.cjs',
  'maxsim-task-completed.cjs',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

/** Create a fresh temp dir, populate fakeHooksSrcDir with dummy .cjs files. */
function setupTmpDir(): void {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxsim-hooks-test-'));
  fakeHooksSrcDir = path.join(tmpDir, 'fake-hooks-src');
  fs.mkdirSync(fakeHooksSrcDir, { recursive: true });

  // Write a minimal placeholder for every hook script so copyDir copies them
  // and the subsequent fs.existsSync() checks inside installHooks pass.
  for (const file of HOOK_FILES) {
    fs.writeFileSync(path.join(fakeHooksSrcDir, file), `// dummy ${file}\n`);
  }
}

/** Read and parse settings.json from the project's .claude directory. */
function readSettings(projectDir: string): Record<string, unknown> {
  const settingsPath = path.join(projectDir, '.claude', 'settings.json');
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  setupTmpDir();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fakeHooksSrcDir = '';
  vi.clearAllMocks();
});

// ===========================================================================
// installHooks
// ===========================================================================

describe('installHooks', () => {
  it('creates settings.json when it does not exist yet', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settingsPath = path.join(projectDir, '.claude', 'settings.json');
    expect(fs.existsSync(settingsPath)).toBe(true);
  });

  it('returns the list of installed hook names', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    const { installed } = installHooks(projectDir);

    expect(installed).toContain('maxsim-check-update (SessionStart)');
    expect(installed).toContain('maxsim-notification-sound (Notification)');
    expect(installed).toContain('maxsim-stop-sound (Stop)');
    expect(installed).toContain('maxsim-capture-learnings (Stop)');
    expect(installed).toContain('maxsim-statusline (statusLine)');
    expect(installed).toContain('maxsim-session-start (SessionStart)');
    expect(installed).toContain('maxsim-teammate-idle (TeammateIdle)');
    expect(installed).toContain('maxsim-task-completed (TaskCompleted)');
  });

  it('registers the SessionStart hook for maxsim-session-start', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const sessionStartCommands = settings.hooks.SessionStart
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    expect(sessionStartCommands.some((c) => c.includes('maxsim-session-start'))).toBe(true);
  });

  it('registers the TeammateIdle hook for maxsim-teammate-idle', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const teammateIdleCommands = settings.hooks.TeammateIdle
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    expect(teammateIdleCommands.some((c) => c.includes('maxsim-teammate-idle'))).toBe(true);
  });

  it('registers the TaskCompleted hook for maxsim-task-completed', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const taskCompletedCommands = settings.hooks.TaskCompleted
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    expect(taskCompletedCommands.some((c) => c.includes('maxsim-task-completed'))).toBe(true);
  });

  it('registers the SessionStart hook for maxsim-check-update', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const sessionStartCommands = settings.hooks.SessionStart
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    expect(sessionStartCommands.some((c) => c.includes('maxsim-check-update'))).toBe(true);
  });

  it('registers the Notification hook for maxsim-notification-sound', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const notificationCommands = settings.hooks.Notification
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    expect(notificationCommands.some((c) => c.includes('maxsim-notification-sound'))).toBe(true);
  });

  it('registers two Stop hooks: maxsim-stop-sound and maxsim-capture-learnings', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const stopCommands = settings.hooks.Stop
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    expect(stopCommands.some((c) => c.includes('maxsim-stop-sound'))).toBe(true);
    expect(stopCommands.some((c) => c.includes('maxsim-capture-learnings'))).toBe(true);
    expect(stopCommands.filter((c) => c.includes('maxsim')).length).toBe(2);
  });

  it('sets the statusLine to maxsim-statusline.cjs', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      statusLine: { type: string; command: string };
    };

    expect(settings.statusLine).toBeDefined();
    expect(settings.statusLine.type).toBe('command');
    expect(settings.statusLine.command).toContain('maxsim-statusline');
  });

  it('sets CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS env var to "1"', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      env: Record<string, string>;
    };

    expect(settings.env).toBeDefined();
    expect(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('1');
  });

  it('all registered hook entries use type: "command"', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ type: string; command: string }> }>>;
    };

    for (const matchers of Object.values(settings.hooks)) {
      for (const matcher of matchers) {
        for (const hookEntry of matcher.hooks) {
          expect(hookEntry.type).toBe('command');
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // Idempotency
  // -------------------------------------------------------------------------

  it('is idempotent — running twice does not duplicate SessionStart hooks', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const sessionStartCommands = settings.hooks.SessionStart
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    const updateCheckEntries = sessionStartCommands.filter((c) =>
      c.includes('maxsim-check-update'),
    );
    expect(updateCheckEntries.length).toBe(1);
  });

  it('is idempotent — running twice does not duplicate Notification hooks', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const notificationCommands = settings.hooks.Notification
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    const notifSoundEntries = notificationCommands.filter((c) =>
      c.includes('maxsim-notification-sound'),
    );
    expect(notifSoundEntries.length).toBe(1);
  });

  it('is idempotent — running twice does not duplicate Stop hooks', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const stopCommands = settings.hooks.Stop
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    const stopSoundEntries = stopCommands.filter((c) => c.includes('maxsim-stop-sound'));
    const captureLearningsEntries = stopCommands.filter((c) =>
      c.includes('maxsim-capture-learnings'),
    );

    expect(stopSoundEntries.length).toBe(1);
    expect(captureLearningsEntries.length).toBe(1);
  });

  it('is idempotent — CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS remains "1" after two runs', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      env: Record<string, string>;
    };

    expect(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('1');
  });

  // -------------------------------------------------------------------------
  // Existing settings.json
  // -------------------------------------------------------------------------

  it('preserves unrelated keys in an existing settings.json', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      `${JSON.stringify({ customKey: 'preserve-me', anotherKey: 42 }, null, 2)}\n`,
    );

    installHooks(projectDir);

    const settings = readSettings(projectDir) as Record<string, unknown>;
    expect(settings.customKey).toBe('preserve-me');
    expect(settings.anotherKey).toBe(42);
  });

  it('merges into an existing hooks section without overwriting non-maxsim hooks', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    const existingSettings = {
      hooks: {
        PreToolUse: [
          { hooks: [{ type: 'command', command: 'echo pre-tool-use-hook' }] },
        ],
      },
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      `${JSON.stringify(existingSettings, null, 2)}\n`,
    );

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    // Original PreToolUse hook must still be present
    const preToolCommands = settings.hooks.PreToolUse
      .flatMap((m) => m.hooks)
      .map((h) => h.command);
    expect(preToolCommands).toContain('echo pre-tool-use-hook');

    // Maxsim hooks must also be present
    const stopCommands = settings.hooks.Stop
      .flatMap((m) => m.hooks)
      .map((h) => h.command);
    expect(stopCommands.some((c) => c.includes('maxsim-stop-sound'))).toBe(true);
  });

  it('recovers gracefully from a corrupt settings.json (starts fresh)', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), 'this is not { valid json ]]]');

    expect(() => installHooks(projectDir)).not.toThrow();

    // Should have written a valid settings.json after recovery
    const settings = readSettings(projectDir) as {
      hooks: Record<string, unknown>;
    };
    expect(settings.hooks).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // statusLine idempotency — user-defined statusLine must not be overwritten
  // -------------------------------------------------------------------------

  it('does NOT overwrite a user-defined statusLine that does not contain "maxsim-statusline"', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    const userStatusLine = { type: 'command', command: 'node "/my/custom/statusline.js"' };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      `${JSON.stringify({ statusLine: userStatusLine }, null, 2)}\n`,
    );

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      statusLine: { type: string; command: string };
    };

    // The user's statusLine must be preserved unchanged
    expect(settings.statusLine.command).toBe(userStatusLine.command);
    expect(settings.statusLine.command).not.toContain('maxsim-statusline');
  });

  it('DOES overwrite statusLine when it already points to maxsim-statusline (re-install)', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    // Simulate a prior install that wrote the maxsim statusLine
    const oldStatusLine = {
      type: 'command',
      command: 'node "/old/path/.claude/maxsim/hooks/maxsim-statusline.cjs"',
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      `${JSON.stringify({ statusLine: oldStatusLine }, null, 2)}\n`,
    );

    installHooks(projectDir);

    const settings = readSettings(projectDir) as {
      statusLine: { type: string; command: string };
    };

    // Should now point at the new path (from our fake hooks src)
    expect(settings.statusLine.command).toContain('maxsim-statusline');
    // And specifically it should reference the new hooksDestDir, not the old path
    expect(settings.statusLine.command).not.toContain('/old/path/');
  });
});

// ===========================================================================
// removeHooks
// ===========================================================================

describe('removeHooks', () => {
  it('does nothing and does not throw when settings.json does not exist', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    expect(() => removeHooks(projectDir)).not.toThrow();
  });

  it('removes all maxsim hooks from settings.json', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    removeHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    // hooks object may exist but must contain no maxsim entries
    if (settings.hooks) {
      for (const matchers of Object.values(settings.hooks)) {
        for (const matcher of matchers) {
          for (const hookEntry of matcher.hooks) {
            expect(hookEntry.command).not.toContain('maxsim');
          }
        }
      }
    }
  });

  it('removes the maxsim statusLine', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    removeHooks(projectDir);

    const settings = readSettings(projectDir) as { statusLine?: unknown };
    expect(settings.statusLine).toBeUndefined();
  });

  it('removes CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS from env', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    removeHooks(projectDir);

    const settings = readSettings(projectDir) as { env?: Record<string, string> };
    expect(settings.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBeUndefined();
  });

  it('preserves non-maxsim hooks when removing maxsim hooks', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    // Start with a user-owned hook already present
    const existingSettings = {
      hooks: {
        PreToolUse: [
          { hooks: [{ type: 'command', command: 'echo my-own-lint-hook' }] },
        ],
      },
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      `${JSON.stringify(existingSettings, null, 2)}\n`,
    );

    installHooks(projectDir);
    removeHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    // User's hook must survive
    expect(settings.hooks.PreToolUse).toBeDefined();
    const preToolCommands = settings.hooks.PreToolUse
      .flatMap((m) => m.hooks)
      .map((h) => h.command);
    expect(preToolCommands).toContain('echo my-own-lint-hook');
  });

  it('does not remove a user-defined statusLine that does not contain "maxsim"', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    const userStatusLine = { type: 'command', command: 'node "/custom/status.js"' };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      `${JSON.stringify({ statusLine: userStatusLine }, null, 2)}\n`,
    );

    removeHooks(projectDir);

    const settings = readSettings(projectDir) as {
      statusLine: { type: string; command: string };
    };
    expect(settings.statusLine).toBeDefined();
    expect(settings.statusLine.command).toBe(userStatusLine.command);
  });

  it('does not remove non-maxsim env vars', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      `${JSON.stringify(
        { env: { MY_CUSTOM_VAR: 'keep-me', CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' } },
        null,
        2,
      )}\n`,
    );

    removeHooks(projectDir);

    const settings = readSettings(projectDir) as { env: Record<string, string> };
    expect(settings.env.MY_CUSTOM_VAR).toBe('keep-me');
    expect(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBeUndefined();
  });

  it('removes maxsim hooks from Stop but leaves non-maxsim Stop hooks intact', () => {
    const projectDir = path.join(tmpDir, 'project');
    const claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });

    // Pre-seed a non-maxsim Stop hook
    const existingSettings = {
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: 'echo custom-stop' }] }],
      },
    };
    fs.writeFileSync(
      path.join(claudeDir, 'settings.json'),
      `${JSON.stringify(existingSettings, null, 2)}\n`,
    );

    installHooks(projectDir);
    removeHooks(projectDir);

    const settings = readSettings(projectDir) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };

    const stopCommands = settings.hooks.Stop
      .flatMap((m) => m.hooks)
      .map((h) => h.command);

    // Custom hook must remain
    expect(stopCommands).toContain('echo custom-stop');
    // Maxsim hooks must be gone
    expect(stopCommands.some((c) => c.includes('maxsim'))).toBe(false);
  });

  it('does not throw when the Stop event is fully emptied after removal', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);

    // Verify Stop has maxsim hooks before removal
    const beforeSettings = readSettings(projectDir) as {
      hooks: Record<string, unknown>;
    };
    expect(beforeSettings.hooks.Stop).toBeDefined();

    expect(() => removeHooks(projectDir)).not.toThrow();

    const afterSettings = readSettings(projectDir) as {
      hooks: Record<string, unknown>;
    };
    // Empty event arrays are deleted; Stop should be gone entirely
    expect(afterSettings.hooks?.Stop).toBeUndefined();
  });

  it('leaves settings.json as valid JSON after removal', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    removeHooks(projectDir);

    const settingsPath = path.join(projectDir, '.claude', 'settings.json');
    const raw = fs.readFileSync(settingsPath, 'utf8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('install then remove then install re-registers all hooks correctly', () => {
    const projectDir = path.join(tmpDir, 'project');
    fs.mkdirSync(projectDir);

    installHooks(projectDir);
    removeHooks(projectDir);
    const { installed } = installHooks(projectDir);

    expect(installed).toContain('maxsim-check-update (SessionStart)');
    expect(installed).toContain('maxsim-notification-sound (Notification)');
    expect(installed).toContain('maxsim-stop-sound (Stop)');
    expect(installed).toContain('maxsim-capture-learnings (Stop)');
    expect(installed).toContain('maxsim-session-start (SessionStart)');
    expect(installed).toContain('maxsim-teammate-idle (TeammateIdle)');
    expect(installed).toContain('maxsim-task-completed (TaskCompleted)');
  });
});
