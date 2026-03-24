/**
 * Unit tests for github/discussions.ts
 *
 * All calls to execFileSync are mocked at the node:child_process module level.
 * The mock intercepts both `git` calls (getRepoInfo) and `gh` calls (ghJson/ghExec).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock node:child_process before any imports ──────────────────────────────

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: vi.fn(),
  };
});

import * as childProcess from 'node:child_process';
import { resetClient } from '../../src/github/client.js';
import {
  createDiscussion,
  listDiscussions,
  getDiscussion,
  updateDiscussion,
  deleteDiscussion,
  addDiscussionReply,
} from '../../src/github/discussions.js';

const execFileSyncMock = vi.mocked(childProcess.execFileSync);

// ── Shared fixture data ─────────────────────────────────────────────────────

const REPO_REMOTE_URL = 'git@github.com:testowner/testrepo.git';
const REPO_NODE_ID = 'R_kgDOAbc123';

const MOCK_CATEGORY = {
  id: 'DIC_kwDOAbc123',
  name: 'General',
  slug: 'general',
};

const MOCK_DISCUSSION_RAW = {
  number: 42,
  id: 'D_kwDOAbc123',
  title: 'Test Discussion',
  body: 'Hello world',
  category: { name: 'General' },
  url: 'https://github.com/testowner/testrepo/discussions/42',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

const MOCK_DISCUSSION_MAPPED = {
  number: 42,
  nodeId: 'D_kwDOAbc123',
  title: 'Test Discussion',
  body: 'Hello world',
  categoryName: 'General',
  url: 'https://github.com/testowner/testrepo/discussions/42',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

// ── Helper: mock execFileSync call sequence ─────────────────────────────────

/**
 * Configure the mock so git/gh auth calls return expected defaults,
 * and subsequent gh API calls return the supplied responses in order.
 *
 * Each element of `ghResponses` is either a string (raw stdout) or an Error
 * to throw.
 */
function setupExecMock(...ghResponses: Array<string | Error>): void {
  let apiCallIndex = 0;
  execFileSyncMock.mockImplementation((_cmd: string, args?: readonly string[]) => {
    const argList = args ?? [];

    // git remote call used by getRepoInfo
    if (_cmd === 'git' && argList[0] === 'remote') {
      return REPO_REMOTE_URL;
    }

    // gh api /users/<owner> call used to detect org/user type inside getRepoInfo
    if (_cmd === 'gh' && argList[0] === 'api' && String(argList[1]).startsWith('/users/')) {
      return 'User';
    }

    // All other gh calls — dispatch from the response queue
    const response = ghResponses[apiCallIndex++];
    if (response instanceof Error) throw response;
    return response ?? '';
  });
}

/** Build the GraphQL response envelope for discussionCategories query. */
function categoriesResponse(categories: typeof MOCK_CATEGORY[] = [MOCK_CATEGORY]): string {
  return JSON.stringify({
    data: {
      repository: {
        discussionCategories: {
          nodes: categories,
        },
      },
    },
  });
}

/** Build the GraphQL response envelope for the createDiscussion mutation. */
function createDiscussionResponse(discussion: typeof MOCK_DISCUSSION_RAW = MOCK_DISCUSSION_RAW): string {
  return JSON.stringify({
    data: {
      createDiscussion: {
        discussion,
      },
    },
  });
}

/** Build the GraphQL response envelope for a discussions list query. */
function listDiscussionsResponse(discussions: typeof MOCK_DISCUSSION_RAW[] = [MOCK_DISCUSSION_RAW]): string {
  return JSON.stringify({
    data: {
      repository: {
        discussions: {
          nodes: discussions,
        },
      },
    },
  });
}

/** Build the GraphQL response envelope for a single discussion query. */
function getDiscussionResponse(discussion: typeof MOCK_DISCUSSION_RAW | null = MOCK_DISCUSSION_RAW): string {
  return JSON.stringify({
    data: {
      repository: {
        discussion,
      },
    },
  });
}

// ── Reset cached client state between tests ─────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetClient();
});

// ── createDiscussion ────────────────────────────────────────────────────────

