/**
 * Stop hook — play a satisfying completion sound when Claude finishes a task
 * (i.e. the Stop event fires).
 *
 * Uses platform-native system sounds so no external audio files are required.
 * Falls through silently if playback fails.
 */

import { readStdinJson, playSound, isWindows, isMac, bundledSound } from './shared.js';

interface StopInput {
  session_id?: string;
  stop_reason?: string;
  stop_hook_active?: boolean;
  [key: string]: unknown;
}

/** Play the best available completion sound for the current platform. */
function playCompletion(): void {
  // 1. Prefer a bundled WAV if present
  const wav = bundledSound('complete.wav');
  if (wav) {
    playSound(wav);
    return;
  }

  // 2. Fall back to a built-in system sound
  if (isWindows()) {
    // SystemNotification maps to the Windows notification toast sound
    playSound('SystemNotification');
  } else if (isMac()) {
    // Glass — a clean, pleasant completion chime
    playSound('/System/Library/Sounds/Glass.aiff');
  } else {
    // Linux: use the freedesktop complete sound
    playSound('/usr/share/sounds/freedesktop/stereo/complete.oga');
  }
}

readStdinJson<StopInput>((input) => {
  if (input.stop_hook_active === true) {
    process.exit(0);
  }
  playCompletion();
  process.exit(0);
});
