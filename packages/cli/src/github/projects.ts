/**
 * GitHub Projects v2 — Board management via Octokit GraphQL
 *
 * Manages GitHub Projects v2 boards for MAXSIM task tracking.
 * Uses octokit.graphql() for all operations — Projects v2 has no REST API.
 *
 * One project board per repo (not per milestone). 4 columns:
 * To Do, In Progress, In Review, Done.
 *
 * Falls back to `gh project create` CLI for project creation only,
 * since the createProjectV2 mutation requires org-level permissions
 * that personal tokens may not have.
 *
 * CRITICAL: Never call process.exit() — return GhResult instead.
 */

import { execFileSync } from 'node:child_process';

import { getOctokit, getRepoInfo, withGhResult } from './client.js';
import type { GhResult, IssueStatus } from './types.js';
import { DEFAULT_STATUS_OPTIONS } from './types.js';

// ---- Status field option ID cache ------------------------------------------

interface StatusFieldCache {
  fieldId: string;        // node_id of the Status field
  projectId: string;      // node_id of the project
  options: Map<string, string>; // option name -> option node_id
}

let _statusFieldCache: StatusFieldCache | null = null;

// ---- GraphQL response types ------------------------------------------------

interface GqlProjectNode {
  id: string;       // PVT_...
  number: number;
  title: string;
}

interface GqlFieldOption {
  id: string;       // node_id
  name: string;
}

interface GqlField {
  id: string;       // node_id
  name: string;
  dataType: string; // SINGLE_SELECT, TEXT, etc.
  options?: GqlFieldOption[];
}

interface GqlProjectItem {
  id: string;       // PVTI_...
  type: string;     // ISSUE, PULL_REQUEST, DRAFT_ISSUE
  content?: {
    number?: number;
    title?: string;
  } | null;
  fieldValues: {
    nodes: Array<{
      field?: { name: string } | null;
      name?: string;        // for SingleSelectField values
      value?: string;       // for other field types
    }>;
  };
}

// ---- GraphQL queries -------------------------------------------------------

const QUERY_FIND_PROJECT = `
  query($owner: String!, $first: Int!) {
    user(login: $owner) {
      projectsV2(first: $first) {
        nodes { id number title }
      }
    }
  }
`;

const QUERY_FIND_PROJECT_ORG = `
  query($owner: String!, $first: Int!) {
    organization(login: $owner) {
      projectsV2(first: $first) {
        nodes { id number title }
      }
    }
  }
`;

const QUERY_PROJECT_FIELDS = `
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        fields(first: 30) {
          nodes {
            ... on ProjectV2Field {
              id name dataType
            }
            ... on ProjectV2SingleSelectField {
              id name dataType
              options { id name }
            }
          }
        }
      }
    }
  }
`;

const QUERY_PROJECT_ITEMS = `
  query($projectId: ID!, $first: Int!, $after: String) {
    node(id: $projectId) {
      ... on ProjectV2 {
        items(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id type
            content {
              ... on Issue { number title }
              ... on PullRequest { number title }
            }
            fieldValues(first: 10) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  field { ... on ProjectV2SingleSelectField { name } }
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

const MUTATION_ADD_ITEM = `
  mutation($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item { id }
    }
  }
`;

const MUTATION_UPDATE_FIELD = `
  mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: { singleSelectOptionId: $optionId }
    }) {
      projectV2Item { id }
    }
  }
