/**
 * GitHub Projects v2 — Board management via `gh` CLI
 *
 * Manages GitHub Projects v2 boards for MAXSIM task tracking.
 * Uses `gh project` CLI commands which internally handle the GraphQL API.
 *
 * One project board per repo (not per milestone). 4 columns:
 * To Do, In Progress, In Review, Done.
 *
 * CRITICAL: Never call process.exit() — return GhResult instead.
 */

import { execFileSync } from 'node:child_process';

import { getRepoInfo, withGhResult } from './client.js';
import type { GhResult, IssueStatus } from './types.js';
import { DEFAULT_STATUS_OPTIONS } from './types.js';

// ---- Helpers ---------------------------------------------------------------

/**
 * Run a `gh` CLI command and parse JSON output.
 * Throws on non-zero exit or invalid JSON.
 */
function ghJson<T>(args: string[], timeout = 30_000): T {
  const out = execFileSync('gh', args, {
    timeout,
    stdio: 'pipe',
    encoding: 'utf-8',
  }).trim();
  return JSON.parse(out) as T;
}

/**
 * Run a `gh` CLI command, ignoring output.
 * Throws on non-zero exit.
 */
function ghExec(args: string[], timeout = 30_000): void {
  execFileSync('gh', args, {
    timeout,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
}

// ---- Status field option ID cache ------------------------------------------

interface StatusFieldCache {
  fieldId: string;        // node_id of the Status field
  projectId: string;      // node_id of the project
  options: Map<string, string>; // option name -> option node_id
}

let _statusFieldCache: StatusFieldCache | null = null;

// ---- gh project JSON response types ----------------------------------------

interface GhProject {
  number: number;
  title: string;
  id: string; // node_id (PVT_...)
}

interface GhFieldOption {
  id: string; // node_id
  name: string;
}

interface GhField {
  id: string; // node_id (PVTF_... or PVTSSF_...)
  name: string;
  type: string;
  options?: GhFieldOption[];
}

interface GhProjectItem {
  id: string; // node_id (PVTI_...)
  content?: {
    number?: number;
    type?: string;
    repository?: string;
    title?: string;
    url?: string;
  };
  // gh project item-list includes field values as top-level keys
  status?: string;
  // Some gh versions use fieldValues
  fieldValues?: { nodes?: Array<{ field?: { name: string }; name?: string }> };
}

// ---- Project Board Creation ------------------------------------------------

/**
 * Ensure a project board exists with the given title, creating it if needed.
 *
 * 1. List existing projects via `gh project list`
 * 2. If not found, create via `gh project create`
 * 3. Load status field info and cache it
 *
 * Returns the project number and node ID.
 */
export async function ensureProjectBoard(
  title: string,
): Promise<GhResult<{ projectNumber: number; projectId: string }>> {
  return withGhResult(async () => {
    const { owner } = await getRepoInfo();

    // List existing projects to check if one with the title already exists
    let existingProject: GhProject | undefined;

    try {
      const result = ghJson<{ projects: GhProject[] }>(
        ['project', 'list', '--owner', owner, '--format', 'json', '--limit', '100'],
      );
      existingProject = result.projects?.find(p => p.title === title);
    } catch {
      // gh project list may fail for various reasons; try @me as fallback
      try {
        const result = ghJson<{ projects: GhProject[] }>(
          ['project', 'list', '--owner', '@me', '--format', 'json', '--limit', '100'],
        );
        existingProject = result.projects?.find(p => p.title === title);
      } catch {
        // Unable to list projects — will attempt to create
      }
    }

    if (existingProject) {
      await loadStatusFieldCache(owner, existingProject.number, existingProject.id);
      return {
        projectNumber: existingProject.number,
        projectId: existingProject.id,
      };
    }

    // No matching project found — create one
    let created: { number: number; id: string };
    try {
      created = ghJson<{ number: number; id: string }>(
        ['project', 'create', '--owner', '@me', '--title', title, '--format', 'json'],
      );
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      throw new Error(`Failed to create project board: ${err.stderr || err.message}`);
    }

    await loadStatusFieldCache(owner, created.number, created.id);

    return {
      projectNumber: created.number,
      projectId: created.id,
    };
  });
}

/**
 * Load the project's Status field info into the module-level cache.
 * Uses `gh project field-list` to enumerate fields and their options.
 */
async function loadStatusFieldCache(
  owner: string,
  projectNumber: number,
  projectId: string,
): Promise<void> {
  let fields: GhField[];

  try {
    const result = ghJson<{ fields: GhField[] }>(
      ['project', 'field-list', String(projectNumber), '--owner', owner, '--format', 'json'],
    );
    fields = result.fields ?? [];
  } catch {
    // Fallback: try with @me
    try {
      const result = ghJson<{ fields: GhField[] }>(
        ['project', 'field-list', String(projectNumber), '--owner', '@me', '--format', 'json'],
      );
      fields = result.fields ?? [];
    } catch {
      throw new Error('Failed to list project fields via gh CLI');
    }
  }

  // Find the Status field (SingleSelect type)
  const statusField = fields.find(
    f => f.name === 'Status' && (
      f.type === 'ProjectV2SingleSelectField' ||
      f.type === 'single_select' ||
      f.type === 'SINGLE_SELECT'
    ),
  );

  if (!statusField) {
    throw new Error(
      'Status field not found on project board. This is unexpected for a Projects v2 board.',
    );
  }

  // Build option map from existing options
  const optionMap = new Map<string, string>();
  if (statusField.options) {
    for (const opt of statusField.options) {
      optionMap.set(opt.name, opt.id);
    }
  }

  // GitHub defaults may use "Todo" instead of "To Do" — normalize
  if (optionMap.has('Todo') && !optionMap.has('To Do')) {
    optionMap.set('To Do', optionMap.get('Todo')!);
  }

  // Check for missing required options — log warning but don't fail
  const missingOptions = DEFAULT_STATUS_OPTIONS.filter(opt => !optionMap.has(opt));
  if (missingOptions.length > 0) {
    // GitHub Projects v2 boards come with "Todo", "In Progress", "Done" by default.
    // "In Review" typically needs to be added manually by the user.
    // There is no gh CLI command to add a single-select option to an existing field.
    // We log the missing options but proceed — the user can add them via the GitHub UI.
    const debugLog = process.env.MAXSIM_DEBUG
      ? (msg: string) => process.stderr.write(`[maxsim:debug] ${msg}\n`)
      : () => {};
    debugLog(`Missing status options on project board: ${missingOptions.join(', ')}. Add them manually in the GitHub Projects settings.`);
  }

  _statusFieldCache = {
    fieldId: statusField.id,
    projectId,
    options: optionMap,
  };
}

// ---- Add Item to Project ---------------------------------------------------

/**
 * Add an issue to the project board.
 *
 * Uses `gh project item-add` to add an issue by its URL.
 *
 * @param projectNumber - The project number
 * @param issueNumber - The issue number to add to the project
 * @returns The project item ID (node_id)
 */
export async function addItemToProject(
  projectNumber: number,
  issueNumber: number,
): Promise<GhResult<{ itemId: string }>> {
  return withGhResult(async () => {
    const { owner, repo } = await getRepoInfo();

    // Construct the issue URL for gh project item-add
    const issueUrl = `https://github.com/${owner}/${repo}/issues/${issueNumber}`;

    let result: { id: string };
    try {
      result = ghJson<{ id: string }>(
        [
          'project', 'item-add', String(projectNumber),
          '--owner', owner,
          '--url', issueUrl,
          '--format', 'json',
        ],
      );
    } catch {
      // Fallback: try with @me as owner
      result = ghJson<{ id: string }>(
        [
          'project', 'item-add', String(projectNumber),
          '--owner', '@me',
          '--url', issueUrl,
          '--format', 'json',
        ],
      );
    }

    return { itemId: result.id };
  });
}

// ---- Move Item to Status ---------------------------------------------------

/**
 * Update the Status field of a project item to the given column.
 *
 * Uses `gh project item-edit` with the cached field and option IDs.
 *
 * @param projectNumber - The project number
 * @param itemId - The project item ID (node_id string)
 * @param status - The target status column
 */
export async function moveItemToStatus(
  projectNumber: number,
  itemId: string,
  status: IssueStatus,
): Promise<GhResult<void>> {
  return withGhResult(async () => {
    const { owner } = await getRepoInfo();

    // Ensure we have cached status field info
    if (!_statusFieldCache) {
      // Need to load field cache — fetch project ID first
      const result = ghJson<{ projects: GhProject[] }>(
        ['project', 'list', '--owner', owner, '--format', 'json', '--limit', '100'],
      );
      const project = result.projects?.find(p => p.number === projectNumber);
      if (!project) {
        throw new Error(`Project #${projectNumber} not found`);
      }
      await loadStatusFieldCache(owner, projectNumber, project.id);
    }

    if (!_statusFieldCache) {
      throw new Error('Failed to load status field information for project board');
    }

    const optionId = _statusFieldCache.options.get(status);
    if (!optionId) {
      throw new Error(
        `Status option "${status}" not found on project board. Available: ${Array.from(_statusFieldCache.options.keys()).join(', ')}`,
      );
    }

    // gh project item-edit uses node_ids for --project-id, --id, --field-id, --single-select-option-id
    // If itemId is empty or looks like a legacy numeric ID, we can't proceed
    if (!itemId) {
      throw new Error('Cannot move item: empty item_id. The issue may not have been added to the project board.');
    }

    try {
      ghExec([
        'project', 'item-edit',
        '--project-id', _statusFieldCache.projectId,
        '--id', itemId,
        '--field-id', _statusFieldCache.fieldId,
        '--single-select-option-id', optionId,
      ]);
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      throw new Error(`Failed to move item to "${status}": ${err.stderr || err.message}`);
    }
  });
}

// ---- Get Project Board Items -----------------------------------------------

/**
 * List all items in the project with their current status.
 *
 * Uses `gh project item-list` which returns items with field values.
 *
 * @param projectNumber - The project number
 */
export async function getProjectBoard(
  projectNumber: number,
): Promise<GhResult<{ items: Array<{ id: string; issueNumber: number; status: IssueStatus }> }>> {
  return withGhResult(async () => {
    const { owner } = await getRepoInfo();

    let rawItems: GhProjectItem[];
    try {
      const result = ghJson<{ items: GhProjectItem[] }>(
        [
          'project', 'item-list', String(projectNumber),
          '--owner', owner,
          '--format', 'json',
          '--limit', '1000',
        ],
      );
      rawItems = result.items ?? [];
    } catch {
      // Fallback: try with @me
      const result = ghJson<{ items: GhProjectItem[] }>(
        [
          'project', 'item-list', String(projectNumber),
          '--owner', '@me',
          '--format', 'json',
          '--limit', '1000',
        ],
      );
      rawItems = result.items ?? [];
    }

    // Map items to output format
    const items: Array<{ id: string; issueNumber: number; status: IssueStatus }> = [];

    for (const item of rawItems) {
      // Skip non-issue items (e.g. draft items, PRs)
      const issueNumber = item.content?.number;
      if (!issueNumber) continue;
      if (item.content?.type && item.content.type !== 'Issue') continue;

      // Extract status — gh may include it as a top-level field or in fieldValues
      let status: IssueStatus = 'To Do'; // default

      if (item.status) {
        // gh project item-list may include status as a top-level key
        status = normalizeStatus(item.status);
      } else if (item.fieldValues?.nodes) {
        // Some gh versions nest field values
        const statusNode = item.fieldValues.nodes.find(n => n.field?.name === 'Status');
        if (statusNode?.name) {
          status = normalizeStatus(statusNode.name);
        }
      }

      items.push({
        id: item.id,
        issueNumber,
        status,
      });
    }

    return { items };
  });
}

/**
 * Normalize a status string from gh CLI output to an IssueStatus value.
 * Handles common variations like "Todo" vs "To Do".
 */
function normalizeStatus(raw: string): IssueStatus {
  const normalized = raw.trim();
  if (normalized === 'Todo' || normalized === 'To Do') return 'To Do';
  if (normalized === 'In Progress') return 'In Progress';
  if (normalized === 'In Review') return 'In Review';
  if (normalized === 'Done') return 'Done';
  // Unknown status — default to "To Do"
  return 'To Do';
}

// ---- Reset cache (for testing) ---------------------------------------------

/**
 * Reset the status field cache.
 * Used in tests to ensure clean state between test runs.
 */
export function resetProjectsCache(): void {
  _statusFieldCache = null;
}
