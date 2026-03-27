/**
 * Notification hook — play a short, non-intrusive sound when Claude asks a
 * question (i.e. the Notification event fires).
 *
 * Uses the platform's built-in system sounds so no external audio files are
 * required.  Falls through silently if playback fails for any reason.
 */

import { readStdinJson, playSound, isWindows, isMac, bundledSound, getSoundPreference } from './shared.js';

interface NotificationInput {
  session_id?: string;
  message?: string;
  cwd?: string;
  [key: string]: unknown;
}

/** Play a system notification sound (no bundled WAV). */
function playSystemNotification(): void {
  if (isWindows()) {
    playSound('SystemAsterisk');
  } else if (isMac()) {
    playSound('/System/Library/Sounds/Funk.aiff');
  } else {
    playSound('/usr/share/sounds/freedesktop/stereo/message-new-instant.oga');
  }
}

/** Play the best available notification sound for the current platform. */
function playNotification(preference: 'bundled' | 'system'): void {
  if (preference === 'bundled') {
    const wav = bundledSound('notification.wav');
    if (wav) {
      playSound(wav);
      return;
    }
    // Fall back to system sound if bundled WAV not found
  }

  playSystemNotification();
}

readStdinJson<NotificationInput>((input) => {
  const pref = getSoundPreference(input.cwd ?? process.cwd());
  playNotification(pref);
  process.exit(0);
});
