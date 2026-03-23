/**
 * Stop hook — capture session learnings into agent memory.
 *
 * Behaviour:
 *  - Reads the Stop event JSON from stdin (includes cwd, session_id).
 *  - Checks if a MaxsimCLI project exists in cwd (.claude/maxsim/config.json).
 *  - If yes: reads the last 5 git commits to summarise what was done.
 *  - Appends a dated learning entry to .claude/agent-memory/maxsim-learner/MEMORY.md.
 *  - Creates the directory structure if it does not exist.
 *  - Always exits 0 — never blocks the user.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readStdinJson, CLAUDE_DIR } from './shared.js';

interface StopInput {
  cwd?: string;
  session_id?: string;
  stop_reason?: string;
  [key: string]: unknown;
}

/** Returns true when .claude/maxsim/config.json exists in the given directory. */
function isMaxsimProject(projectDir: string): boolean {
  try {
    return fs.existsSync(path.join(projectDir, CLAUDE_DIR, 'maxsim', 'config.json'));
  } catch {
    return false;
  }
}

/** Reads the last N git commits as oneline strings. Returns empty array on failure. */
function recentCommits(projectDir: string, n = 5): string[] {
  try {
    const result = spawnSync(
      'git',
      ['log', `--oneline`, `-${n}`],
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

/** Formats today's date as YYYY-MM-DD. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Appends a learning entry to the MEMORY.md file, creating dirs as needed. */
function appendLearning(memoryPath: string, sessionId: string | undefined, commits: string[]): void {
  const dir = path.dirname(memoryPath);
  fs.mkdirSync(dir, { recursive: true });

  const sessionLabel = sessionId ? ` (${sessionId.slice(0, 8)})` : '';
  const commitLines =
    commits.length > 0
      ? commits.map((c) => `- commit: ${c}`).join('\n')
      : '- no commits recorded this session';

  const entry = [
    `## Session ${today()}${sessionLabel}`,
    `- ${commits.length} commit(s) made this session`,
    commitLines,
    '',
  ].join('\n');

  fs.appendFileSync(memoryPath, `\n${entry}`, 'utf8');
}

readStdinJson<StopInput>((input) => {
  try {
    const projectDir = input.cwd ?? process.cwd();

    if (!isMaxsimProject(projectDir)) {
      process.exit(0);
    }

    const memoryPath = path.join(
      projectDir,
      CLAUDE_DIR,
      'agent-memory',
      'maxsim-learner',
      'MEMORY.md',
    );

    const commits = recentCommits(projectDir, 5);
    appendLearning(memoryPath, input.session_id, commits);
  } catch {
    // Never crash — always let the Stop event complete cleanly
  }

  process.exit(0);
});
