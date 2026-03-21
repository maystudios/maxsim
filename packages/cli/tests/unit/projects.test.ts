/**
 * Projects v2 GraphQL integration tests.
 *
 * Tests the Octokit GraphQL-based project board management functions.
 * Mocks the client.ts seam (getOctokit, getRepoInfo) and child_process.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock client.ts — the primary seam
const mockGraphql = vi.fn();
const mockReposGet = vi.fn();
const mockIssuesGet = vi.fn();

vi.mock('../../src/github/client.js', () => ({
  getOctokit: () => ({
    graphql: mockGraphql,
    rest: {
      repos: { get: mockReposGet },
      issues: { get: mockIssuesGet },
    },
  }),
  getRepoInfo: vi.fn().mockResolvedValue({ owner: 'test-owner', repo: 'test-repo' }),
  withGhResult: async <T>(fn: () => Promise<T>) => {
    try {
      return { ok: true as const, data: await fn() };
    } catch (e: unknown) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e), code: 'UNKNOWN' };
    }
  },
}));

// Mock child_process for gh project create
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return { ...actual, execFileSync: vi.fn() };
});

import {
  ensureProjectBoard,
  addItemToProject,
  moveItemToStatus,
  getProjectBoard,
  resetProjectsCache,
} from '../../src/github/projects.js';
import { getRepoInfo } from '../../src/github/client.js';
import { execFileSync } from 'node:child_process';

// ---- Fixtures ---------------------------------------------------------------

const MOCK_PROJECT = {
  id: 'PVT_test123',
  number: 1,
  title: 'MAXSIM Task Board',
};

const MOCK_STATUS_FIELD = {
  id: 'PVTSSF_status1',
  name: 'Status',
  dataType: 'SINGLE_SELECT',
  options: [
    { id: 'opt_todo', name: 'Todo' },
    { id: 'opt_inprog', name: 'In Progress' },
    { id: 'opt_done', name: 'Done' },
  ],
};

const MOCK_FIELDS_RESPONSE = {
  node: {
    fields: {
      nodes: [
        { id: 'PVTF_title', name: 'Title', dataType: 'TEXT' },
        MOCK_STATUS_FIELD,
      ],
    },
  },
};

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  resetProjectsCache();
  vi.clearAllMocks();

  // Default: owner is a User
  mockReposGet.mockResolvedValue({
    data: { owner: { type: 'User' } },
  });
});

// ---- ensureProjectBoard -----------------------------------------------------

describe('ensureProjectBoard', () => {
  it('finds an existing project and loads field cache', async () => {
    // First call: list projects
    mockGraphql.mockResolvedValueOnce({
      user: { projectsV2: { nodes: [MOCK_PROJECT] } },
    });
    // Second call: load fields
    mockGraphql.mockResolvedValueOnce(MOCK_FIELDS_RESPONSE);

    const result = await ensureProjectBoard('MAXSIM Task Board');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.projectNumber).toBe(1);
      expect(result.data.projectId).toBe('PVT_test123');
      expect(result.data.statusFieldId).toBe('PVTSSF_status1');
      expect(result.data.statusOptions).toHaveProperty('Todo');
      expect(result.data.statusOptions).toHaveProperty('To Do'); // normalized
    }
  });

  it('creates a new project when none exists', async () => {
    // List projects returns empty
    mockGraphql.mockResolvedValueOnce({
      user: { projectsV2: { nodes: [] } },
    });
    // gh project create mock
    (execFileSync as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      JSON.stringify({ number: 42, id: 'PVT_new42' }),
    );
    // Load fields after create
    mockGraphql.mockResolvedValueOnce(MOCK_FIELDS_RESPONSE);

    const result = await ensureProjectBoard('MAXSIM Task Board');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.projectNumber).toBe(42);
      expect(result.data.projectId).toBe('PVT_new42');
    }
    expect(execFileSync).toHaveBeenCalledWith(
      'gh',
      expect.arrayContaining(['project', 'create']),
      expect.any(Object),
    );
  });

  it('returns error when project creation fails', async () => {
    mockGraphql.mockResolvedValueOnce({
      user: { projectsV2: { nodes: [] } },
    });
    (execFileSync as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw { stderr: 'permission denied', message: 'exec failed' };
    });

    const result = await ensureProjectBoard('MAXSIM Task Board');
    expect(result.ok).toBe(false);
  });
});

// ---- addItemToProject -------------------------------------------------------

describe('addItemToProject', () => {
  it('resolves issue node_id and calls addProjectV2ItemById mutation', async () => {
    // Pre-populate cache by setting up a project first
    mockGraphql.mockResolvedValueOnce({
      user: { projectsV2: { nodes: [MOCK_PROJECT] } },
    });
    mockGraphql.mockResolvedValueOnce(MOCK_FIELDS_RESPONSE);
    await ensureProjectBoard('MAXSIM Task Board');

    // issue.get returns node_id
    mockIssuesGet.mockResolvedValueOnce({
      data: { node_id: 'I_issue123' },
    });

    // addProjectV2ItemById mutation
    mockGraphql.mockResolvedValueOnce({
      addProjectV2ItemById: { item: { id: 'PVTI_item456' } },
    });

    const result = await addItemToProject(1, 42);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.itemId).toBe('PVTI_item456');
    }
  });
});

// ---- moveItemToStatus -------------------------------------------------------

describe('moveItemToStatus', () => {
  beforeEach(async () => {
    // Pre-populate the cache
    mockGraphql.mockResolvedValueOnce({
      user: { projectsV2: { nodes: [MOCK_PROJECT] } },
    });
    mockGraphql.mockResolvedValueOnce(MOCK_FIELDS_RESPONSE);
    await ensureProjectBoard('MAXSIM Task Board');
  });

  it('calls updateProjectV2ItemFieldValue with correct IDs', async () => {
    mockGraphql.mockResolvedValueOnce({
      updateProjectV2ItemFieldValue: { projectV2Item: { id: 'PVTI_item1' } },
    });

    const result = await moveItemToStatus(1, 'PVTI_item1', 'In Progress');

    expect(result.ok).toBe(true);
    expect(mockGraphql).toHaveBeenCalledWith(
      expect.stringContaining('updateProjectV2ItemFieldValue'),
      expect.objectContaining({
        projectId: 'PVT_test123',
        itemId: 'PVTI_item1',
        fieldId: 'PVTSSF_status1',
        optionId: 'opt_inprog',
      }),
    );
  });

  it('returns error for empty itemId', async () => {
    const result = await moveItemToStatus(1, '', 'Done');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('empty item_id');
    }
  });

  it('returns error for unknown status option', async () => {
    const result = await moveItemToStatus(1, 'PVTI_item1', 'In Review' as any);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('not found on project board');
    }
  });

  it('normalizes "To Do" from "Todo"', async () => {
    mockGraphql.mockResolvedValueOnce({
      updateProjectV2ItemFieldValue: { projectV2Item: { id: 'PVTI_item1' } },
    });

    const result = await moveItemToStatus(1, 'PVTI_item1', 'To Do');

    expect(result.ok).toBe(true);
    // "To Do" should resolve to the "Todo" option via normalization
    expect(mockGraphql).toHaveBeenCalledWith(
      expect.stringContaining('updateProjectV2ItemFieldValue'),
      expect.objectContaining({ optionId: 'opt_todo' }),
    );
  });
});

// ---- getProjectBoard --------------------------------------------------------

describe('getProjectBoard', () => {
  beforeEach(async () => {
    mockGraphql.mockResolvedValueOnce({
      user: { projectsV2: { nodes: [MOCK_PROJECT] } },
    });
    mockGraphql.mockResolvedValueOnce(MOCK_FIELDS_RESPONSE);
    await ensureProjectBoard('MAXSIM Task Board');
  });

  it('returns items with status from field values', async () => {
    mockGraphql.mockResolvedValueOnce({
      node: {
        items: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            {
              id: 'PVTI_1',
              type: 'ISSUE',
              content: { number: 10, title: 'Issue 10' },
              fieldValues: {
                nodes: [
                  { field: { name: 'Status' }, name: 'In Progress' },
                ],
              },
            },
            {
              id: 'PVTI_2',
              type: 'ISSUE',
              content: { number: 11, title: 'Issue 11' },
              fieldValues: {
                nodes: [
                  { field: { name: 'Status' }, name: 'Todo' },
                ],
              },
            },
          ],
        },
      },
    });

    const result = await getProjectBoard(1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.items[0]).toEqual({ id: 'PVTI_1', issueNumber: 10, status: 'In Progress' });
      expect(result.data.items[1]).toEqual({ id: 'PVTI_2', issueNumber: 11, status: 'To Do' }); // normalized
    }
  });

  it('paginates through multiple pages', async () => {
    // Page 1
    mockGraphql.mockResolvedValueOnce({
      node: {
        items: {
          pageInfo: { hasNextPage: true, endCursor: 'cursor1' },
          nodes: [
            { id: 'PVTI_1', type: 'ISSUE', content: { number: 1 }, fieldValues: { nodes: [] } },
          ],
        },
      },
    });
    // Page 2
    mockGraphql.mockResolvedValueOnce({
      node: {
        items: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            { id: 'PVTI_2', type: 'ISSUE', content: { number: 2 }, fieldValues: { nodes: [] } },
          ],
        },
      },
    });

    const result = await getProjectBoard(1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(2);
    }
    // Verify pagination cursor was passed
    expect(mockGraphql).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ after: 'cursor1' }),
    );
  });

  it('filters out non-ISSUE items', async () => {
    mockGraphql.mockResolvedValueOnce({
      node: {
        items: {
          pageInfo: { hasNextPage: false, endCursor: null },
          nodes: [
            { id: 'PVTI_1', type: 'ISSUE', content: { number: 1 }, fieldValues: { nodes: [] } },
            { id: 'PVTI_2', type: 'PULL_REQUEST', content: { number: 2 }, fieldValues: { nodes: [] } },
            { id: 'PVTI_3', type: 'DRAFT_ISSUE', content: null, fieldValues: { nodes: [] } },
          ],
        },
      },
    });

    const result = await getProjectBoard(1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(1);
      expect(result.data.items[0].issueNumber).toBe(1);
    }
  });
});

// ---- resetProjectsCache -----------------------------------------------------

describe('resetProjectsCache', () => {
  it('clears the cache so next call re-fetches', async () => {
    // Populate cache
    mockGraphql.mockResolvedValueOnce({
      user: { projectsV2: { nodes: [MOCK_PROJECT] } },
    });
    mockGraphql.mockResolvedValueOnce(MOCK_FIELDS_RESPONSE);
    await ensureProjectBoard('MAXSIM Task Board');

    // Reset
    resetProjectsCache();

    // moveItemToStatus should need to re-fetch project list
    mockGraphql.mockResolvedValueOnce({
      user: { projectsV2: { nodes: [MOCK_PROJECT] } },
    });
    mockGraphql.mockResolvedValueOnce(MOCK_FIELDS_RESPONSE);
    mockGraphql.mockResolvedValueOnce({
      updateProjectV2ItemFieldValue: { projectV2Item: { id: 'PVTI_1' } },
    });

    const result = await moveItemToStatus(1, 'PVTI_1', 'In Progress');
    expect(result.ok).toBe(true);

    // Should have made additional graphql calls to re-populate cache
    expect(mockGraphql).toHaveBeenCalledTimes(5); // 2 initial + 3 after reset
  });
});
