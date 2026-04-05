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

/**
 * Output formats:
 * - Exit 0: Allow task completion (all gates passed)
 * - Exit 2 + stderr: Block completion — gates failed, agent must fix before completing
 * - JSON stdout { continue: false, stopReason: "..." } + exit 0: Stop the teammate entirely
 *
 * Currently uses exit 2 (block + report) when test/build/lint gates fail.
 * Use stopTeammate() from shared.ts for permanent stop scenarios.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readStdinJson } from './shared.js';
import { REQUIRED_EVIDENCE_MARKERS, validateCompletionClaim } from './validation.js';

/** Verification profile types matching VerificationProfile in types.ts. */
type VerificationProfileValue = 'strict' | 'standard' | 'fast';

/** Gate names that can be resolved based on verification profile. */
type GateName = 'test' | 'build' | 'lint' | 'spec_compliance';

/**
 * Read the verification_profile from .claude/maxsim/config.json.
 * Falls back to 'standard' if config cannot be read or field is missing.
 */
function readVerificationProfile(projectDir: string): VerificationProfileValue {
  try {
    const configPath = path.join(projectDir, '.claude', 'maxsim', 'config.json');
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw) as {
      execution?: { verification?: { verification_profile?: string } };
    };
    const profile = config?.execution?.verification?.verification_profile;
    if (profile === 'strict' || profile === 'standard' || profile === 'fast') {
      return profile;
    }
  } catch {
    // Config not found or invalid — use default
  }
  return 'standard';
}

/**
 * Resolve which gates to run based on the verification profile.
 *
 * - strict: test + build + lint + spec_compliance (all gates)
 * - standard: test + build + lint + spec_compliance (same as strict; difference
 *   is in code review which is handled by the workflow, not the hook)
 * - fast: test + build only (skip lint and spec_compliance)
 */
function resolveGates(profile: VerificationProfileValue): GateName[] {
  switch (profile) {
    case 'strict':
    case 'standard':
      return ['test', 'build', 'lint', 'spec_compliance'];
    case 'fast':
      return ['test', 'build'];
    default:
      return ['test', 'build', 'lint', 'spec_compliance'];
  }
}

interface TaskCompletedInput {
  task_id?: string;
  task_subject?: string;
  task_description?: string;
  task_context?: string;
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
    const profile = readVerificationProfile(projectDir);
    const gates = resolveGates(profile);

    // Gate: npm test (detect test runner)
    if (gates.includes('test') && scripts?.test) {
      const result = runGate('test', 'npm', ['test'], projectDir);
      if (!result.passed) failures.push(result);
    }

    // Gate: npm run build (if build script exists)
    if (gates.includes('build') && scripts?.build) {
      const result = runGate('build', 'npm', ['run', 'build'], projectDir);
      if (!result.passed) failures.push(result);
    }

    // Gate: npm run lint (if lint script exists)
    if (gates.includes('lint') && scripts?.lint) {
      const result = runGate('lint', 'npm', ['run', 'lint'], projectDir);
      if (!result.passed) failures.push(result);
    }

    // Gate: spec compliance (evidence blocks + forbidden phrases)
    // Skipped when verification_profile is 'fast'.
    if (gates.includes('spec_compliance')) {
      // Collect ALL available text fields from the payload — not just task_description.
      // An agent could route its output through any field, so we check them all.
      const textSources: Record<string, string | undefined | null> = {
        task_description: input.task_description as string | undefined,
        task_context: input.task_context as string | undefined,
        task_subject: input.task_subject as string | undefined,
      };
      // Also scan any unknown string fields in the payload (future-proofing).
      for (const [key, value] of Object.entries(input)) {
        if (typeof value === 'string' && !(key in textSources) && key !== 'task_id' && key !== 'cwd') {
          textSources[key] = value;
        }
      }
      const complianceResult = validateCompletionClaim(textSources);

      // If at least one source had content but evidence is missing, block completion.
      if (!complianceResult.passed && complianceResult.sourcesChecked.length > 0) {
        const markerList = REQUIRED_EVIDENCE_MARKERS.map((m) => m.replace(':', '')).join(', ');
        const actionableHint =
          `Task completion blocked: No valid evidence block found.\n` +
          `Required markers: ${markerList}.\n` +
          `Include these in your task completion notes.\n` +
          `Fields checked: ${complianceResult.sourcesChecked.join(', ')}`;
        failures.push({
          name: 'spec_compliance',
          passed: false,
          output: [actionableHint, ...complianceResult.issues].join('\n'),
        });
      }
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
