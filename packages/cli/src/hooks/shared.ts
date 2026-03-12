/**
 * Shared utilities for MAXSIM hooks.
 */

/**
 * Read all stdin as a string, then invoke callback with parsed JSON.
 * Used by statusline and sync-reminder hooks.
 */
export function readStdinJson<T>(callback: (data: T) => void): void {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => (input += chunk));
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input) as T;
      callback(data);
    } catch {
      // Silent fail -- never block hook execution
      process.exit(0);
    }
  });
}

/** The '.claude' path segment -- template marker replaced during install. */
export const CLAUDE_DIR = '.claude';

/**
 * Play a system sound for notifications. Fire-and-forget, never blocks.
 * Suppressed when MAXSIM_SOUND=0, CI=true, or SSH_CONNECTION is set.
 */
export function playSound(type: 'question' | 'stop'): void {
  try {
    if (
      process.env.MAXSIM_SOUND === '0' ||
      process.env.CI === 'true' ||
      process.env.SSH_CONNECTION
    ) {
      return;
    }

    const platform = process.platform;

    if (platform === 'win32') {
      const file =
        type === 'question'
          ? 'C:\\Windows\\Media\\notify.wav'
          : 'C:\\Windows\\Media\\chimes.wav';
      const { spawn } = require('node:child_process') as typeof import('node:child_process');
      const child = spawn(
        'powershell',
        ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', `(New-Object Media.SoundPlayer '${file}').PlaySync()`],
        { stdio: 'ignore', windowsHide: true },
      );
      child.unref();
    } else if (platform === 'darwin') {
      const file =
        type === 'question'
          ? '/System/Library/Sounds/Ping.aiff'
          : '/System/Library/Sounds/Glass.aiff';
      const { spawn } = require('node:child_process') as typeof import('node:child_process');
      const child = spawn('afplay', [file], {
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
    } else {
      // Linux / unknown — terminal bell fallback
      process.stderr.write('\x07');
    }
  } catch {
    // Silent fail — never block hook execution
  }
}
