/**
 * statusLine hook — display a brief MaxsimCLI status string in the terminal
 * status bar.
 *
 * Output contract (Claude Code statusLine):
 *   Process must write a single line of plain text (or JSON with a "text" key)
 *   to stdout and exit 0.  The output should be short (<80 chars).
 *
 * Performance target: <100 ms — local file reads only, no network calls.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdinJson, CLAUDE_DIR } from './shared.js';

interface StatusLineInput {
  cwd?: string;
  session_id?: string;
  [key: string]: unknown;
}

interface MaxsimConfig {
  currentPhase?: number;
  projectStatus?: string;
  [key: string]: unknown;
}

/** Resolve the project directory from the hook input or fall back to cwd. */
function resolveProjectDir(input: StatusLineInput): string {
  return input.cwd ?? process.cwd();
}

/** Read the maxsim config.json; returns null if absent or unreadable. */
function readMaxsimConfig(projectDir: string): MaxsimConfig | null {
  const configPath = path.join(projectDir, CLAUDE_DIR, 'maxsim', 'config.json');
  try {
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as MaxsimConfig;
  } catch {
    return null;
  }
}

readStdinJson<StatusLineInput>((input) => {
  const projectDir = resolveProjectDir(input);
  const config = readMaxsimConfig(projectDir);

  let statusText: string;

  if (config !== null) {
    const phase = typeof config.currentPhase === 'number' ? config.currentPhase : null;
    const status = typeof config.projectStatus === 'string' ? config.projectStatus : 'In Progress';

    if (phase !== null) {
      statusText = `MAXSIM \u25ba Phase ${phase} | ${status}`;
    } else {
      statusText = `MAXSIM \u25ba ${status}`;
    }
  } else {
    statusText = 'MAXSIM \u25ba Ready';
  }

  process.stdout.write(`${statusText}\n`);
  process.exit(0);
});
