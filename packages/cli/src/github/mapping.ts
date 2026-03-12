/**
 * GitHub Issue Mapping — Local performance cache
 *
 * IMPORTANT: This file (.planning/github-issues.json) is a CACHE that can be
 * rebuilt from GitHub Issues at any time via rebuildMappingFromGitHub().
 * GitHub Issues are the single source of truth (ARCH-01).
 *
 * Manages the `.planning/github-issues.json` file that maps MAXSIM tasks/todos
 * to their corresponding GitHub issue numbers, internal IDs, and project item IDs.
 *
 * All file operations use synchronous fs (matching the pattern in existing core modules).
 * Uses planningPath() from core to construct file paths.
 *
 * CRITICAL: Never call process.exit() — throw or return null instead.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

import { planningPath } from '../core/core.js';
import type { GhResult, IssueMappingFile, PhaseMapping, TaskIssueMapping } from './types.js';
import { getOctokit, getRepoInfo, withGhResult } from './client.js';

// ---- Constants -------------------------------------------------------------

const MAPPING_FILENAME = 'github-issues.json';

// ---- Helpers ---------------------------------------------------------------

/**
 * Get the absolute path to `.planning/github-issues.json` for a given cwd.
 */
function mappingFilePath(cwd: string): string {
  return planningPath(cwd, MAPPING_FILENAME);
}

/**
 * Compute a SHA-256 hash of an issue body string.
 * Used for external edit detection (WIRE-06).
 */
export function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

/**
 * Update the body_hash for a specific phase in the mapping cache.
 *
 * Load-modify-save pattern. Throws if mapping file does not exist.
 */
export function updatePhaseBodyHash(cwd: string, phaseNum: string, bodyHash: string): void {
  const mapping = loadMapping(cwd);
  if (!mapping) {
    throw new Error('github-issues.json does not exist. Run project setup first.');
  }

  if (!mapping.phases[phaseNum]) {
    throw new Error(`Phase ${phaseNum} not found in mapping file.`);
  }

  mapping.phases[phaseNum].body_hash = bodyHash;
  saveMapping(cwd, mapping);
}

// ---- Public API: Local file I/O --------------------------------------------

/**
 * Load and parse the mapping file (local cache).
 *
 * Returns null if the file does not exist.
 * Throws on malformed JSON or invalid structure (missing required fields).
 */
export function loadMapping(cwd: string): IssueMappingFile | null {
  const filePath = mappingFilePath(cwd);

  try {
    fs.statSync(filePath);
  } catch {
    return null;
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  // Validate basic structure — must have repo
  if (typeof parsed.repo !== 'string') {
    throw new Error(
      `Invalid github-issues.json: missing required field 'repo' (string)`,
    );
  }

  return parsed as unknown as IssueMappingFile;
}

/**
 * Write the mapping file to `.planning/github-issues.json`.
 *
 * Creates the `.planning/` directory if it does not exist.
 * Writes with 2-space indent for readability and diff-friendliness.
 */
export function saveMapping(cwd: string, mapping: IssueMappingFile): void {
  const filePath = mappingFilePath(cwd);
  const dir = path.dirname(filePath);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(mapping, null, 2) + '\n', 'utf-8');
}

/**
 * Update a specific task's issue mapping within a phase.
 *
 * Load-modify-save pattern. Creates phase entry if it does not exist.
 * Merges partial data with existing entry (if any).
 *
 * @throws If mapping file does not exist (must be initialized first via saveMapping)
 */
export function updateTaskMapping(
  cwd: string,
  phaseNum: string,
  taskId: string,
  data: Partial<TaskIssueMapping>,
): void {
  const mapping = loadMapping(cwd);
  if (!mapping) {
    throw new Error('github-issues.json does not exist. Run project setup first.');
  }

  // Create phase entry if missing
  if (!mapping.phases[phaseNum]) {
    mapping.phases[phaseNum] = {
      tracking_issue: { number: 0, id: 0, node_id: '', item_id: '', status: 'To Do' },
      plan: '',
      tasks: {},
    } satisfies PhaseMapping;
  }

  // Merge with existing task data (if any)
  const existing = mapping.phases[phaseNum].tasks[taskId];
  const defaults: TaskIssueMapping = { number: 0, id: 0, node_id: '', item_id: '', status: 'To Do' };
  mapping.phases[phaseNum].tasks[taskId] = Object.assign(defaults, existing, data);

  saveMapping(cwd, mapping);
}


