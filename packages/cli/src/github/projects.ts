/**
 * GitHub Projects v2 — Board management using correct API.
 * Key: GraphQL for mutations, gh CLI for creation, REST for items.
 */

import { execFileSync } from 'node:child_process';
import { getRepoInfo, ghJson, ghExec } from './client.js';
import type {
  GhProject,
  GhProjectField,
  GhProjectItem,
  GhResult,
} from './types.js';
import { BOARD_COLUMNS } from './types.js';

// ── Project CRUD ──────────────────────────────────────────────────────

/** Create a new GitHub Project v2 via gh CLI. */
export function createProject(
  title: string,
  owner?: string,
): GhResult<GhProject> {
  const { owner: repoOwner } = getRepoInfo();
  const projectOwner = owner ?? repoOwner;

  const result = ghJson<{ id: string; number: number; title: string; url: string }>(
    ['project', 'create', '--owner', projectOwner, '--title', title, '--format', 'json'],
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: {
      id: result.data.id,
      number: result.data.number,
      title: result.data.title,
      description: '',
      url: result.data.url,
      closed: false,
    },
  };
}

/** List projects for an owner via gh CLI. */
export function listProjects(owner?: string): GhResult<GhProject[]> {
  const { owner: repoOwner } = getRepoInfo();
  const projectOwner = owner ?? repoOwner;

  const result = ghJson<{ projects: Array<{ id: string; number: number; title: string; url: string; closed: boolean }> }>(
    ['project', 'list', '--owner', projectOwner, '--format', 'json', '--limit', '100'],
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: (result.data.projects ?? []).map((p) => ({
      id: p.id,
      number: p.number,
      title: p.title,
      description: '',
      url: p.url,
      closed: p.closed,
    })),
  };
}

/** Find a project by title, or return null. */
export function findProject(title: string, owner?: string): GhResult<GhProject | null> {
  const result = listProjects(owner);
  if (!result.ok) return result;

  const found = result.data.find((p) => p.title === title) ?? null;
  return { ok: true, data: found };
}

// ── Field Management ──────────────────────────────────────────────────

/** List fields on a project via gh CLI. */
export function listProjectFields(
  projectNumber: number,
  owner?: string,
): GhResult<GhProjectField[]> {
  const { owner: repoOwner } = getRepoInfo();
  const projectOwner = owner ?? repoOwner;

  const result = ghJson<{ fields: Array<{ id: string; name: string; type: string; options?: Array<{ id: string; name: string }> }> }>(
    ['project', 'field-list', String(projectNumber), '--owner', projectOwner, '--format', 'json'],
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: (result.data.fields ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      dataType: f.type,
      options: f.options?.map((o) => ({ id: o.id, name: o.name })),
    })),
  };
}

/** Get the Status field with its options. */
export function getStatusField(
  projectNumber: number,
  owner?: string,
): GhResult<GhProjectField | null> {
  const result = listProjectFields(projectNumber, owner);
  if (!result.ok) return result;

  const statusField = result.data.find((f) => f.name === 'Status') ?? null;
  return { ok: true, data: statusField };
}

/** Get a specific field option ID by name. */
export function getFieldOptionId(
  field: GhProjectField,
  optionName: string,
): string | null {
  return field.options?.find((o) => o.name === optionName)?.id ?? null;
}

// ── Item Management ───────────────────────────────────────────────────

/** List all items on a project board via gh CLI. */
export function listProjectItems(
  projectNumber: number,
  owner?: string,
): GhResult<GhProjectItem[]> {
  const { owner: repoOwner } = getRepoInfo();
  const projectOwner = owner ?? repoOwner;

  const result = ghJson<{ items: Array<{
    id: string;
    content: { number?: number; title: string; type: string } | null;
    isArchived: boolean;
  }> }>(
    ['project', 'item-list', String(projectNumber), '--owner', projectOwner, '--format', 'json', '--limit', '1000'],
  );

  if (!result.ok) return result;

  return {
    ok: true,
    data: (result.data.items ?? []).map((item) => ({
      id: item.id,
      contentNodeId: item.id,
      contentType: (item.content?.type as GhProjectItem['contentType']) ?? 'DraftIssue',
      issueNumber: item.content?.number,
      title: item.content?.title ?? '',
      isArchived: item.isArchived ?? false,
    })),
  };
}

