/**
 * TeammateIdle hook — check for pending tasks before allowing teammate to go idle.
 *
 * Behaviour:
 *  - Reads the TeammateIdle event JSON from stdin.
 *  - Checks if there are pending tasks in ~/.claude/tasks/{team_name}/ directory.
 *  - If pending tasks exist: exits 2 with stderr "Pick up the next available task."
 *  - If no pending tasks: exits 0 (allow idle).
 *  - Always handles errors gracefully — never crashes.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { readStdinJson } from './shared.js';

interface TeammateIdleInput {
  teammate_name?: string;
  team_name?: string;
  session_id?: string;
  cwd?: string;
  [key: string]: unknown;
}

/** Check if a directory has any files (non-recursively). */
function hasPendingTasks(tasksDir: string): boolean {
  try {
    const entries = fs.readdirSync(tasksDir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

readStdinJson<TeammateIdleInput>((input) => {
  try {
    const teamName = input.team_name;
    if (!teamName) {
      // No team context — allow idle
      process.exit(0);
    }

    const tasksDir = path.join(os.homedir(), '.claude', 'tasks', teamName);

    if (hasPendingTasks(tasksDir)) {
      process.stderr.write('Pick up the next available task.\n');
      process.exit(2);
    }
  } catch {
    // Never crash — allow idle on error
  }

  process.exit(0);
});
