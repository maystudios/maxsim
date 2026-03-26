/**
 * SessionStart hook — inject orientation context at session start/resume/compact.
 *
 * Behaviour:
 *  - Reads the SessionStart event JSON from stdin.
 *  - Gathers recent git history (20 commits) for instant orientation.
 *  - Reads the first 200 lines of MEMORY.md (learned patterns).
 *  - Reads the last 10 lines of autoresearch-results.tsv (metric trends).
 *  - Detects whether other MaxsimCLI hooks are registered and warns if not.
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

/**
 * Check whether other expected MaxsimCLI hooks are registered in settings.json.
 * Returns a list of missing hook event names, or an empty array if all are present.
 * Never throws — returns empty array on any error.
 */
function detectMissingHooks(projectDir: string): string[] {
  try {
    const settingsPath = path.join(projectDir, CLAUDE_DIR, 'settings.json');
    if (!fs.existsSync(settingsPath)) return ['(settings.json missing)'];

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const hooks = settings?.hooks;
    if (!hooks || typeof hooks !== 'object') return ['(hooks section missing)'];

    // Expected hook events that installHooks() registers
    const expectedEvents: Array<{ event: string; scriptName: string }> = [
      { event: 'Notification', scriptName: 'maxsim-notification-sound' },
      { event: 'Stop', scriptName: 'maxsim-stop-sound' },
      { event: 'Stop', scriptName: 'maxsim-capture-learnings' },
      { event: 'TeammateIdle', scriptName: 'maxsim-teammate-idle' },
      { event: 'TaskCompleted', scriptName: 'maxsim-task-completed' },
    ];

    const missing: string[] = [];
    for (const { event, scriptName } of expectedEvents) {
      const matchers = hooks[event];
      if (!Array.isArray(matchers)) {
        missing.push(`${event}/${scriptName}`);
        continue;
      }
      const found = matchers.some((m: { hooks?: Array<{ command?: string }> }) =>
        m.hooks?.some((h) => h.command?.includes(scriptName)),
      );
      if (!found) {
        missing.push(`${event}/${scriptName}`);
      }
    }

    return missing;
  } catch {
    return [];
  }
}

readStdinJson<SessionStartInput>((input) => {
  try {
    const projectDir = input.cwd ?? process.cwd();

    if (!isMaxsimProject(projectDir)) {
      process.exit(0);
    }

    const sections: string[] = [];

    // Detect missing hooks and warn — this hook works standalone even if
    // others are not registered, but the user should know about it.
    const missingHooks = detectMissingHooks(projectDir);
    if (missingHooks.length > 0) {
      sections.push(
        '## Warning: Missing MaxsimCLI Hooks',
        `The following MaxsimCLI hooks are not registered in .claude/settings.json:\n${missingHooks.map((h) => `  - ${h}`).join('\n')}\n\nRe-run \`npx maxsimcli\` to restore all hooks, or see .claude/maxsim/templates/settings-reference.json for the expected configuration.`,
      );
    }

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