describe('createDiscussion', () => {
  it('returns a mapped GhDiscussion on success', () => {
    // Calls in order: getRepoNodeId, getCategoryId, createDiscussion mutation
    setupExecMock(REPO_NODE_ID, categoriesResponse(), createDiscussionResponse());

    const result = createDiscussion({
      title: 'Test Discussion',
      body: 'Hello world',
      categorySlug: 'general',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(MOCK_DISCUSSION_MAPPED);
  });

  it('accepts an explicit repo argument', () => {
    setupExecMock(REPO_NODE_ID, categoriesResponse(), createDiscussionResponse());

    const result = createDiscussion(
      { title: 'Test', body: 'Body', categorySlug: 'general' },
      { owner: 'customowner', repo: 'customrepo', isOrg: false },
    );

    expect(result.ok).toBe(true);
    // Verify gh was called with customowner/customrepo for the node ID lookup
    const calls = execFileSyncMock.mock.calls;
    const nodeIdCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.includes('repos/customowner/customrepo'),
    );
    expect(nodeIdCall).toBeDefined();
  });

  it('returns NOT_FOUND when category slug does not exist', () => {
    setupExecMock(
      REPO_NODE_ID,
      categoriesResponse([{ id: 'DIC_other', name: 'Other', slug: 'other' }]),
    );

    const result = createDiscussion({
      title: 'Test',
      body: 'Body',
      categorySlug: 'nonexistent',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
    expect(result.error).toContain('nonexistent');
  });

  it('propagates error from getRepoNodeId', () => {
    setupExecMock(new Error('gh: 404 Not Found'));

    const result = createDiscussion({
      title: 'Test',
      body: 'Body',
      categorySlug: 'general',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('propagates error from getCategoryId query', () => {
    setupExecMock(REPO_NODE_ID, new Error('gh: 403 Forbidden'));

    const result = createDiscussion({
      title: 'Test',
      body: 'Body',
      categorySlug: 'general',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });

  it('returns UNKNOWN when mutation returns no discussion', () => {
    setupExecMock(
      REPO_NODE_ID,
      categoriesResponse(),
      JSON.stringify({ data: { createDiscussion: { discussion: null } } }),
    );

    const result = createDiscussion({
      title: 'Test',
      body: 'Body',
      categorySlug: 'general',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
  });
});

// ── listDiscussions ─────────────────────────────────────────────────────────

describe('listDiscussions', () => {
  it('returns an array of mapped discussions', () => {
    setupExecMock(listDiscussionsResponse());

    const result = listDiscussions();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(MOCK_DISCUSSION_MAPPED);
  });

  it('returns an empty array when there are no discussions', () => {
    setupExecMock(listDiscussionsResponse([]));

    const result = listDiscussions();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('filters by category slug when provided', () => {
    // getCategoryId is called first, then the discussions query
    setupExecMock(categoriesResponse(), listDiscussionsResponse());

    const result = listDiscussions({ categorySlug: 'general' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
  });

  it('returns NOT_FOUND when category slug does not exist', () => {
    setupExecMock(categoriesResponse([]));

    const result = listDiscussions({ categorySlug: 'missing' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('propagates API error', () => {
    setupExecMock(new Error('gh: 401 Unauthorized'));

    const result = listDiscussions();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('accepts explicit repo argument', () => {
    setupExecMock(listDiscussionsResponse());

    const result = listDiscussions(
      { first: 5 },
      { owner: 'customowner', repo: 'customrepo', isOrg: true },
    );

    expect(result.ok).toBe(true);
    // Verify the gh call includes owner=customowner
    const calls = execFileSyncMock.mock.calls;
    const graphqlCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.includes('graphql'),
    );
    expect(graphqlCall).toBeDefined();
    const ghArgs = graphqlCall?.[1] as string[];
    expect(ghArgs).toContain('owner=customowner');
  });
});

// ── getDiscussion ───────────────────────────────────────────────────────────

describe('getDiscussion', () => {
  it('returns a mapped GhDiscussion for a valid number', () => {
    setupExecMock(getDiscussionResponse());

    const result = getDiscussion(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(MOCK_DISCUSSION_MAPPED);
  });

  it('returns NOT_FOUND when discussion is null', () => {
    setupExecMock(getDiscussionResponse(null));

    const result = getDiscussion(99);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
    expect(result.error).toContain('99');
  });

  it('propagates API error', () => {
    setupExecMock(new Error('gh: 404 Not Found'));

    const result = getDiscussion(42);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('accepts explicit repo argument', () => {
    setupExecMock(getDiscussionResponse());

    const result = getDiscussion(42, { owner: 'customowner', repo: 'customrepo', isOrg: false });

    expect(result.ok).toBe(true);
    const calls = execFileSyncMock.mock.calls;
    const graphqlCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.includes('graphql'),
    );
    expect(graphqlCall).toBeDefined();
    const ghArgs = graphqlCall?.[1] as string[];
    expect(ghArgs).toContain('owner=customowner');
  });

  it('passes the discussion number as an integer flag', () => {
    setupExecMock(getDiscussionResponse());

    getDiscussion(42);

    const calls = execFileSyncMock.mock.calls;
    const graphqlCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.includes('graphql'),
    );
    expect(graphqlCall).toBeDefined();
    const ghArgs = graphqlCall?.[1] as string[];
    // -F passes typed value (integer) rather than -f (string)
    const flagIndex = ghArgs.indexOf('-F');
    expect(flagIndex).toBeGreaterThan(-1);
    expect(ghArgs[flagIndex + 1]).toBe('number=42');
  });
});

// ── Helpers for new mutations ────────────────────────────────────────────────

/** Build the GraphQL response for the updateDiscussion mutation. */
function updateDiscussionResponse(discussion: typeof MOCK_DISCUSSION_RAW = MOCK_DISCUSSION_RAW): string {
  return JSON.stringify({
    data: {
      updateDiscussion: {
        discussion,
      },
    },
  });
}

/** Build the GraphQL response for the deleteDiscussion mutation. */
function deleteDiscussionResponse(): string {
  return JSON.stringify({
    data: {
      deleteDiscussion: {
        clientMutationId: null,
      },
    },
  });
}

/** Build the GraphQL response for the addDiscussionComment mutation. */
function addDiscussionCommentResponse(id = 'DC_kwDOAbc456'): string {
  return JSON.stringify({
    data: {
      addDiscussionComment: {
        comment: { id },
      },
    },
  });
}

// ── updateDiscussion ─────────────────────────────────────────────────────────

describe('updateDiscussion', () => {
  it('returns a mapped GhDiscussion on success', () => {
    setupExecMock(updateDiscussionResponse());

    const result = updateDiscussion('D_kwDOAbc123', { title: 'Updated Title', body: 'Updated body' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual(MOCK_DISCUSSION_MAPPED);
  });

  it('works when only title is provided', () => {
    setupExecMock(updateDiscussionResponse());

    const result = updateDiscussion('D_kwDOAbc123', { title: 'Only Title' });

    expect(result.ok).toBe(true);
    const calls = execFileSyncMock.mock.calls;
    const graphqlCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.includes('graphql'),
    );
    expect(graphqlCall).toBeDefined();
    const ghArgs = graphqlCall?.[1] as string[];
    expect(ghArgs).toContain('title=Only Title');
    expect(ghArgs).not.toContain('body=');
  });

  it('works when only body is provided', () => {
    setupExecMock(updateDiscussionResponse());

    const result = updateDiscussion('D_kwDOAbc123', { body: 'Only body' });

    expect(result.ok).toBe(true);
    const calls = execFileSyncMock.mock.calls;
    const graphqlCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.includes('graphql'),
    );
    expect(graphqlCall).toBeDefined();
    const ghArgs = graphqlCall?.[1] as string[];
    expect(ghArgs).toContain('body=Only body');
    expect(ghArgs).not.toContain('title=');
  });

  it('returns UNKNOWN when mutation returns no discussion', () => {
    setupExecMock(JSON.stringify({ data: { updateDiscussion: { discussion: null } } }));

    const result = updateDiscussion('D_kwDOAbc123', { title: 'Test' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
  });

  it('propagates API error', () => {
    setupExecMock(new Error('gh: 404 Not Found'));

    const result = updateDiscussion('D_kwDOAbc123', { title: 'Test' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── deleteDiscussion ─────────────────────────────────────────────────────────

describe('deleteDiscussion', () => {
  it('returns ok: true with no data on success', () => {
    setupExecMock(deleteDiscussionResponse());

    const result = deleteDiscussion('D_kwDOAbc123');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeUndefined();
  });

  it('passes the discussion id to the mutation', () => {
    setupExecMock(deleteDiscussionResponse());

    deleteDiscussion('D_kwDOAbc123');

    const calls = execFileSyncMock.mock.calls;
    const graphqlCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.includes('graphql'),
    );
    expect(graphqlCall).toBeDefined();
    const ghArgs = graphqlCall?.[1] as string[];
    expect(ghArgs).toContain('id=D_kwDOAbc123');
  });

  it('propagates API error', () => {
    setupExecMock(new Error('gh: 403 Forbidden'));

    const result = deleteDiscussion('D_kwDOAbc123');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});

// ── addDiscussionReply ───────────────────────────────────────────────────────

describe('addDiscussionReply', () => {
  it('returns the comment id on success', () => {
    setupExecMock(addDiscussionCommentResponse('DC_kwDOAbc456'));

    const result = addDiscussionReply('D_kwDOAbc123', 'Great discussion!');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ id: 'DC_kwDOAbc456' });
  });

  it('passes discussionId and body to the mutation', () => {
    setupExecMock(addDiscussionCommentResponse());

    addDiscussionReply('D_kwDOAbc123', 'Hello!');

    const calls = execFileSyncMock.mock.calls;
    const graphqlCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.includes('graphql'),
    );
    expect(graphqlCall).toBeDefined();
    const ghArgs = graphqlCall?.[1] as string[];
    expect(ghArgs).toContain('discussionId=D_kwDOAbc123');
    expect(ghArgs).toContain('body=Hello!');
  });

  it('returns UNKNOWN when mutation returns no comment', () => {
    setupExecMock(JSON.stringify({ data: { addDiscussionComment: { comment: null } } }));

    const result = addDiscussionReply('D_kwDOAbc123', 'Hello');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
  });

  it('propagates API error', () => {
    setupExecMock(new Error('gh: 401 Unauthorized'));

    const result = addDiscussionReply('D_kwDOAbc123', 'Hello');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNAUTHORIZED');
  });
});
