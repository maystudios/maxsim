// biome-ignore-all lint/style/noNonNullAssertion: test callbacks require non-null assertion
/**
 * Unit tests for hooks/maxsim-stop-sound.ts.
 *
 * The hook plays a completion sound when the Stop event fires, but skips
 * playback when `stop_hook_active` is true. We mock readStdinJson to capture
 * the callback, and mock playSound / platform helpers to verify behavior.
 *
 * Because the hook calls process.exit(0) which we mock to throw (so execution
 * stops at the right point), all hookCallback invocations are wrapped in
 * try/catch.
 *
 * Note: vi.mock() calls are hoisted to the top of the module by Vitest.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared test infrastructure
// ---------------------------------------------------------------------------

let hookCallback: ((input: Record<string, unknown>) => void) | null = null;
let exitSpy: ReturnType<typeof vi.spyOn>;
let playSoundMock: ReturnType<typeof vi.fn>;
let isWindowsMock: ReturnType<typeof vi.fn>;
let isMacMock: ReturnType<typeof vi.fn>;
let bundledSoundMock: ReturnType<typeof vi.fn>;
let getSoundPreferenceMock: ReturnType<typeof vi.fn>;

class ExitError extends Error {
  code: number | string | undefined;
  constructor(code?: number | string) {
    super(`process.exit(${code})`);
    this.code = code;
  }
}

/** Invoke the hook callback and swallow the ExitError thrown by our mock. */
function invokeHook(input: Record<string, unknown>): void {
  try {
    hookCallback!(input);
  } catch (e) {
    if (!(e instanceof ExitError)) throw e;
  }
}

beforeEach(() => {
  hookCallback = null;
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number | string) => {
    throw new ExitError(code);
  });
});

afterEach(() => {
  vi.doUnmock('../../src/hooks/shared.js');
  vi.resetModules();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helper to load the hook with controlled mocks
// ---------------------------------------------------------------------------

async function loadHook(opts: {
  isWindows?: boolean;
  isMac?: boolean;
  bundledSound?: string | null;
  soundPreference?: 'bundled' | 'system';
}) {
  playSoundMock = vi.fn();
  isWindowsMock = vi.fn(() => opts.isWindows ?? false);
  isMacMock = vi.fn(() => opts.isMac ?? false);
  bundledSoundMock = vi.fn(() => opts.bundledSound ?? null);
  getSoundPreferenceMock = vi.fn(() => ({ style: opts.soundPreference ?? 'system', volume: 50 }));

  vi.doMock('../../src/hooks/shared.js', () => ({
    readStdinJson: vi.fn((cb: (data: Record<string, unknown>) => void) => {
      hookCallback = cb;
    }),
    playSound: playSoundMock,
    isWindows: isWindowsMock,
    isMac: isMacMock,
    bundledSound: bundledSoundMock,
    getSoundPreference: getSoundPreferenceMock,
  }));

  await import('../../src/hooks/maxsim-stop-sound.js');
}

// ---------------------------------------------------------------------------
// stop_hook_active guard
// ---------------------------------------------------------------------------

describe('stop_hook_active guard', () => {
  it('skips sound playback when stop_hook_active is true', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    invokeHook({ stop_hook_active: true });

    expect(playSoundMock).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 immediately when stop_hook_active is true', async () => {
    await loadHook({ isWindows: false, isMac: false });

    invokeHook({ stop_hook_active: true });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('does not skip sound when stop_hook_active is false', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    invokeHook({ stop_hook_active: false });

    expect(playSoundMock).toHaveBeenCalled();
  });

  it('does not skip sound when stop_hook_active is not provided', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    invokeHook({});

    expect(playSoundMock).toHaveBeenCalled();
  });

  it('does not skip sound when stop_hook_active is undefined', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    invokeHook({ stop_hook_active: undefined });

    expect(playSoundMock).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Sound playback when stop_hook_active is false
// ---------------------------------------------------------------------------

describe('sound playback when stop_hook_active is false', () => {
  it('plays the bundled complete.wav when available', async () => {
    await loadHook({ bundledSound: '/path/to/complete.wav', soundPreference: 'bundled' });

    invokeHook({ stop_hook_active: false });

    expect(playSoundMock).toHaveBeenCalledWith('/path/to/complete.wav', 50);
  });

  it('checks for bundled complete.wav when preference is bundled', async () => {
    await loadHook({ bundledSound: null, isMac: true, soundPreference: 'bundled' });

    invokeHook({});

    expect(bundledSoundMock).toHaveBeenCalledWith('complete.wav');
  });

  it('plays SystemNotification on Windows when no bundled sound', async () => {
    await loadHook({ isWindows: true, isMac: false, bundledSound: null });

    invokeHook({});

    expect(playSoundMock).toHaveBeenCalledWith('SystemNotification');
  });

  it('plays Glass.aiff on macOS when no bundled sound', async () => {
    await loadHook({ isWindows: false, isMac: true, bundledSound: null });

    invokeHook({});

    expect(playSoundMock).toHaveBeenCalledWith('/System/Library/Sounds/Glass.aiff');
  });

  it('plays freedesktop complete sound on Linux when no bundled sound', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    invokeHook({});

    expect(playSoundMock).toHaveBeenCalledWith(
      '/usr/share/sounds/freedesktop/stereo/complete.oga',
    );
  });

  it('prefers bundled WAV over platform sound when preference is bundled', async () => {
    await loadHook({ isWindows: true, bundledSound: '/bundled/complete.wav', soundPreference: 'bundled' });

    invokeHook({});

    expect(playSoundMock).toHaveBeenCalledWith('/bundled/complete.wav', 50);
    expect(playSoundMock).not.toHaveBeenCalledWith('SystemNotification');
  });
});

// ---------------------------------------------------------------------------
// Exit code is always 0
// ---------------------------------------------------------------------------

describe('exit code', () => {
  it('exits 0 after playing sound', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    invokeHook({ stop_hook_active: false });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 when stop_hook_active is true', async () => {
    await loadHook({ isWindows: false, isMac: false });

    invokeHook({ stop_hook_active: true });

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 with no input properties', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    invokeHook({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});

// ---------------------------------------------------------------------------
// Edge case: truthy non-boolean stop_hook_active
// ---------------------------------------------------------------------------

describe('truthy non-boolean stop_hook_active', () => {
  it('plays sound when stop_hook_active is truthy but not exactly boolean true', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    // The hook checks `input.stop_hook_active === true` (strict equality)
    // So truthy non-boolean values like "true" or 1 should NOT skip playback
    invokeHook({ stop_hook_active: 'true' as unknown as boolean });

    expect(playSoundMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('plays sound when stop_hook_active is number 1 (not boolean true)', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    invokeHook({ stop_hook_active: 1 as unknown as boolean });

    expect(playSoundMock).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
