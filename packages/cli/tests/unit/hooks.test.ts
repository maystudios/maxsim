/**
 * Unit tests for hooks/shared.ts utilities.
 *
 * The hooks themselves run as standalone CJS processes at runtime; here we test
 * only the shared utility layer which is importable from TypeScript.
 *
 * Note: vi.mock() calls are hoisted to the top of the module by Vitest, so the
 * mocked modules are in place before any imports or tests run.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mock for node:child_process so it is in place when shared.ts is imported.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawnSync: vi.fn(actual.spawnSync),
    spawn: vi.fn(actual.spawn),
  };
});

// Now import shared — it will receive the mocked child_process.
import * as shared from '../../src/hooks/shared.js';
import * as childProcess from 'node:child_process';

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

// ---------------------------------------------------------------------------
// readStdinJson
// ---------------------------------------------------------------------------

describe('readStdinJson', () => {
  afterEach(() => vi.restoreAllMocks());

  it('calls the callback with parsed JSON from stdin', () =>
    new Promise<void>((resolve, reject) => {
      let dataHandler: ((chunk: string) => void) | null = null;
      let endHandler: (() => void) | null = null;

      vi.spyOn(process.stdin, 'setEncoding').mockImplementation(() => process.stdin);
      vi.spyOn(process.stdin, 'on').mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'data') dataHandler = handler as (chunk: string) => void;
        if (event === 'end') endHandler = handler as () => void;
        return process.stdin;
      });

      shared.readStdinJson<{ hello: string }>((data) => {
        try {
          expect(data).toEqual({ hello: 'world' });
          resolve();
        } catch (e) {
          reject(e as Error);
        }
      });

      if (dataHandler) dataHandler('{"hello":"world"}');
      if (endHandler) endHandler();
    }));

  it('calls process.exit(0) for invalid JSON without throwing', () =>
    new Promise<void>((resolve, reject) => {
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
        return undefined as never;
      });

      vi.spyOn(process.stdin, 'setEncoding').mockImplementation(() => process.stdin);

      let dataHandler: ((chunk: string) => void) | null = null;
      let endHandler: (() => void) | null = null;

      vi.spyOn(process.stdin, 'on').mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
        if (event === 'data') dataHandler = handler as (chunk: string) => void;
        if (event === 'end') endHandler = handler as () => void;
        return process.stdin;
      });

      shared.readStdinJson<unknown>((_data) => {
        reject(new Error('callback called unexpectedly for invalid JSON'));
      });

      if (dataHandler) dataHandler('not valid json {{{');
      if (endHandler) endHandler();

      setTimeout(() => {
        try {
          expect(exitSpy).toHaveBeenCalledWith(0);
          resolve();
        } catch (e) {
          reject(e as Error);
        }
      }, 10);
    }));
});

// ---------------------------------------------------------------------------
// isWindows / isMac
// ---------------------------------------------------------------------------

describe('isWindows', () => {
  it('returns a boolean', () => {
    expect(typeof shared.isWindows()).toBe('boolean');
  });

  it('reflects the actual runtime platform', () => {
    const expected = process.platform === 'win32';
    expect(shared.isWindows()).toBe(expected);
  });
});

describe('isMac', () => {
  it('returns a boolean', () => {
    expect(typeof shared.isMac()).toBe('boolean');
  });

  it('reflects the actual runtime platform', () => {
    const expected = process.platform === 'darwin';
    expect(shared.isMac()).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// playSound
// ---------------------------------------------------------------------------

describe('playSound', () => {
  beforeEach(() => {
    spawnSyncMock.mockReturnValue(SUCCESS_RESULT);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not throw for a non-existent WAV file', () => {
    expect(() => shared.playSound('/nonexistent/path/sound.wav')).not.toThrow();
  });

  it('does not throw for an empty string argument', () => {
    expect(() => shared.playSound('')).not.toThrow();
  });

  it('does not throw when spawnSync throws internally', () => {
    spawnSyncMock.mockImplementation(() => {
      throw new Error('spawn error');
    });
    expect(() => shared.playSound('/some/sound.wav')).not.toThrow();
  });

  it('calls spawnSync at least once for a WAV file', () => {
    shared.playSound('/tmp/test.wav');
    expect(spawnSyncMock).toHaveBeenCalled();
  });

  it('calls spawnSync with the correct tool for the current platform', () => {
    shared.playSound('/tmp/test.wav');
    const calledCommands = spawnSyncMock.mock.calls.map((call) => call[0] as string);

    if (process.platform === 'win32') {
      expect(calledCommands).toContain('powershell');
    } else if (process.platform === 'darwin') {
      expect(calledCommands).toContain('afplay');
    } else {
      // Linux: paplay or aplay
      const linuxCmds = calledCommands.filter((c) => c === 'paplay' || c === 'aplay');
      expect(linuxCmds.length).toBeGreaterThan(0);
    }
  });

  it('falls back to aplay when paplay exits non-zero (Linux only)', () => {
    if (process.platform !== 'linux') {
      // This branch is platform-specific; skip on non-Linux runners.
      return;
    }

    let callCount = 0;
    spawnSyncMock.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? FAIL_RESULT : SUCCESS_RESULT;
    });

    shared.playSound('/usr/share/sounds/test.oga');
    expect(callCount).toBe(2);

    const cmds = spawnSyncMock.mock.calls.map((c) => c[0] as string);
    expect(cmds[0]).toBe('paplay');
    expect(cmds[1]).toBe('aplay');
  });
});

// ---------------------------------------------------------------------------
// getSoundPreference
// ---------------------------------------------------------------------------

describe('getSoundPreference', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = require('node:fs').mkdtempSync(
      require('node:path').join(require('node:os').tmpdir(), 'getsoundpref-test-'),
    );
  });

  afterEach(() => {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when config.json does not exist', () => {
    const result = shared.getSoundPreference(tmpDir);
    expect(result).toEqual({ style: 'system', volume: 50 });
  });

  it('returns bundled style when hooks.sound_style is "bundled"', () => {
    const configDir = require('node:path').join(tmpDir, '.claude', 'maxsim');
    require('node:fs').mkdirSync(configDir, { recursive: true });
    require('node:fs').writeFileSync(
      require('node:path').join(configDir, 'config.json'),
      JSON.stringify({ hooks: { sound_style: 'bundled', sound_volume: 75 } }),
    );

    const result = shared.getSoundPreference(tmpDir);
    expect(result.style).toBe('bundled');
    expect(result.volume).toBe(75);
  });

  it('clamps volume to 0-100 range', () => {
    const configDir = require('node:path').join(tmpDir, '.claude', 'maxsim');
    require('node:fs').mkdirSync(configDir, { recursive: true });
    require('node:fs').writeFileSync(
      require('node:path').join(configDir, 'config.json'),
      JSON.stringify({ hooks: { sound_volume: 999 } }),
    );

    const result = shared.getSoundPreference(tmpDir);
    expect(result.volume).toBe(100);
  });

  it('returns default volume when sound_volume is not a number', () => {
    const configDir = require('node:path').join(tmpDir, '.claude', 'maxsim');
    require('node:fs').mkdirSync(configDir, { recursive: true });
    require('node:fs').writeFileSync(
      require('node:path').join(configDir, 'config.json'),
      JSON.stringify({ hooks: { sound_volume: 'loud' } }),
    );

    const result = shared.getSoundPreference(tmpDir);
    expect(result.volume).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// isMaxsimProject
// ---------------------------------------------------------------------------

describe('isMaxsimProject', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = require('node:fs').mkdtempSync(
      require('node:path').join(require('node:os').tmpdir(), 'ismaxsim-test-'),
    );
  });

  afterEach(() => {
    require('node:fs').rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns true when .claude/maxsim/config.json exists', () => {
    const configDir = require('node:path').join(tmpDir, '.claude', 'maxsim');
    require('node:fs').mkdirSync(configDir, { recursive: true });
    require('node:fs').writeFileSync(
      require('node:path').join(configDir, 'config.json'),
      '{}',
    );

    expect(shared.isMaxsimProject(tmpDir)).toBe(true);
  });

  it('returns false when .claude/maxsim/config.json does not exist', () => {
    expect(shared.isMaxsimProject(tmpDir)).toBe(false);
  });

  it('returns false when path is invalid (null character)', () => {
    expect(shared.isMaxsimProject('/\0/invalid')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// stopTeammate
// ---------------------------------------------------------------------------

describe('stopTeammate', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
      return undefined as never;
    });
    stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes JSON with continue:false and stopReason to stdout', () => {
    shared.stopTeammate('task limit reached');

    const output = stdoutSpy.mock.calls.map((c) => String(c[0])).join('');
    const parsed = JSON.parse(output.trim());
    expect(parsed.continue).toBe(false);
    expect(parsed.stopReason).toBe('task limit reached');
  });

  it('exits 0 after writing', () => {
    shared.stopTeammate('done');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// recentCommits
// ---------------------------------------------------------------------------

describe('recentCommits', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when git exits non-zero', () => {
    spawnSyncMock.mockReturnValue(FAIL_RESULT);
    expect(shared.recentCommits('/some/dir')).toEqual([]);
  });

  it('returns empty array when spawnSync throws', () => {
    spawnSyncMock.mockImplementation(() => { throw new Error('not found'); });
    expect(shared.recentCommits('/some/dir')).toEqual([]);
  });

  it('parses stdout into trimmed lines', () => {
    spawnSyncMock.mockReturnValue({
      ...SUCCESS_RESULT,
      stdout: 'abc1234 first\n  def5678 second  \n\n' as unknown as Buffer,
    });
    expect(shared.recentCommits('/some/dir', 2)).toEqual([
      'abc1234 first',
      'def5678 second',
    ]);
  });
});
