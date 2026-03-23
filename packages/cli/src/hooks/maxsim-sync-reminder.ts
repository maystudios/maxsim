/**
 * Stop hook (secondary) — remind the user to sync their MaxsimCLI config to
 * version control after a Claude session ends.
 *
 * Behaviour:
 *  - Checks whether the project has uncommitted changes in .claude/maxsim/.
 *  - If there are dirty tracked files, emits a JSON block that adds a short
 *    reminder to Claude's context.
 *  - Runs fast (<50 ms): one `git status --short` call, no network I/O.
 *  - Always exits 0 — never blocks the user.
 */

import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readStdinJson, CLAUDE_DIR } from './shared.js';

interface StopInput {
  cwd?: string;
  session_id?: string;
  [key: string]: unknown;
}

/** Returns true if there are modified/untracked files under .claude/maxsim/. */
function hasUncommittedMaxsimChanges(projectDir: string): boolean {
  try {
    const maxsimDir = path.join(CLAUDE_DIR, 'maxsim');
    const result = spawnSync(
      'git',
      ['status', '--short', '--', maxsimDir],
      {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    );
    if (result.status !== 0) return false;
    return (result.stdout ?? '').trim().length > 0;
  } catch {
    return false;
  }
}

readStdinJson<StopInput>((input) => {
  const projectDir = input.cwd ?? process.cwd();

  if (hasUncommittedMaxsimChanges(projectDir)) {
    process.stdout.write(
      JSON.stringify({
        additionalContext:
          'Reminder: you have uncommitted MaxsimCLI changes in .claude/maxsim/. ' +
          'Consider running `git add .claude/maxsim && git commit -m "chore: sync maxsim config"` ' +
          'to keep your phase plans and config under version control.',
      }) + '\n',
    );
  }

  process.exit(0);
});
