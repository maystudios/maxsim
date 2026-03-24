/**
 * Stop hook — capture session learnings into agent memory.
 *
 * Behaviour:
 *  - Reads the Stop event JSON from stdin (includes cwd, session_id, etc.).
 *  - Checks if a MaxsimCLI project exists in cwd (.claude/maxsim/config.json).
 *  - If yes: reads git commits made this session (or last 5 as fallback).
 *  - Extracts a brief summary from last_assistant_message if provided.
 *  - Appends a dated learning entry to .claude/agent-memory/maxsim-learner/MEMORY.md.
 *  - Prunes MEMORY.md to 180 lines to stay under Claude Code's 200-line limit.
 *  - Creates the directory structure if it does not exist.
 *  - Always exits 0 — never blocks the user.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readStdinJson, CLAUDE_DIR, isMaxsimProject, recentCommits } from './shared.js';

interface StopInput {
  cwd?: string;
  session_id?: string;
  stop_reason?: string;
  stop_hook_active?: boolean;
  last_assistant_message?: string;
  session_start_commit?: string;
  [key: string]: unknown;
}

export const MEMORY_MAX_LINES = 180;

/** Formats today's date as YYYY-MM-DD. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns commits made since session_start_commit using git log range.
 * Falls back to recentCommits(projectDir, 5) if the range returns nothing or fails.
 */
export function sessionCommits(projectDir: string, sessionStartCommit: string): string[] {
  try {
    const result = spawnSync(
      'git',
      ['log', '--oneline', `${sessionStartCommit}..HEAD`],
      {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 4000,
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    );
    if (result.status !== 0) return recentCommits(projectDir, 5);
    const lines = (result.stdout ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : recentCommits(projectDir, 5);
  } catch {
    return recentCommits(projectDir, 5);
  }
}

/**
 * Prunes the MEMORY.md file to at most MEMORY_MAX_LINES lines,
 * removing oldest lines from the top.
 */
export function pruneMemory(memoryPath: string): void {
  try {
    const content = fs.readFileSync(memoryPath, 'utf8');
    const lines = content.split('\n');
    if (lines.length > MEMORY_MAX_LINES) {
      const trimmed = lines.slice(lines.length - MEMORY_MAX_LINES).join('\n');
      fs.writeFileSync(memoryPath, trimmed, 'utf8');
    }
  } catch {
    // silently skip — pruning is best-effort
  }
}

/** Appends a learning entry to the MEMORY.md file, creating dirs as needed. */
export function appendLearning(
  memoryPath: string,
  sessionId: string | undefined,
  commits: string[],
  stopReason: string | undefined,
  patternSummary: string | undefined,
): void {
  const dir = path.dirname(memoryPath);
  fs.mkdirSync(dir, { recursive: true });

  const sessionLabel = sessionId ? ` (${sessionId.slice(0, 8)})` : '';
  const reasonLabel = stopReason ? ` [${stopReason}]` : '';

  const commitLines =
    commits.length > 0
      ? commits.map((c) => `- commit: ${c}`).join('\n')
      : '- no commits recorded this session';

  const parts = [
    `## Session ${today()}${sessionLabel}${reasonLabel}`,
    `- ${commits.length} commit(s) made this session`,
    commitLines,
  ];

  if (patternSummary) {
    parts.push(`- pattern: ${patternSummary}`);
  }

  parts.push('');

  const entry = parts.join('\n');
  fs.appendFileSync(memoryPath, `\n${entry}`, 'utf8');
}

readStdinJson<StopInput>((input) => {
  // Prevent infinite loops if this hook triggers another stop event
  if (input.stop_hook_active === true) {
    process.exit(0);
  }

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

    const commits = input.session_start_commit
      ? sessionCommits(projectDir, input.session_start_commit)
      : recentCommits(projectDir, 5);

    const trimmedMessage = input.last_assistant_message?.trim();
    const patternSummary = trimmedMessage ? trimmedMessage.slice(0, 200) : undefined;

    appendLearning(memoryPath, input.session_id, commits, input.stop_reason, patternSummary);
    pruneMemory(memoryPath);
  } catch {
    // Never crash — always let the Stop event complete cleanly
  }

  process.exit(0);
});