`;

// ---- Helpers ---------------------------------------------------------------

/**
 * Detect whether the repo owner is a user or organization.
 */
async function detectOwnerType(): Promise<'User' | 'Organization'> {
  const octokit = getOctokit();
  const { owner, repo } = await getRepoInfo();
  const response = await octokit.rest.repos.get({ owner, repo });
  return response.data.owner?.type === 'Organization' ? 'Organization' : 'User';
}

/**
 * List projects for an owner, handling user vs org detection.
 */
async function listProjects(owner: string): Promise<GqlProjectNode[]> {
  const octokit = getOctokit();
  const ownerType = await detectOwnerType();

  try {
    if (ownerType === 'Organization') {
      const result = await octokit.graphql<{
        organization: { projectsV2: { nodes: GqlProjectNode[] } };
      }>(QUERY_FIND_PROJECT_ORG, { owner, first: 100 });
      return result.organization.projectsV2.nodes;
    } else {
      const result = await octokit.graphql<{
        user: { projectsV2: { nodes: GqlProjectNode[] } };
      }>(QUERY_FIND_PROJECT, { owner, first: 100 });
      return result.user.projectsV2.nodes;
    }
  } catch {
    return [];
  }
}

/**
 * Load project fields and populate the status field cache.
 */
async function loadStatusFieldCache(projectId: string): Promise<void> {
  const octokit = getOctokit();

  const result = await octokit.graphql<{
    node: { fields: { nodes: GqlField[] } };
  }>(QUERY_PROJECT_FIELDS, { projectId });

  const fields = result.node.fields.nodes;

  // Find the Status field (SINGLE_SELECT type)
  const statusField = fields.find(
    f => f.name === 'Status' && f.dataType === 'SINGLE_SELECT',
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
    // The GraphQL API does not support adding single-select options.
    if (process.env.MAXSIM_DEBUG) {
      process.stderr.write(
        `[maxsim:debug] Missing status options on project board: ${missingOptions.join(', ')}. Add them manually in the GitHub Projects settings.\n`,
      );
    }
  }

  _statusFieldCache = {
    fieldId: statusField.id,
    projectId,
    options: optionMap,
  };
}

// ---- Project Board Creation ------------------------------------------------

/**
 * Ensure a project board exists with the given title, creating it if needed.
 *
 * 1. List existing projects via GraphQL
 * 2. If not found, create via `gh project create` CLI
 * 3. Load status field info and cache it
 *
 * Returns the project number and node ID.
 */
export async function ensureProjectBoard(
  title: string,
): Promise<GhResult<{ projectNumber: number; projectId: string }>> {
  return withGhResult(async () => {
    const { owner } = await getRepoInfo();

    // List existing projects
    const projects = await listProjects(owner);
    const existing = projects.find(p => p.title === title);

    if (existing) {
      await loadStatusFieldCache(existing.id);
      return {
        projectNumber: existing.number,
        projectId: existing.id,
      };
    }

    // No matching project found — create via gh CLI
    // (createProjectV2 mutation has complex permission requirements)
    let createOutput: string;
    try {
      createOutput = execFileSync(
        'gh',
        ['project', 'create', '--owner', '@me', '--title', title, '--format', 'json'],
        { timeout: 30_000, stdio: 'pipe', encoding: 'utf-8' },
      ).trim();
    } catch (e: unknown) {
      const err = e as { stderr?: string; message?: string };
      throw new Error(`Failed to create project board: ${err.stderr || err.message}`);
    }

    const created = JSON.parse(createOutput) as { number: number; id: string };
    await loadStatusFieldCache(created.id);

    return {
      projectNumber: created.number,
      projectId: created.id,
    };
  });
}

// ---- Add Item to Project ---------------------------------------------------

/**
 * Add an issue to the project board.
 *
 * Uses the addProjectV2ItemById GraphQL mutation.
 *
 * @param projectNumber - The project number (used to resolve project ID if not cached)
 * @param issueNumber - The issue number to add to the project
 * @returns The project item ID (node_id)
 */
export async function addItemToProject(
  projectNumber: number,
  issueNumber: number,
): Promise<GhResult<{ itemId: string }>> {
  return withGhResult(async () => {
    const octokit = getOctokit();
    const { owner, repo } = await getRepoInfo();

    // Resolve project ID from cache or by listing projects
    let projectId = _statusFieldCache?.projectId;
    if (!projectId) {
      const projects = await listProjects(owner);
      const project = projects.find(p => p.number === projectNumber);
      if (!project) {
        throw new Error(`Project #${projectNumber} not found`);
      }
      projectId = project.id;
      await loadStatusFieldCache(projectId);
    }

    // Get the issue's node_id (required for the mutation)
    const issue = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
    const contentId = issue.data.node_id;

    const result = await octokit.graphql<{
      addProjectV2ItemById: { item: { id: string } };
    }>(MUTATION_ADD_ITEM, { projectId, contentId });

    return { itemId: result.addProjectV2ItemById.item.id };
  });
}

