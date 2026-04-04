/**
 * Shared E2E test setup — helpers for environment checks, temp dirs, cleanup.
 *
 * E2E tests hit the real GitHub API and require:
 *   - `GITHUB_TOKEN` env var or `gh auth token` to be available
 *   - A real GitHub repo to operate against (detected from git remote)
 *
 * Token and remote detection is centralised in globalSetup.ts.
 * This module re-exports the combined check as CAN_RUN_E2E.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { hasGitHubToken, hasGitHubRemote } from './globalSetup.js';

// ── Environment Checks ───────────────────────────────────────────────

/** Combined check: both a token and a GitHub remote are present. */
export const CAN_RUN_E2E = hasGitHubToken() && hasGitHubRemote();

// ── Temp Directory Helpers ───────────────────────────────────────────

const E2E_TMP_PREFIX = 'maxsimcli-e2e-test-';

/** Create an isolated temp directory for an E2E test. */
export function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), E2E_TMP_PREFIX));
}

/** Remove a temp directory created by `createTempDir`. */
export function removeTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup; do not fail tests on cleanup errors.
  }
}

// ── Unique Name Generator ────────────────────────────────────────────

/**
 * Generate a unique, timestamped name for test resources.
 * Format: `maxsimcli-e2e-test-<suffix>-<timestamp>`
 */
export function uniqueName(suffix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${E2E_TMP_PREFIX}${suffix}-${ts}-${rand}`;
}

// ── GitHub Cleanup Helpers ───────────────────────────────────────────

/**
 * Delete a milestone by number using the Octokit instance.
 * Imported modules use getOctokit(), which requires a valid token.
 */
export async function deleteMilestone(
  owner: string,
  repo: string,
  milestoneNumber: number,
): Promise<void> {
  const { getOctokit } = await import('../../src/github/client.js');
  const octokit = getOctokit();
  try {
    await octokit.rest.issues.deleteMilestone({
      owner,
      repo,
      milestone_number: milestoneNumber,
    });
  } catch {
    // Ignore errors — milestone may already be deleted.
  }
}

/**
 * Delete a label by name.
 */
export async function deleteLabel(
  owner: string,
  repo: string,
  labelName: string,
): Promise<void> {
  const { getOctokit } = await import('../../src/github/client.js');
  const octokit = getOctokit();
  try {
    await octokit.rest.issues.deleteLabel({
      owner,
      repo,
      name: labelName,
    });
  } catch {
    // Ignore — label may already be gone.
  }
}

/**
 * Close and delete a GitHub issue (issues cannot truly be deleted via API,
 * so we close it with state_reason=not_planned as cleanup).
 */
export async function closeTestIssue(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<void> {
  const { getOctokit } = await import('../../src/github/client.js');
  const octokit = getOctokit();
  try {
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      state: 'closed',
      state_reason: 'not_planned',
    });
  } catch {
    // Ignore cleanup errors.
  }
}

/**
 * Delete a GitHub Project v2 by its node ID.
 */
export async function deleteProject(projectId: string): Promise<void> {
  const { ghExec } = await import('../../src/github/client.js');
  try {
    ghExec(['project', 'delete', '--id', projectId, '--yes']);
  } catch {
    // Ignore cleanup errors.
  }
}
