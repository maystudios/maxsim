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
