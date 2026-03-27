/**
 * Stop hook — play a satisfying completion sound when Claude finishes a task
 * (i.e. the Stop event fires).
 *
 * Uses platform-native system sounds so no external audio files are required.
 * Falls through silently if playback fails.
 */

import { readStdinJson, playSound, isWindows, isMac, bundledSound, getSoundPreference } from './shared.js';

interface StopInput {
  session_id?: string;
  stop_reason?: string;
  stop_hook_active?: boolean;
  cwd?: string;
  [key: string]: unknown;
}

/** Play a system completion sound (no bundled WAV). */
function playSystemCompletion(): void {
  if (isWindows()) {
    playSound('SystemNotification');
  } else if (isMac()) {
    playSound('/System/Library/Sounds/Glass.aiff');
  } else {
    playSound('/usr/share/sounds/freedesktop/stereo/complete.oga');
  }
}

/** Play the best available completion sound for the current platform. */
function playCompletion(preference: 'bundled' | 'system', volume: number): void {
  if (preference === 'bundled') {
    const wav = bundledSound('complete.wav');
    if (wav) {
      playSound(wav, volume);
      return;
    }
    // Fall back to system sound if bundled WAV not found
  }

  playSystemCompletion();
}

readStdinJson<StopInput>((input) => {
  if (input.stop_hook_active === true) {
    process.exit(0);
  }
  const { style, volume } = getSoundPreference(input.cwd ?? process.cwd());
  playCompletion(style, volume);
  process.exit(0);
});
