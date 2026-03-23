/**
 * Notification hook — play a short, non-intrusive sound when Claude asks a
 * question (i.e. the Notification event fires).
 *
 * Uses the platform's built-in system sounds so no external audio files are
 * required.  Falls through silently if playback fails for any reason.
 */

import * as path from 'node:path';
import { readStdinJson, playSound, isWindows, isMac } from './shared.js';

interface NotificationInput {
  session_id?: string;
  message?: string;
  [key: string]: unknown;
}

/** Resolve a bundled WAV asset relative to this script, or return null. */
function bundledSound(name: string): string | null {
  // When compiled to a CJS bundle the file sits next to the .cjs file in
  // dist/assets/hooks/.  We look for a sibling sounds/ directory.
  const candidates = [
    path.join(path.dirname(process.argv[1] ?? __filename), 'sounds', name),
    path.join(__dirname, 'sounds', name),
  ];
  for (const p of candidates) {
    try {
      // Use dynamic require check — fs.existsSync would also work
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('node:fs').existsSync(p);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      if (require('node:fs').existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

/** Play the best available notification sound for the current platform. */
function playNotification(): void {
  // 1. Prefer a bundled WAV if present (future-proof for custom sounds)
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
