/**
 * TaskCompleted hook — run verification gates before allowing task completion.
 *
 * Behaviour:
 *  - Reads the TaskCompleted event JSON from stdin.
 *  - Detects the project's test/build/lint scripts from package.json.
 *  - Runs npm test, npm run build, npm run lint (if each exists).
 *  - If any gate fails: exits 2 with stderr containing the failure output.
 *  - If all gates pass: exits 0 (allow completion).
 *  - Always handles errors gracefully — never crashes.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readStdinJson } from './shared.js';

interface TaskCompletedInput {
  task_id?: string;
  task_subject?: string;
  task_description?: string;
  teammate_name?: string;
  team_name?: string;
  cwd?: string;
  [key: string]: unknown;
}

interface PackageJson {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

/** Read package.json scripts from a directory. Returns null if not found. */
function readPackageScripts(projectDir: string): Record<string, string> | null {
  try {
    const pkgPath = path.join(projectDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as PackageJson;
    return pkg.scripts ?? null;
  } catch {
    return null;
  }
}

interface GateResult {
  name: string;
  passed: boolean;
  output: string;
}

/** Run a single verification gate. Returns the result. */
function runGate(name: string, command: string, args: string[], projectDir: string): GateResult {
  try {
    const result = spawnSync(command, args, {
      cwd: projectDir,
      encoding: 'utf8',
      timeout: 120_000, // 2 minute timeout per gate
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      shell: true,
    });

    const output = [result.stdout ?? '', result.stderr ?? ''].join('\n').trim();

    return {
      name,
      passed: result.status === 0,
      output,
    };
  } catch (err) {
    return {
      name,
      passed: false,
      output: `Gate "${name}" threw an error: ${String(err)}`,
    };
  }
}

readStdinJson<TaskCompletedInput>((input) => {
  try {
    const projectDir = input.cwd ?? process.cwd();
    const scripts = readPackageScripts(projectDir);
    const failures: GateResult[] = [];

    // Gate 1: npm test (detect test runner)
    if (scripts?.test) {
      const result = runGate('test', 'npm', ['test'], projectDir);
      if (!result.passed) failures.push(result);
    }

    // Gate 2: npm run build (if build script exists)
    if (scripts?.build) {
      const result = runGate('build', 'npm', ['run', 'build'], projectDir);
      if (!result.passed) failures.push(result);
    }

    // Gate 3: npm run lint (if lint script exists)
    if (scripts?.lint) {
      const result = runGate('lint', 'npm', ['run', 'lint'], projectDir);
      if (!result.passed) failures.push(result);
    }

    if (failures.length > 0) {
      const report = failures
        .map((f) => `=== ${f.name} FAILED ===\n${f.output}`)
        .join('\n\n');
      process.stderr.write(`${report}\n`);
      process.exit(2);
    }
  } catch {
    // Never crash — allow completion on unexpected error
  }

  process.exit(0);
});
