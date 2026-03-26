import { execFileSync } from 'node:child_process';

export function checkGhAuth(): { ok: boolean; message?: string } {
  try {
    execFileSync('gh', ['auth', 'status'], { stdio: 'pipe' });
    return { ok: true };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ok: false, message: 'GitHub CLI (gh) is not installed. Install it from https://cli.github.com/' };
    }
    return { ok: false, message: 'GitHub CLI is not authenticated. Run: gh auth login' };
  }
}
