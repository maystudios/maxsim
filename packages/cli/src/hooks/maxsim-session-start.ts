/**
 * SessionStart hook — inject orientation context at session start/resume/compact.
 *
 * Behaviour:
 *  - Reads the SessionStart event JSON from stdin.
 *  - Gathers recent git history (20 commits) for instant orientation.
 *  - Reads the first 200 lines of MEMORY.md (learned patterns).
 *  - Reads the last 10 lines of autoresearch-results.tsv (metric trends).
 *  - Outputs all collected context to stdout for injection into Claude's context.
 *  - Always exits 0 — never blocks the user's session.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdinJson, CLAUDE_DIR, isMaxsimProject, recentCommits } from './shared.js';

interface SessionStartInput {
  session_id?: string;
  cwd?: string;
  [key: string]: unknown;
}

/** Reads the first N lines of a file. Returns empty string on any failure. */
function readFirstLines(filePath: string, maxLines: number): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').slice(0, maxLines);
    return lines.join('\n').trim();
  } catch {
    return '';
  }
}

/** Reads the last N non-empty lines of a file. Returns empty string on any failure. */
function readLastLines(filePath: string, maxLines: number): string {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-maxLines).join('\n').trim();
  } catch {
    return '';
  }
}

readStdinJson<SessionStartInput>((input) => {
  try {
    const projectDir = input.cwd ?? process.cwd();

    if (!isMaxsimProject(projectDir)) {
      process.exit(0);
    }

    const sections: string[] = [];

    const commits = recentCommits(projectDir, 20);
    if (commits.length > 0) {
      sections.push(
        '## Recent Git History',
        commits.map((c) => `  ${c}`).join('\n'),
      );
    }

    const memoryPath = path.join(
      projectDir,
      CLAUDE_DIR,
      'agent-memory',
      'maxsim-learner',
      'MEMORY.md',
    );
    const memoryContent = readFirstLines(memoryPath, 200);
    if (memoryContent) {
      sections.push(
        '## Learned Patterns (MEMORY.md)',
        memoryContent,
      );
    }

    const tsvPath = path.join(
      projectDir,
      CLAUDE_DIR,
      'agent-memory',
      'maxsim-learner',
      'autoresearch-results.tsv',
    );
    const tsvTail = readLastLines(tsvPath, 10);
    if (tsvTail) {
      sections.push(
        '## Metric Trends (autoresearch-results.tsv)',
        tsvTail,
      );
    }

    if (sections.length > 0) {
      process.stdout.write(
        `${JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'SessionStart',
            additionalContext: sections.join('\n\n'),
          },
        })}\n`,
      );
    }
  } catch {
    // Never crash — always let the session start cleanly
  }

  process.exit(0);
});