// ---- Move Item to Status ---------------------------------------------------

/**
 * Update the Status field of a project item to the given column.
 *
 * Uses the updateProjectV2ItemFieldValue GraphQL mutation.
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
    const octokit = getOctokit();
    const { owner } = await getRepoInfo();

    // Ensure we have cached status field info
    if (!_statusFieldCache) {
      const projects = await listProjects(owner);
      const project = projects.find(p => p.number === projectNumber);
      if (!project) {
        throw new Error(`Project #${projectNumber} not found`);
      }
      await loadStatusFieldCache(project.id);
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

    if (!itemId) {
      throw new Error('Cannot move item: empty item_id. The issue may not have been added to the project board.');
    }

    await octokit.graphql(MUTATION_UPDATE_FIELD, {
      projectId: _statusFieldCache.projectId,
      itemId,
      fieldId: _statusFieldCache.fieldId,
      optionId,
    });
  });
}

// ---- Get Project Board Items -----------------------------------------------

/**
 * List all items in the project with their current status.
 *
 * Uses GraphQL with cursor-based pagination.
 *
 * @param projectNumber - The project number
 */
export async function getProjectBoard(
  projectNumber: number,
): Promise<GhResult<{ items: Array<{ id: string; issueNumber: number; status: IssueStatus }> }>> {
  return withGhResult(async () => {
    const octokit = getOctokit();
    const { owner } = await getRepoInfo();

    // Resolve project ID
    let projectId = _statusFieldCache?.projectId;
    if (!projectId) {
      const projects = await listProjects(owner);
      const project = projects.find(p => p.number === projectNumber);
      if (!project) {
        throw new Error(`Project #${projectNumber} not found`);
      }
      projectId = project.id;
      await loadStatusFieldCache(projectId);
    }

    // Paginate through all items
    const allItems: GqlProjectItem[] = [];
    let hasNextPage = true;
    let cursor: string | null = null;

    while (hasNextPage) {
      const result = await octokit.graphql<{
        node: {
          items: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: GqlProjectItem[];
          };
        };
      }>(QUERY_PROJECT_ITEMS, {
        projectId,
        first: 100,
        after: cursor,
      });

      allItems.push(...result.node.items.nodes);
      hasNextPage = result.node.items.pageInfo.hasNextPage;
      cursor = result.node.items.pageInfo.endCursor;
    }

    // Map items to output format
    const items: Array<{ id: string; issueNumber: number; status: IssueStatus }> = [];

    for (const item of allItems) {
      if (item.type !== 'ISSUE') continue;
      const issueNumber = item.content?.number;
      if (!issueNumber) continue;

      // Extract status from field values
      let status: IssueStatus = 'To Do';
      for (const fv of item.fieldValues.nodes) {
        if (fv.field?.name === 'Status' && fv.name) {
          status = normalizeStatus(fv.name);
          break;
        }
      }

      items.push({ id: item.id, issueNumber, status });
    }

    return { items };
  });
}

/**
 * Normalize a status string from GitHub to an IssueStatus value.
 * Handles common variations like "Todo" vs "To Do".
 */
function normalizeStatus(raw: string): IssueStatus {
  const normalized = raw.trim();
  if (normalized === 'Todo' || normalized === 'To Do') return 'To Do';
  if (normalized === 'In Progress') return 'In Progress';
  if (normalized === 'In Review') return 'In Review';
  if (normalized === 'Done') return 'Done';
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
