/** Shared utilities for MAXSIM hooks. */

import * as fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';

export function readStdinJson<T>(callback: (data: T) => void): void {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk: string) => {
    input += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input) as T;
      callback(data);
    } catch {
      process.exit(0);
    }
  });
}

export const CLAUDE_DIR = '.claude';

/** Returns true when .claude/maxsim/config.json exists in the given directory. */
export function isMaxsimProject(projectDir: string): boolean {
  try {
    return fs.existsSync(path.join(projectDir, CLAUDE_DIR, 'maxsim', 'config.json'));
  } catch {
    return false;
  }
}

/** Reads the last N git commits as oneline strings. Returns empty array on failure. */
export function recentCommits(projectDir: string, n = 5): string[] {
  try {
    const result = spawnSync(
      'git',
      ['log', '--oneline', `-${n}`],
      {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 4000,
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    );
    if (result.status !== 0) return [];
    return (result.stdout ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Returns true when running on Windows. */
export function isWindows(): boolean {
  return os.platform() === 'win32';
}

/** Returns true when running on macOS. */
export function isMac(): boolean {
  return os.platform() === 'darwin';
}

/**
 * Resolve a bundled WAV asset relative to the running hook script, or return null.
 *
 * When compiled to a CJS bundle the file sits next to the .cjs file in
 * dist/assets/hooks/. We look for a sibling sounds/ directory.
 */
export function bundledSound(name: string): string | null {
  const candidates = [
    path.join(path.dirname(process.argv[1] ?? __filename), 'sounds', name),
    path.join(__dirname, 'sounds', name),
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      if (require('node:fs').existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Play a system sound file cross-platform.
 * Never throws — sound failure is always silently swallowed.
 *
 * @param soundFile Absolute path to a WAV/MP3/etc. file, or a named system
 *                  sound token recognised by the platform helper (e.g. the
 *                  Windows-only SystemAsterisk token).
 */
export function playSound(soundFile: string): void {
  try {
    if (isWindows()) {
      // PowerShell's SoundPlayer works with WAV files synchronously.
      // For named system sounds (no extension) fall back to rundll32.
      const isWav = soundFile.toLowerCase().endsWith('.wav');
      if (isWav) {
        // Use double-quoted string which handles spaces and most special chars
        const escaped = soundFile.replace(/"/g, '\\"');
        spawnSync(
          'powershell',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `$p="${escaped}"; (New-Object System.Media.SoundPlayer $p).PlaySync()`,
          ],
          { stdio: 'ignore' },
        );
      } else {
        // Named system sound token (e.g. "SystemAsterisk") or unsupported format —
        // use the rundll32 winsound bridge.
        spawnSync(
          'rundll32',
          ['user32.dll,MessageBeep'],
          { stdio: 'ignore' },
        );
      }
    } else if (isMac()) {
      spawnSync('afplay', [soundFile], { stdio: 'ignore' });
    } else {
      // Linux: try paplay (PulseAudio) then aplay (ALSA)
      const paplay = spawnSync('paplay', [soundFile], { stdio: 'ignore' });
      if (paplay.status !== 0) {
        spawnSync('aplay', [soundFile], { stdio: 'ignore' });
      }
    }
  } catch {
    // Never crash on sound failure
  }
}

/**
 * Send a JSON stop signal to terminate a teammate.
 * Outputs the stop payload to stdout and exits cleanly.
 * Use this when a teammate should be permanently stopped (not just blocked).
 *
 * For blocking (retry behavior), use: process.stderr.write(msg); process.exit(2);
 * For stopping (permanent), use: stopTeammate(reason);
 */
export function stopTeammate(reason: string): never {
  const payload = JSON.stringify({ continue: false, stopReason: reason });
  process.stdout.write(`${payload}\n`);
  process.exit(0);
}
