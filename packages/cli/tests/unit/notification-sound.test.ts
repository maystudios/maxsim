// biome-ignore-all lint/style/noNonNullAssertion: test callbacks require non-null assertion
/**
 * Unit tests for hooks/maxsim-notification-sound.ts.
 *
 * The hook plays a platform-appropriate notification sound when the
 * Notification event fires. We mock readStdinJson to capture the callback,
 * and mock playSound / platform helpers to verify behavior.
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

beforeEach(() => {
  hookCallback = null;
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: number | string) => {
    return undefined as never;
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

  await import('../../src/hooks/maxsim-notification-sound.js');
}

// ---------------------------------------------------------------------------
// Sound playback on Notification event
// ---------------------------------------------------------------------------

describe('sound playback on Notification event', () => {
  it('attempts to play a sound when the Notification callback fires', async () => {
    await loadHook({ isWindows: false, isMac: false });

    hookCallback!({ session_id: 'test-session', message: 'Need input' });

    expect(playSoundMock).toHaveBeenCalled();
  });

  it('plays the bundled WAV when available', async () => {
    await loadHook({ bundledSound: '/path/to/notification.wav', soundPreference: 'bundled' });

    hookCallback!({ message: 'Question' });

    expect(playSoundMock).toHaveBeenCalledWith('/path/to/notification.wav', 50);
  });

  it('checks for bundled notification.wav when preference is bundled', async () => {
    await loadHook({ bundledSound: null, isMac: true, soundPreference: 'bundled' });

    hookCallback!({});

    expect(bundledSoundMock).toHaveBeenCalledWith('notification.wav');
  });
});

// ---------------------------------------------------------------------------
// Platform-specific sound selection
// ---------------------------------------------------------------------------

describe('platform-specific sound selection', () => {
  it('plays SystemAsterisk on Windows when no bundled sound', async () => {
    await loadHook({ isWindows: true, isMac: false, bundledSound: null });

    hookCallback!({});

    expect(playSoundMock).toHaveBeenCalledWith('SystemAsterisk');
  });

  it('plays Funk.aiff on macOS when no bundled sound', async () => {
    await loadHook({ isWindows: false, isMac: true, bundledSound: null });

    hookCallback!({});

    expect(playSoundMock).toHaveBeenCalledWith('/System/Library/Sounds/Funk.aiff');
  });

  it('plays freedesktop sound on Linux when no bundled sound', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    hookCallback!({});

    expect(playSoundMock).toHaveBeenCalledWith(
      '/usr/share/sounds/freedesktop/stereo/message-new-instant.oga',
    );
  });

  it('prefers bundled WAV over platform sound when preference is bundled', async () => {
    await loadHook({ isWindows: true, bundledSound: '/bundled/notification.wav', soundPreference: 'bundled' });

    hookCallback!({});

    expect(playSoundMock).toHaveBeenCalledWith('/bundled/notification.wav', 50);
    // Should not have been called with the Windows system sound
    expect(playSoundMock).not.toHaveBeenCalledWith('SystemAsterisk');
  });
});

// ---------------------------------------------------------------------------
// Exit code is always 0
// ---------------------------------------------------------------------------

describe('exit code', () => {
  it('exits 0 after playing sound', async () => {
    await loadHook({ isWindows: false, isMac: false, bundledSound: null });

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 on Windows', async () => {
    await loadHook({ isWindows: true, bundledSound: null });

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 0 on macOS', async () => {
    await loadHook({ isWindows: false, isMac: true, bundledSound: null });

    hookCallback!({});

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

});