/** Add an issue to the project board via gh CLI. */
export function addItemToProject(
  projectNumber: number,
  issueUrl: string,
  owner?: string,
): GhResult<{ itemId: string }> {
  const { owner: repoOwner } = getRepoInfo();
  const projectOwner = owner ?? repoOwner;

  const result = ghJson<{ id: string }>(
    ['project', 'item-add', String(projectNumber), '--owner', projectOwner, '--url', issueUrl, '--format', 'json'],
  );

  if (!result.ok) return result;

  return { ok: true, data: { itemId: result.data.id } };
}

/** Move an item to a status column using gh CLI. */
export function moveItemToStatus(
  projectNumber: number,
  itemId: string,
  statusName: string,
  owner?: string,
): GhResult<void> {
  const { owner: repoOwner } = getRepoInfo();
  const projectOwner = owner ?? repoOwner;

  // Get the project's Status field and find the option ID
  const statusResult = getStatusField(projectNumber, projectOwner);
  if (!statusResult.ok) return statusResult;
  if (!statusResult.data) {
    return { ok: false, error: 'Status field not found on project', code: 'NOT_FOUND' };
  }

  const optionId = getFieldOptionId(statusResult.data, statusName);
  if (!optionId) {
    return {
      ok: false,
      error: `Status option "${statusName}" not found. Available: ${statusResult.data.options?.map((o) => o.name).join(', ')}`,
      code: 'VALIDATION',
    };
  }

  // Get project node ID for the gh command
  const projectResult = listProjects(projectOwner);
  if (!projectResult.ok) return projectResult;
  const project = projectResult.data.find((p) => p.number === projectNumber);
  if (!project) {
    return { ok: false, error: `Project #${projectNumber} not found`, code: 'NOT_FOUND' };
  }

  const editResult = ghExec([
    'project', 'item-edit',
    '--id', itemId,
    '--project-id', project.id,
    '--field-id', statusResult.data.id,
    '--single-select-option-id', optionId,
  ]);

  if (!editResult.ok) return editResult;
  return { ok: true, data: undefined };
}

// ── Board Setup ───────────────────────────────────────────────────────

/** Ensure a project board exists with the correct Status field options. */
export async function ensureProjectBoard(
  projectTitle: string,
  owner?: string,
): Promise<GhResult<{ project: GhProject; statusField: GhProjectField }>> {
  const { owner: repoOwner } = getRepoInfo();
  const projectOwner = owner ?? repoOwner;

  let project: GhProject;

  const findResult = findProject(projectTitle, projectOwner);
  if (!findResult.ok) return findResult;

  if (findResult.data) {
    project = findResult.data;
  } else {
    const createResult = createProject(projectTitle, projectOwner);
    if (!createResult.ok) return createResult;
    project = createResult.data;
  }

  // Get Status field
  const statusResult = getStatusField(project.number, projectOwner);
  if (!statusResult.ok) return statusResult;

  if (!statusResult.data) {
    return { ok: false, error: 'Status field not found after project creation', code: 'NOT_FOUND' };
  }

  // Add any missing Status field options via GraphQL updateProjectV2Field mutation.
  // The mutation replaces the entire options array, so we merge existing + missing.
  const existingOptions = statusResult.data.options ?? [];
  const existingNames = new Set(existingOptions.map((o) => o.name));
  const missingColumns = BOARD_COLUMNS.filter((col) => !existingNames.has(col.name));

  if (missingColumns.length > 0) {
    // Build the merged options list (name + color + description, no id).
    // The GraphQL ProjectV2SingleSelectFieldOptionInput requires: name, color, description.
    const options = [
      ...existingOptions.map((o) => ({ name: o.name, color: o.color ?? 'GRAY', description: '' })),
      ...missingColumns.map((col) => ({ name: col.name, color: col.color, description: '' })),
    ];

    const mutation =
      'mutation($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]!) {' +
      ' updateProjectV2Field(input: { fieldId: $fieldId, singleSelectOptions: $options }) {' +
      ' projectV2Field { ... on ProjectV2SingleSelectField { id name } } } }';

    // gh api graphql cannot pass array variables via -F flags; use --input - with JSON body.
    const body = JSON.stringify({
      query: mutation,
      variables: { fieldId: statusResult.data.id, options },
    });

    try {
      execFileSync('gh', ['api', 'graphql', '--input', '-'], {
        input: body,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: `Failed to add missing Status options (${missingColumns.map((c) => c.name).join(', ')}): ${msg}`,
        code: 'UNKNOWN',
      };
    }
  }

  return { ok: true, data: { project, statusField: statusResult.data } };
}
