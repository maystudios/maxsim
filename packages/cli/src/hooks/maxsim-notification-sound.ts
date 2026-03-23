/**
 * Notification hook — play a short, non-intrusive sound when Claude asks a
 * question (i.e. the Notification event fires).
 *
 * Uses the platform's built-in system sounds so no external audio files are
 * required.  Falls through silently if playback fails for any reason.
 */

import { readStdinJson, playSound, isWindows, isMac, bundledSound } from './shared.js';

interface NotificationInput {
  session_id?: string;
  message?: string;
  [key: string]: unknown;
}

/** Play the best available notification sound for the current platform. */
function playNotification(): void {
  // 1. Prefer a bundled WAV if present
  const wav = bundledSound('notification.wav');
  if (wav) {
    playSound(wav);
    return;
  }

  // 2. Fall back to a built-in system sound
  if (isWindows()) {
    // SystemAsterisk maps to the Windows "Asterisk" event sound
    playSound('SystemAsterisk');
  } else if (isMac()) {
    // /System/Library/Sounds/Funk.aiff — short, non-intrusive
    playSound('/System/Library/Sounds/Funk.aiff');
  } else {
    // Linux: /usr/share/sounds/freedesktop/stereo/message-new-instant.oga
    playSound('/usr/share/sounds/freedesktop/stereo/message-new-instant.oga');
  }
}

readStdinJson<NotificationInput>((_input) => {
  playNotification();
  process.exit(0);
});
