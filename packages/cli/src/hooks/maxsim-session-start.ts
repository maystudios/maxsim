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
import { spawnSync } from 'node:child_process';
import { readStdinJson, CLAUDE_DIR, isMaxsimProject, recentCommits, gitBranchAge, memoryFileSize } from './shared.js';

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

interface CIRun {
  name?: string;
  status?: string;
  conclusion?: string;
}

/**
 * Check CI status via gh CLI. Returns an array of failing run names,
 * or null if CI status cannot be determined (gh not installed, not a GitHub repo, etc.).
 * Never throws.
 */
function checkCIStatus(projectDir: string): string[] | null {
  try {
    const result = spawnSync(
      'gh',
      ['run', 'list', '--limit', '3', '--json', 'status,conclusion,name'],
      {
        cwd: projectDir,
        encoding: 'utf8',
        timeout: 8000,
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    );
    if (result.status !== 0) return null;
    const runs: CIRun[] = JSON.parse((result.stdout ?? '').trim());
    if (!Array.isArray(runs)) return null;
    const failing = runs
      .filter((r) => r.conclusion === 'failure' || r.conclusion === 'cancelled')
      .map((r) => r.name ?? 'unknown workflow');
    return failing.length > 0 ? failing : null;
  } catch {
    return null;
  }
}

/**
 * Detect declining metric trends from TSV data.
 * Returns true if 3+ consecutive negative deltas are found in any numeric column.
 * Never throws.
 */
function hasDeclineInMetrics(tsvContent: string): boolean {
  try {
    const lines = tsvContent.split('\n').filter(Boolean);
    if (lines.length < 4) return false;
    // Parse numeric values from the last column (metric value)
    const values: number[] = [];
    for (const line of lines) {
      const parts = line.split('\t');
      const lastVal = parseFloat(parts[parts.length - 1]);
      if (Number.isFinite(lastVal)) values.push(lastVal);
    }
    if (values.length < 4) return false;
    // Check for 3+ consecutive negative deltas
    let consecutiveDeclines = 0;
    for (let i = 1; i < values.length; i++) {
      if (values[i] < values[i - 1]) {
        consecutiveDeclines++;
        if (consecutiveDeclines >= 3) return true;
      } else {
        consecutiveDeclines = 0;
      }
    }
    return false;
  } catch {
    return false;
  }
}

readStdinJson<SessionStartInput>((input) => {
  try {
    const projectDir = input.cwd ?? process.cwd();

    if (!isMaxsimProject(projectDir)) {
      process.exit(0);
    }

    const sections: string[] = [];

    // --- P0: CI/CD failure detection (highest priority, goes first) ---
    try {
      const ciFailures = checkCIStatus(projectDir);
      if (ciFailures) {
        sections.push(
          '## CI/CD Failures Detected (P0)',
          `The following CI workflows are failing:\n${ciFailures.map((n) => `  - ${n}`).join('\n')}\n\nFix blockers first. Run \`/maxsim:fix-loop\` to auto-repair CI failures.`,
        );
      }
    } catch {
      // Silent failure -- CI check is best-effort
    }

    // Detect missing hooks and warn -- this hook works standalone even if
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

    // --- Context Freshness warnings ---
    try {
      const branchAge = gitBranchAge(projectDir);
      if (branchAge !== null && branchAge > 7) {
        sections.push(
          '## Context Freshness Warning',
          `Last commit on this branch was ${branchAge} days ago. Context may be stale.\nRun \`/maxsim:progress\` to review current project state before starting new work.`,
        );
      }

      const memSize = memoryFileSize(projectDir);
      if (memSize > 51200) {
        const sizeKB = Math.round(memSize / 1024);
        sections.push(
          '## Memory Size Warning',
          `MEMORY.md is ${sizeKB} KB (>${Math.round(51200 / 1024)} KB threshold). Consider pruning old entries to keep context injection efficient.`,
        );
      }
    } catch {
      // Silent failure -- context freshness is best-effort
    }

    // --- Proactive Suggestions for declining metrics ---
    try {
      if (tsvTail && hasDeclineInMetrics(tsvTail)) {
        sections.push(
          '## Proactive Suggestion: Declining Metrics',
          'Metric trends show 3+ consecutive declines. Consider running `/maxsim:improve` to investigate and optimize the regressing metric.',
        );
      }
    } catch {
      // Silent failure -- proactive suggestions are best-effort
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