/**
 * Create a properly typed empty mapping object with sensible defaults.
 *
 * Used during initial project setup to create the mapping file.
 */
export function createEmptyMapping(repo: string): IssueMappingFile {
  return {
    project_number: 0,
    project_id: '',
    repo,
    status_field_id: '',
    status_options: {},
    estimate_field_id: '',
    milestone_id: 0,
    milestone_title: '',
    labels: {},
    phases: {},
  };
}

/**
 * Quick lookup: get the issue mapping for a specific task in a phase.
 *
 * Returns null if the mapping file, phase, or task does not exist.
 */
export function getIssueForTask(
  cwd: string,
  phaseNum: string,
  taskId: string,
): TaskIssueMapping | null {
  const mapping = loadMapping(cwd);
  if (!mapping) return null;

  const phase = mapping.phases[phaseNum];
  if (!phase) return null;

  return phase.tasks[taskId] ?? null;
}

// ---- Rebuild from GitHub (cache rebuild) ------------------------------------

/**
 * Rebuild the mapping cache from GitHub Issues.
 *
 * This function is the escape hatch: if the local cache is lost, stale, or
 * corrupted, it can always be rebuilt from GitHub (the single source of truth).
 *
 * Strategy:
 * 1. List all Issues with label 'phase' using Octokit pagination
 * 2. For each phase issue, list its sub-issues
 * 3. Reconstruct the mapping from GitHub state
 * 4. Save to disk and return
 *
 * @param cwd - The project root directory
 * @returns The rebuilt mapping file
 */
export async function rebuildMappingFromGitHub(
  cwd: string,
): Promise<GhResult<IssueMappingFile>> {
  return withGhResult(async () => {
    const octokit = getOctokit();
    const { owner, repo } = await getRepoInfo();

    // Start with the existing mapping if available (to preserve project board info)
    // or create an empty one
    const existing = loadMapping(cwd);
    const mapping = existing ?? createEmptyMapping(`${owner}/${repo}`);

    // Clear existing phase mappings — we're rebuilding from scratch
    mapping.phases = {};
    mapping.repo = `${owner}/${repo}`;

    // List all issues with the 'phase' label using pagination
    const phaseIssues = await octokit.paginate(octokit.rest.issues.listForRepo, {
      owner,
      repo,
      labels: 'phase',
      state: 'all',
      per_page: 100,
    });

    for (const phaseIssue of phaseIssues) {
      // Extract phase number from title: "[Phase XX] Name"
      const titleMatch = phaseIssue.title.match(/^\[Phase\s+(\S+)\]/);
      if (!titleMatch) continue;

      const phaseNum = titleMatch[1];

      // Create phase mapping entry
      const phaseMapping: PhaseMapping = {
        tracking_issue: {
          number: phaseIssue.number,
          id: phaseIssue.id,
          node_id: phaseIssue.node_id ?? '',
          item_id: '',
          status: phaseIssue.state === 'closed' ? 'Done' : 'To Do',
        },
        plan: '',
        tasks: {},
      };

      // List sub-issues for this phase issue
      try {
        const subIssues = await (octokit.rest.issues as any).listSubIssues({
          owner,
          repo,
          issue_number: phaseIssue.number,
        });

        for (const subIssue of subIssues.data as any[]) {
          // Extract task ID from title: "[PXX] Title" — use the issue number as key
          const taskTitleMatch = (subIssue.title as string).match(/^\[P\S+\]\s/);
          const taskKey = taskTitleMatch
            ? `task-${subIssue.number}`
            : `issue-${subIssue.number}`;

          phaseMapping.tasks[taskKey] = {
            number: subIssue.number as number,
            id: subIssue.id as number,
            node_id: (subIssue.node_id as string) ?? '',
            item_id: '',
            status: (subIssue.state as string) === 'closed' ? 'Done' : 'To Do',
          };
        }
      } catch {
        // Sub-issues API may not be available — continue without sub-issues
      }

      mapping.phases[phaseNum] = phaseMapping;
    }

    // Save the rebuilt mapping to disk
    saveMapping(cwd, mapping);

    return mapping;
  });
}
