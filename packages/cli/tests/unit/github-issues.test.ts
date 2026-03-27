/**
 * Unit tests for github/issues.ts
 *
 * Strategy: mock `../github/client.js` so that getOctokit() and getRepoInfo()
 * return controlled test doubles, eliminating all network and git-CLI calls.
 *
 * vi.mock() calls are hoisted by Vitest, so they are in place before any
 * import is resolved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock declarations (hoisted) ──────────────────────────────────────────────

// vi.mock() factory is hoisted to the top of the file by Vitest before any
// variable declarations run.  Variables referenced inside the factory must
// therefore also be hoisted via vi.hoisted() so they are initialised before
// the factory executes.

const {
  mockPaginate,
  mockIssuesCreate,
  mockIssuesGet,
  mockIssuesUpdate,
  mockIssuesCreateComment,
  mockIssuesUpdateComment,
  mockIssuesDeleteComment,
  mockGraphql,
  mockRequest,
  mockOctokit,
  mockGetOctokit,
  mockGetRepoInfo,
} = vi.hoisted(() => {
  const mockPaginate = vi.fn();
  const mockIssuesCreate = vi.fn();
  const mockIssuesGet = vi.fn();
  const mockIssuesUpdate = vi.fn();
  const mockIssuesCreateComment = vi.fn();
  const mockIssuesUpdateComment = vi.fn();
  const mockIssuesDeleteComment = vi.fn();
  const mockGraphql = vi.fn();
  const mockRequest = vi.fn();

  const mockOctokit = {
    paginate: mockPaginate,
    graphql: mockGraphql,
    request: mockRequest,
    rest: {
      issues: {
        listForRepo: 'listForRepo-endpoint',
        create: mockIssuesCreate,
        get: mockIssuesGet,
        update: mockIssuesUpdate,
        listComments: 'listComments-endpoint',
        createComment: mockIssuesCreateComment,
        updateComment: mockIssuesUpdateComment,
        deleteComment: mockIssuesDeleteComment,
      },
    },
  };

  const mockGetOctokit = vi.fn(() => mockOctokit);
  const mockGetRepoInfo = vi.fn(() => ({ owner: 'test-owner', repo: 'test-repo', isOrg: false }));

  return {
    mockPaginate,
    mockIssuesCreate,
    mockIssuesGet,
    mockIssuesUpdate,
    mockIssuesCreateComment,
    mockIssuesUpdateComment,
    mockIssuesDeleteComment,
    mockGraphql,
    mockRequest,
    mockOctokit,
    mockGetOctokit,
    mockGetRepoInfo,
  };
});

vi.mock('../../src/github/client.js', () => ({
  getOctokit: mockGetOctokit,
  getRepoInfo: mockGetRepoInfo,
  withGhResult: async (fn: () => Promise<unknown>) => {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number }).status;
      if (status === 404) return { ok: false, error: msg, code: 'NOT_FOUND' };
      if (status === 401) return { ok: false, error: msg, code: 'UNAUTHORIZED' };
      if (status === 403) {
        const code = msg.toLowerCase().includes('rate limit') ? 'RATE_LIMITED' : 'FORBIDDEN';
        return { ok: false, error: msg, code };
      }
      if (status === 422) return { ok: false, error: msg, code: 'VALIDATION' };
      return { ok: false, error: msg, code: 'UNKNOWN' };
    }
  },
}));

// ── Import SUT after mocks are declared ─────────────────────────────────────

import {
  listIssues,
  createIssue,
  getIssue,
  updateIssue,
  closeIssue,
  listComments,
  addComment,
  updateComment,
  deleteComment,
  addSubIssue,
  listSubIssues,
  createEscalationIssue,
  addIssueRelation,
  removeIssueRelation,
  listIssueRelations,
} from '../../src/github/issues.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const RAW_ISSUE = {
  number: 42,
  id: 100042,
  node_id: 'I_node42',
  title: 'Fix the thing',
  body: 'A description.',
  state: 'open',
  state_reason: null,
  labels: [
    { id: 1, node_id: 'L_1', name: 'bug', description: 'A bug', color: 'd73a4a' },
  ],
  milestone: null,
  assignees: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  html_url: 'https://github.com/test-owner/test-repo/issues/42',
};

const RAW_ISSUE_WITH_MILESTONE = {
  ...RAW_ISSUE,
  number: 7,
  id: 100007,
  node_id: 'I_node7',
  title: 'Milestone issue',
  milestone: {
    number: 3,
    id: 200003,
    node_id: 'M_node3',
    title: 'v1.0',
    description: 'First release',
    state: 'open',
    open_issues: 5,
    closed_issues: 2,
    due_on: '2026-06-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
  },
  assignees: [
    { login: 'alice', id: 300001, node_id: 'U_alice', type: 'User' },
  ],
};

const RAW_COMMENT = {
  id: 500001,
  node_id: 'C_node1',
  body: 'Great work!',
  user: { login: 'bob', id: 300002, node_id: 'U_bob', type: 'User' },
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-02T00:00:00Z',
  html_url: 'https://github.com/test-owner/test-repo/issues/42#issuecomment-500001',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOctokit.mockReturnValue(mockOctokit);
  mockGetRepoInfo.mockReturnValue({ owner: 'test-owner', repo: 'test-repo', isOrg: false });
});

// ── listIssues ────────────────────────────────────────────────────────────────

describe('listIssues', () => {
  it('returns an array of mapped GhIssue objects', async () => {
    mockPaginate.mockResolvedValue([RAW_ISSUE]);

    const result = await listIssues();

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    const issue = result.data[0];
    expect(issue.number).toBe(42);
    expect(issue.id).toBe(100042);
    expect(issue.nodeId).toBe('I_node42');
    expect(issue.title).toBe('Fix the thing');
    expect(issue.body).toBe('A description.');
    expect(issue.state).toBe('open');
    expect(issue.stateReason).toBeNull();
    expect(issue.htmlUrl).toBe('https://github.com/test-owner/test-repo/issues/42');
    expect(issue.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(issue.updatedAt).toBe('2026-01-02T00:00:00Z');
  });

  it('maps labels correctly', async () => {
    mockPaginate.mockResolvedValue([RAW_ISSUE]);

    const result = await listIssues();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const label = result.data[0].labels[0];
    expect(label.id).toBe(1);
    expect(label.nodeId).toBe('L_1');
    expect(label.name).toBe('bug');
    expect(label.description).toBe('A bug');
    expect(label.color).toBe('d73a4a');
  });

  it('maps milestone when present', async () => {
    mockPaginate.mockResolvedValue([RAW_ISSUE_WITH_MILESTONE]);

    const result = await listIssues();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ms = result.data[0].milestone;
    expect(ms).not.toBeNull();
    expect(ms?.number).toBe(3);
    expect(ms?.title).toBe('v1.0');
    expect(ms?.openIssues).toBe(5);
    expect(ms?.closedIssues).toBe(2);
    expect(ms?.dueOn).toBe('2026-06-01T00:00:00Z');
  });

  it('maps assignees when present', async () => {
    mockPaginate.mockResolvedValue([RAW_ISSUE_WITH_MILESTONE]);

    const result = await listIssues();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const assignee = result.data[0].assignees[0];
    expect(assignee.login).toBe('alice');
    expect(assignee.type).toBe('User');
  });

  it('returns empty array when no issues exist', async () => {
    mockPaginate.mockResolvedValue([]);

    const result = await listIssues();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it('passes state param to paginate', async () => {
    mockPaginate.mockResolvedValue([]);

    await listIssues({ state: 'closed' });

    expect(mockPaginate).toHaveBeenCalledWith(
      'listForRepo-endpoint',
      expect.objectContaining({ state: 'closed' }),
    );
  });

  it('passes state "all" to paginate', async () => {
    mockPaginate.mockResolvedValue([]);

    await listIssues({ state: 'all' });

    expect(mockPaginate).toHaveBeenCalledWith(
      'listForRepo-endpoint',
      expect.objectContaining({ state: 'all' }),
    );
  });

  it('defaults state to "open" when not specified', async () => {
    mockPaginate.mockResolvedValue([]);

    await listIssues();

    expect(mockPaginate).toHaveBeenCalledWith(
      'listForRepo-endpoint',
      expect.objectContaining({ state: 'open' }),
    );
  });

  it('passes labels param to paginate', async () => {
    mockPaginate.mockResolvedValue([]);

    await listIssues({ labels: 'bug,enhancement' });

    expect(mockPaginate).toHaveBeenCalledWith(
      'listForRepo-endpoint',
      expect.objectContaining({ labels: 'bug,enhancement' }),
    );
  });

  it('passes milestone param as string to paginate', async () => {
    mockPaginate.mockResolvedValue([]);

    await listIssues({ milestone: 3 });

    expect(mockPaginate).toHaveBeenCalledWith(
      'listForRepo-endpoint',
      expect.objectContaining({ milestone: '3' }),
    );
  });

  it('passes owner and repo from getRepoInfo', async () => {
    mockPaginate.mockResolvedValue([]);

    await listIssues();

    expect(mockPaginate).toHaveBeenCalledWith(
      'listForRepo-endpoint',
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockPaginate.mockResolvedValue([]);

    await listIssues({}, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockPaginate).toHaveBeenCalledWith(
      'listForRepo-endpoint',
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    // getRepoInfo should not have been called when repo is provided explicitly
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('returns error result when paginate throws', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockPaginate.mockRejectedValue(err);

    const result = await listIssues();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns UNAUTHORIZED error for 401 responses', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockPaginate.mockRejectedValue(err);

    const result = await listIssues();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('returns multiple issues', async () => {
    const secondIssue = { ...RAW_ISSUE, number: 43, id: 100043, title: 'Another issue' };
    mockPaginate.mockResolvedValue([RAW_ISSUE, secondIssue]);

    const result = await listIssues();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].number).toBe(42);
    expect(result.data[1].number).toBe(43);
  });
});

// ── createIssue ───────────────────────────────────────────────────────────────

describe('createIssue', () => {
  it('returns the created issue', async () => {
    mockIssuesCreate.mockResolvedValue({ data: RAW_ISSUE });

    const result = await createIssue({ title: 'Fix the thing', body: 'A description.' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.number).toBe(42);
    expect(result.data.title).toBe('Fix the thing');
    expect(result.data.body).toBe('A description.');
  });

  it('passes title and body to octokit', async () => {
    mockIssuesCreate.mockResolvedValue({ data: RAW_ISSUE });

    await createIssue({ title: 'New issue', body: 'Issue body' });

    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New issue', body: 'Issue body' }),
    );
  });

  it('passes labels to octokit when provided', async () => {
    mockIssuesCreate.mockResolvedValue({ data: RAW_ISSUE });

    await createIssue({ title: 'T', body: 'B', labels: ['bug', 'enhancement'] });

    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ['bug', 'enhancement'] }),
    );
  });

  it('passes milestone to octokit when provided', async () => {
    mockIssuesCreate.mockResolvedValue({ data: RAW_ISSUE });

    await createIssue({ title: 'T', body: 'B', milestone: 5 });

    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ milestone: 5 }),
    );
  });

  it('passes assignees to octokit when provided', async () => {
    mockIssuesCreate.mockResolvedValue({ data: RAW_ISSUE });

    await createIssue({ title: 'T', body: 'B', assignees: ['alice', 'bob'] });

    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ assignees: ['alice', 'bob'] }),
    );
  });

  it('passes owner and repo from getRepoInfo', async () => {
    mockIssuesCreate.mockResolvedValue({ data: RAW_ISSUE });

    await createIssue({ title: 'T', body: 'B' });

    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesCreate.mockResolvedValue({ data: RAW_ISSUE });

    await createIssue({ title: 'T', body: 'B' }, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('maps labels in the returned issue', async () => {
    mockIssuesCreate.mockResolvedValue({ data: RAW_ISSUE });

    const result = await createIssue({ title: 'T', body: 'B' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.labels[0].name).toBe('bug');
  });

  it('returns error result on API failure', async () => {
    const err = Object.assign(new Error('Unprocessable Entity'), { status: 422 });
    mockIssuesCreate.mockRejectedValue(err);

    const result = await createIssue({ title: 'T', body: 'B' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  it('returns FORBIDDEN error for 403 responses', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    mockIssuesCreate.mockRejectedValue(err);

    const result = await createIssue({ title: 'T', body: 'B' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});

// ── getIssue ──────────────────────────────────────────────────────────────────

describe('getIssue', () => {
  it('returns a single mapped GhIssue', async () => {
    mockIssuesGet.mockResolvedValue({ data: RAW_ISSUE });

    const result = await getIssue(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.number).toBe(42);
    expect(result.data.title).toBe('Fix the thing');
  });

  it('passes the issue number to octokit', async () => {
    mockIssuesGet.mockResolvedValue({ data: RAW_ISSUE });

    await getIssue(42);

    expect(mockIssuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42 }),
    );
  });

  it('passes owner and repo from getRepoInfo', async () => {
    mockIssuesGet.mockResolvedValue({ data: RAW_ISSUE });

    await getIssue(42);

    expect(mockIssuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesGet.mockResolvedValue({ data: RAW_ISSUE });

    await getIssue(42, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('maps milestone when issue has one', async () => {
    mockIssuesGet.mockResolvedValue({ data: RAW_ISSUE_WITH_MILESTONE });

    const result = await getIssue(7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.milestone?.title).toBe('v1.0');
  });

  it('returns null milestone when issue has none', async () => {
    mockIssuesGet.mockResolvedValue({ data: RAW_ISSUE });

    const result = await getIssue(42);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.milestone).toBeNull();
  });

  it('returns NOT_FOUND error for missing issues', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesGet.mockRejectedValue(err);

    const result = await getIssue(9999);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns UNKNOWN error for unexpected failures', async () => {
    mockIssuesGet.mockRejectedValue(new Error('Network timeout'));

    const result = await getIssue(42);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
    expect(result.error).toContain('Network timeout');
  });
});

// ── updateIssue ───────────────────────────────────────────────────────────────

describe('updateIssue', () => {
  it('returns the updated issue', async () => {
    const updated = { ...RAW_ISSUE, title: 'Updated title' };
    mockIssuesUpdate.mockResolvedValue({ data: updated });

    const result = await updateIssue(42, { title: 'Updated title' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.title).toBe('Updated title');
  });

  it('passes updated title to octokit', async () => {
    mockIssuesUpdate.mockResolvedValue({ data: RAW_ISSUE });

    await updateIssue(42, { title: 'New title' });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New title', issue_number: 42 }),
    );
  });

  it('passes updated body to octokit', async () => {
    mockIssuesUpdate.mockResolvedValue({ data: RAW_ISSUE });

    await updateIssue(42, { body: 'Updated body' });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'Updated body' }),
    );
  });

  it('passes state to octokit', async () => {
    const closed = { ...RAW_ISSUE, state: 'closed', state_reason: 'completed' };
    mockIssuesUpdate.mockResolvedValue({ data: closed });

    await updateIssue(42, { state: 'closed' });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'closed' }),
    );
  });

  it('maps stateReason to state_reason in the API call', async () => {
    mockIssuesUpdate.mockResolvedValue({ data: RAW_ISSUE });

    await updateIssue(42, { stateReason: 'not_planned' });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state_reason: 'not_planned' }),
    );
    // stateReason (camelCase) must not appear directly in the call
    const callArgs = mockIssuesUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty('stateReason');
  });

  it('passes updated labels to octokit', async () => {
    mockIssuesUpdate.mockResolvedValue({ data: RAW_ISSUE });

    await updateIssue(42, { labels: ['enhancement', 'help wanted'] });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ labels: ['enhancement', 'help wanted'] }),
    );
  });

  it('passes milestone to octokit', async () => {
    mockIssuesUpdate.mockResolvedValue({ data: RAW_ISSUE });

    await updateIssue(42, { milestone: 7 });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ milestone: 7 }),
    );
  });

  it('passes milestone: null to clear a milestone', async () => {
    mockIssuesUpdate.mockResolvedValue({ data: RAW_ISSUE });

    await updateIssue(42, { milestone: null });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ milestone: null }),
    );
  });

  it('passes owner and repo from getRepoInfo', async () => {
    mockIssuesUpdate.mockResolvedValue({ data: RAW_ISSUE });

    await updateIssue(42, { title: 'T' });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesUpdate.mockResolvedValue({ data: RAW_ISSUE });

    await updateIssue(42, { title: 'T' }, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('returns error result when update fails', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesUpdate.mockRejectedValue(err);

    const result = await updateIssue(9999, { title: 'T' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── closeIssue ────────────────────────────────────────────────────────────────

describe('closeIssue', () => {
  it('closes an issue with default reason "completed"', async () => {
    const closed = { ...RAW_ISSUE, state: 'closed', state_reason: 'completed' };
    mockIssuesUpdate.mockResolvedValue({ data: closed });

    const result = await closeIssue(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.state).toBe('closed');
    expect(result.data.stateReason).toBe('completed');
  });

  it('passes state: "closed" and state_reason: "completed" to octokit by default', async () => {
    const closed = { ...RAW_ISSUE, state: 'closed', state_reason: 'completed' };
    mockIssuesUpdate.mockResolvedValue({ data: closed });

    await closeIssue(42);

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'closed', state_reason: 'completed' }),
    );
  });

  it('closes an issue with reason "not_planned"', async () => {
    const closed = { ...RAW_ISSUE, state: 'closed', state_reason: 'not_planned' };
    mockIssuesUpdate.mockResolvedValue({ data: closed });

    const result = await closeIssue(42, 'not_planned');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.state).toBe('closed');
    expect(result.data.stateReason).toBe('not_planned');
  });

  it('passes state_reason: "not_planned" to octokit when specified', async () => {
    const closed = { ...RAW_ISSUE, state: 'closed', state_reason: 'not_planned' };
    mockIssuesUpdate.mockResolvedValue({ data: closed });

    await closeIssue(42, 'not_planned');

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'closed', state_reason: 'not_planned' }),
    );
  });

  it('passes the correct issue number to octokit', async () => {
    const closed = { ...RAW_ISSUE, state: 'closed', state_reason: 'completed' };
    mockIssuesUpdate.mockResolvedValue({ data: closed });

    await closeIssue(99);

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 99 }),
    );
  });

  it('accepts an explicit repo override', async () => {
    const closed = { ...RAW_ISSUE, state: 'closed', state_reason: 'completed' };
    mockIssuesUpdate.mockResolvedValue({ data: closed });

    await closeIssue(42, 'completed', { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
  });

  it('returns error result when issue does not exist', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesUpdate.mockRejectedValue(err);

    const result = await closeIssue(9999);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── listComments ──────────────────────────────────────────────────────────────

describe('listComments', () => {
  it('returns an array of mapped GhComment objects', async () => {
    mockPaginate.mockResolvedValue([RAW_COMMENT]);

    const result = await listComments(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);

    const comment = result.data[0];
    expect(comment.id).toBe(500001);
    expect(comment.nodeId).toBe('C_node1');
    expect(comment.body).toBe('Great work!');
    expect(comment.htmlUrl).toContain('issuecomment-500001');
    expect(comment.createdAt).toBe('2026-02-01T00:00:00Z');
    expect(comment.updatedAt).toBe('2026-02-02T00:00:00Z');
  });

  it('maps comment user correctly', async () => {
    mockPaginate.mockResolvedValue([RAW_COMMENT]);

    const result = await listComments(42);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = result.data[0].user;
    expect(user.login).toBe('bob');
    expect(user.id).toBe(300002);
    expect(user.nodeId).toBe('U_bob');
    expect(user.type).toBe('User');
  });

  it('returns empty array when issue has no comments', async () => {
    mockPaginate.mockResolvedValue([]);

    const result = await listComments(42);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it('passes the issue number to paginate', async () => {
    mockPaginate.mockResolvedValue([]);

    await listComments(42);

    expect(mockPaginate).toHaveBeenCalledWith(
      'listComments-endpoint',
      expect.objectContaining({ issue_number: 42 }),
    );
  });

  it('passes owner and repo from getRepoInfo', async () => {
    mockPaginate.mockResolvedValue([]);

    await listComments(42);

    expect(mockPaginate).toHaveBeenCalledWith(
      'listComments-endpoint',
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockPaginate.mockResolvedValue([]);

    await listComments(42, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockPaginate).toHaveBeenCalledWith(
      'listComments-endpoint',
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('handles comment with null body gracefully', async () => {
    const noBodyComment = { ...RAW_COMMENT, body: null };
    mockPaginate.mockResolvedValue([noBodyComment]);

    const result = await listComments(42);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].body).toBe('');
  });

  it('handles comment with null user gracefully', async () => {
    const noUserComment = { ...RAW_COMMENT, user: null };
    mockPaginate.mockResolvedValue([noUserComment]);

    const result = await listComments(42);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const user = result.data[0].user;
    expect(user.login).toBe('');
    expect(user.id).toBe(0);
    expect(user.nodeId).toBe('');
    expect(user.type).toBe('User');
  });

  it('returns multiple comments', async () => {
    const secondComment = { ...RAW_COMMENT, id: 500002, body: 'Another comment' };
    mockPaginate.mockResolvedValue([RAW_COMMENT, secondComment]);

    const result = await listComments(42);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[1].body).toBe('Another comment');
  });

  it('returns error result when paginate throws', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockPaginate.mockRejectedValue(err);

    const result = await listComments(9999);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── addComment ────────────────────────────────────────────────────────────────

describe('addComment', () => {
  it('returns the created GhComment', async () => {
    mockIssuesCreateComment.mockResolvedValue({ data: RAW_COMMENT });

    const result = await addComment(42, 'Great work!');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(500001);
    expect(result.data.body).toBe('Great work!');
    expect(result.data.nodeId).toBe('C_node1');
  });

  it('passes the issue number and body to octokit', async () => {
    mockIssuesCreateComment.mockResolvedValue({ data: RAW_COMMENT });

    await addComment(42, 'LGTM!');

    expect(mockIssuesCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ issue_number: 42, body: 'LGTM!' }),
    );
  });

  it('passes owner and repo from getRepoInfo', async () => {
    mockIssuesCreateComment.mockResolvedValue({ data: RAW_COMMENT });

    await addComment(42, 'Comment body');

    expect(mockIssuesCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesCreateComment.mockResolvedValue({ data: RAW_COMMENT });

    await addComment(42, 'Comment body', { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('maps user on returned comment', async () => {
    mockIssuesCreateComment.mockResolvedValue({ data: RAW_COMMENT });

    const result = await addComment(42, 'Hey!');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.user.login).toBe('bob');
    expect(result.data.user.type).toBe('User');
  });

  it('handles null body in API response gracefully', async () => {
    const nullBodyComment = { ...RAW_COMMENT, body: null };
    mockIssuesCreateComment.mockResolvedValue({ data: nullBodyComment });

    const result = await addComment(42, '');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.body).toBe('');
  });

  it('handles null user in API response gracefully', async () => {
    const nullUserComment = { ...RAW_COMMENT, user: null };
    mockIssuesCreateComment.mockResolvedValue({ data: nullUserComment });

    const result = await addComment(42, 'Hey!');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const user = result.data.user;
    expect(user.login).toBe('');
    expect(user.id).toBe(0);
    expect(user.type).toBe('User');
  });

  it('returns error result on API failure', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesCreateComment.mockRejectedValue(err);

    const result = await addComment(9999, 'Hello');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns RATE_LIMITED error when rate-limited', async () => {
    const err = Object.assign(new Error('rate limit exceeded'), { status: 403 });
    mockIssuesCreateComment.mockRejectedValue(err);

    const result = await addComment(42, 'Hello');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('RATE_LIMITED');
  });
});

// ── addIssueRelation ──────────────────────────────────────────────────────────

describe('addIssueRelation', () => {
  it('resolves both issue node IDs and calls graphql with BLOCKS', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockResolvedValue({ addLinkedIssue: { issue: { number: 42 } } });

    const result = await addIssueRelation(42, 99, 'blocking');

    expect(result.ok).toBe(true);
    expect(mockGraphql).toHaveBeenCalledWith(
      expect.stringContaining('addLinkedIssue'),
      expect.objectContaining({
        issueId: 'I_node42',
        relatedId: 'I_node99',
        relationType: 'BLOCKS',
      }),
    );
  });

  it('calls graphql with IS_BLOCKED_BY for blocked_by type', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockResolvedValue({ addLinkedIssue: { issue: { number: 42 } } });

    const result = await addIssueRelation(42, 99, 'blocked_by');

    expect(result.ok).toBe(true);
    expect(mockGraphql).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ relationType: 'IS_BLOCKED_BY' }),
    );
  });

  it('passes owner and repo from getRepoInfo when fetching node IDs', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockResolvedValue({});

    await addIssueRelation(42, 99, 'blocking');

    expect(mockIssuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockResolvedValue({});

    await addIssueRelation(42, 99, 'blocking', { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('returns error result when issue lookup fails', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesGet.mockRejectedValue(err);

    const result = await addIssueRelation(9999, 1, 'blocking');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns error result when graphql call fails', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockRejectedValue(new Error('GraphQL error'));

    const result = await addIssueRelation(42, 99, 'blocking');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
  });
});

// ── removeIssueRelation ───────────────────────────────────────────────────────

describe('removeIssueRelation', () => {
  it('resolves both issue node IDs and calls graphql with removeLinkedIssue', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockResolvedValue({ removeLinkedIssue: { issue: { number: 42 } } });

    const result = await removeIssueRelation(42, 99, 'blocking');

    expect(result.ok).toBe(true);
    expect(mockGraphql).toHaveBeenCalledWith(
      expect.stringContaining('removeLinkedIssue'),
      expect.objectContaining({
        issueId: 'I_node42',
        relatedId: 'I_node99',
        relationType: 'BLOCKS',
      }),
    );
  });

  it('calls graphql with IS_BLOCKED_BY for blocked_by type', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockResolvedValue({});

    const result = await removeIssueRelation(42, 99, 'blocked_by');

    expect(result.ok).toBe(true);
    expect(mockGraphql).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ relationType: 'IS_BLOCKED_BY' }),
    );
  });

  it('returns error result when graphql call fails', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockRejectedValue(new Error('GraphQL error'));

    const result = await removeIssueRelation(42, 99, 'blocking');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
  });

  it('returns error result when issue lookup fails', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesGet.mockRejectedValue(err);

    const result = await removeIssueRelation(9999, 1, 'blocking');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesGet
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, node_id: 'I_node42' } })
      .mockResolvedValueOnce({ data: { ...RAW_ISSUE, number: 99, node_id: 'I_node99' } });
    mockGraphql.mockResolvedValue({});

    await removeIssueRelation(42, 99, 'blocking', { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });
});

// ── listIssueRelations ────────────────────────────────────────────────────────

function makeRelationsResponse(opts: {
  blockedBy?: number[];
  blocking?: number[];
  related?: number[];
}) {
  return {
    repository: {
      issue: {
        blockedBy: { nodes: (opts.blockedBy ?? []).map((n) => ({ number: n })) },
        blocking: { nodes: (opts.blocking ?? []).map((n) => ({ number: n })) },
        related: { nodes: (opts.related ?? []).map((n) => ({ number: n })) },
      },
    },
  };
}

describe('listIssueRelations', () => {
  it('returns related relations with type "related"', async () => {
    mockGraphql.mockResolvedValue(makeRelationsResponse({ related: [99, 100] }));

    const result = await listIssueRelations(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({ issueNumber: 42, relatedIssueNumber: 99, type: 'related' });
    expect(result.data[1]).toEqual({ issueNumber: 42, relatedIssueNumber: 100, type: 'related' });
  });

  it('returns blocked_by relations with type "blocked_by"', async () => {
    mockGraphql.mockResolvedValue(makeRelationsResponse({ blockedBy: [10] }));

    const result = await listIssueRelations(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ issueNumber: 42, relatedIssueNumber: 10, type: 'blocked_by' });
  });

  it('returns blocking relations with type "blocking"', async () => {
    mockGraphql.mockResolvedValue(makeRelationsResponse({ blocking: [20] }));

    const result = await listIssueRelations(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({ issueNumber: 42, relatedIssueNumber: 20, type: 'blocking' });
  });

  it('returns mixed relation types with correct directions', async () => {
    mockGraphql.mockResolvedValue(
      makeRelationsResponse({ blockedBy: [10], blocking: [20], related: [30] }),
    );

    const result = await listIssueRelations(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(3);
    expect(result.data.find((r) => r.relatedIssueNumber === 10)?.type).toBe('blocked_by');
    expect(result.data.find((r) => r.relatedIssueNumber === 20)?.type).toBe('blocking');
    expect(result.data.find((r) => r.relatedIssueNumber === 30)?.type).toBe('related');
  });

  it('returns empty array when issue has no linked issues', async () => {
    mockGraphql.mockResolvedValue(makeRelationsResponse({}));

    const result = await listIssueRelations(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it('returns empty array when issue is null in response', async () => {
    mockGraphql.mockResolvedValue({
      repository: { issue: null },
    });

    const result = await listIssueRelations(42);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it('passes owner, repo, and issue number to graphql', async () => {
    mockGraphql.mockResolvedValue(makeRelationsResponse({}));

    await listIssueRelations(42);

    expect(mockGraphql).toHaveBeenCalledWith(
      expect.stringContaining('linkedIssues'),
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo', number: 42 }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockGraphql.mockResolvedValue(makeRelationsResponse({}));

    await listIssueRelations(42, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockGraphql).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('returns error result when graphql call fails', async () => {
    mockGraphql.mockRejectedValue(new Error('GraphQL error'));

    const result = await listIssueRelations(42);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
  });

  it('returns NOT_FOUND error for 404 responses', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockGraphql.mockRejectedValue(err);

    const result = await listIssueRelations(9999);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── createEscalationIssue ─────────────────────────────────────────────────────

describe('createEscalationIssue', () => {
  const PAYLOAD = {
    taskTitle: 'Fix auth flow',
    taskSpec: 'Implement OAuth2 token refresh',
    attempts: [
      {
        attemptNumber: 1,
        summary: 'First try at implementing',
        failedGate: 'test',
        errorOutput: 'FAIL: token refresh test',
      },
    ],
    rootCause: 'implementation' as const,
    proposedNextStep: 'Refactor token refresh logic',
    phaseNumber: 3,
    taskNumber: 2,
  };

  it('creates an issue with [Escalation] prefix in title', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    const result = await createEscalationIssue(PAYLOAD);

    expect(result.ok).toBe(true);
    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '[Escalation] Fix auth flow',
      }),
    );
  });

  it('includes labels type:bug and maxsim:auto', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    await createEscalationIssue(PAYLOAD);

    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: ['type:bug', 'maxsim:auto'],
      }),
    );
  });

  it('includes the original spec in the body', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    await createEscalationIssue(PAYLOAD);

    const call = mockIssuesCreate.mock.calls[0][0] as Record<string, unknown>;
    const body = call.body as string;
    expect(body).toContain('Original Spec');
    expect(body).toContain('Implement OAuth2 token refresh');
  });

  it('includes attempt summaries in the body', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    await createEscalationIssue(PAYLOAD);

    const call = mockIssuesCreate.mock.calls[0][0] as Record<string, unknown>;
    const body = call.body as string;
    expect(body).toContain('Attempt 1');
    expect(body).toContain('First try at implementing');
    expect(body).toContain('FAIL: token refresh test');
  });

  it('includes root cause in the body', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    await createEscalationIssue(PAYLOAD);

    const call = mockIssuesCreate.mock.calls[0][0] as Record<string, unknown>;
    const body = call.body as string;
    expect(body).toContain('implementation');
  });

  it('includes proposed next step in the body', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    await createEscalationIssue(PAYLOAD);

    const call = mockIssuesCreate.mock.calls[0][0] as Record<string, unknown>;
    const body = call.body as string;
    expect(body).toContain('Refactor token refresh logic');
  });

  it('includes escalation comment header in the body', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    await createEscalationIssue(PAYLOAD);

    const call = mockIssuesCreate.mock.calls[0][0] as Record<string, unknown>;
    const body = call.body as string;
    expect(body).toContain('maxsim:type=escalation');
  });

  it('adds cross-reference comment when parentIssueNumber is provided', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });
    mockIssuesCreateComment.mockResolvedValue({ data: RAW_COMMENT });

    await createEscalationIssue({ ...PAYLOAD, parentIssueNumber: 10 });

    expect(mockIssuesCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        issue_number: 10,
        body: expect.stringContaining('#55'),
      }),
    );
  });

  it('does not add cross-reference comment when parentIssueNumber is absent', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    await createEscalationIssue(PAYLOAD);

    expect(mockIssuesCreateComment).not.toHaveBeenCalled();
  });

  it('returns error result when createIssue fails', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockIssuesCreate.mockRejectedValue(err);

    const result = await createEscalationIssue(PAYLOAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesCreate.mockResolvedValue({ data: { ...RAW_ISSUE, number: 55 } });

    await createEscalationIssue(PAYLOAD, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesCreate).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });
});

// ── addSubIssue ──────────────────────────────────────────────────────────────

describe('addSubIssue', () => {
  it('resolves child internal ID and calls the sub-issues endpoint', async () => {
    mockIssuesGet.mockResolvedValue({ data: { ...RAW_ISSUE, number: 10, id: 999010 } });
    mockRequest.mockResolvedValue({ status: 201 });

    const result = await addSubIssue(5, 10);

    expect(result.ok).toBe(true);

    // Should first fetch the child issue to get its internal numeric ID
    expect(mockIssuesGet).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 10,
      }),
    );

    // Should POST to the sub-issues endpoint with the child's internal ID
    expect(mockRequest).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 5,
        sub_issue_id: 999010,
      }),
    );
  });

  it('uses the child internal id (not the issue number)', async () => {
    // The child issue has number 10 but internal id 888888
    mockIssuesGet.mockResolvedValue({ data: { ...RAW_ISSUE, number: 10, id: 888888 } });
    mockRequest.mockResolvedValue({ status: 201 });

    await addSubIssue(1, 10);

    // sub_issue_id must be the internal numeric id, not the issue number
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ sub_issue_id: 888888 }),
    );
  });

  it('returns error result when the child issue lookup fails', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesGet.mockRejectedValue(err);

    const result = await addSubIssue(5, 999);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns error result when the sub-issue POST request fails', async () => {
    mockIssuesGet.mockResolvedValue({ data: { ...RAW_ISSUE, number: 10, id: 999010 } });
    const err = Object.assign(new Error('Validation Failed'), { status: 422 });
    mockRequest.mockRejectedValue(err);

    const result = await addSubIssue(5, 10);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesGet.mockResolvedValue({ data: { ...RAW_ISSUE, number: 10, id: 999010 } });
    mockRequest.mockResolvedValue({ status: 201 });

    await addSubIssue(5, 10, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesGet).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockRequest).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });
});

// ── listSubIssues ────────────────────────────────────────────────────────────

describe('listSubIssues', () => {
  it('returns an array of mapped GhIssue objects', async () => {
    mockPaginate.mockResolvedValue([RAW_ISSUE]);

    const result = await listSubIssues(5);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).toHaveLength(1);
    const issue = result.data[0];
    expect(issue.number).toBe(42);
    expect(issue.id).toBe(100042);
    expect(issue.nodeId).toBe('I_node42');
    expect(issue.title).toBe('Fix the thing');
    expect(issue.state).toBe('open');
  });

  it('calls paginate with the correct sub-issues endpoint', async () => {
    mockPaginate.mockResolvedValue([]);

    await listSubIssues(5);

    expect(mockPaginate).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/issues/{issue_number}/sub_issues',
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 5,
        per_page: 100,
      }),
    );
  });

  it('returns empty array when parent has no sub-issues', async () => {
    mockPaginate.mockResolvedValue([]);

    const result = await listSubIssues(5);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(0);
  });

  it('returns multiple sub-issues', async () => {
    const secondIssue = { ...RAW_ISSUE, number: 43, id: 100043, title: 'Another sub-issue' };
    mockPaginate.mockResolvedValue([RAW_ISSUE, secondIssue]);

    const result = await listSubIssues(5);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].number).toBe(42);
    expect(result.data[1].number).toBe(43);
  });

  it('maps labels, milestones, and assignees correctly', async () => {
    mockPaginate.mockResolvedValue([RAW_ISSUE_WITH_MILESTONE]);

    const result = await listSubIssues(5);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const issue = result.data[0];
    expect(issue.labels).toHaveLength(1);
    expect(issue.labels[0].name).toBe('bug');
    expect(issue.milestone).not.toBeNull();
    expect(issue.milestone?.title).toBe('v1.0');
    expect(issue.assignees).toHaveLength(1);
    expect(issue.assignees[0].login).toBe('alice');
  });

  it('returns error result when paginate throws', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockPaginate.mockRejectedValue(err);

    const result = await listSubIssues(999);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('accepts an explicit repo override', async () => {
    mockPaginate.mockResolvedValue([]);

    await listSubIssues(5, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockPaginate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });
});

// ── updateComment ─────────────────────────────────────────────────────────────

describe('updateComment', () => {
  it('returns the updated GhComment', async () => {
    const updatedComment = { ...RAW_COMMENT, body: 'Updated body' };
    mockIssuesUpdateComment.mockResolvedValue({ data: updatedComment });

    const result = await updateComment(500001, 'Updated body');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.id).toBe(500001);
    expect(result.data.body).toBe('Updated body');
    expect(result.data.nodeId).toBe('C_node1');
  });

  it('passes comment_id and body to octokit', async () => {
    mockIssuesUpdateComment.mockResolvedValue({ data: RAW_COMMENT });

    await updateComment(500001, 'New body');

    expect(mockIssuesUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 500001, body: 'New body' }),
    );
  });

  it('passes owner and repo from getRepoInfo', async () => {
    mockIssuesUpdateComment.mockResolvedValue({ data: RAW_COMMENT });

    await updateComment(500001, 'Comment body');

    expect(mockIssuesUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesUpdateComment.mockResolvedValue({ data: RAW_COMMENT });

    await updateComment(500001, 'Comment body', { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('maps user on returned comment', async () => {
    mockIssuesUpdateComment.mockResolvedValue({ data: RAW_COMMENT });

    const result = await updateComment(500001, 'Hey!');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.user.login).toBe('bob');
    expect(result.data.user.type).toBe('User');
  });

  it('handles null body in API response gracefully', async () => {
    const nullBodyComment = { ...RAW_COMMENT, body: null };
    mockIssuesUpdateComment.mockResolvedValue({ data: nullBodyComment });

    const result = await updateComment(500001, '');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.body).toBe('');
  });

  it('handles null user in API response gracefully', async () => {
    const nullUserComment = { ...RAW_COMMENT, user: null };
    mockIssuesUpdateComment.mockResolvedValue({ data: nullUserComment });

    const result = await updateComment(500001, 'Hey!');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const user = result.data.user;
    expect(user.login).toBe('');
    expect(user.id).toBe(0);
    expect(user.type).toBe('User');
  });

  it('returns error result on API failure', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesUpdateComment.mockRejectedValue(err);

    const result = await updateComment(9999, 'Hello');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns RATE_LIMITED error when rate-limited', async () => {
    const err = Object.assign(new Error('rate limit exceeded'), { status: 403 });
    mockIssuesUpdateComment.mockRejectedValue(err);

    const result = await updateComment(500001, 'Hello');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('RATE_LIMITED');
  });
});

// ── deleteComment ─────────────────────────────────────────────────────────────

describe('deleteComment', () => {
  it('returns success with void data on successful delete', async () => {
    mockIssuesDeleteComment.mockResolvedValue({});

    const result = await deleteComment(500001);

    expect(result.ok).toBe(true);
  });

  it('passes comment_id to octokit', async () => {
    mockIssuesDeleteComment.mockResolvedValue({});

    await deleteComment(500001);

    expect(mockIssuesDeleteComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 500001 }),
    );
  });

  it('passes owner and repo from getRepoInfo', async () => {
    mockIssuesDeleteComment.mockResolvedValue({});

    await deleteComment(500001);

    expect(mockIssuesDeleteComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('accepts an explicit repo override', async () => {
    mockIssuesDeleteComment.mockResolvedValue({});

    await deleteComment(500001, { owner: 'other-owner', repo: 'other-repo', isOrg: false });

    expect(mockIssuesDeleteComment).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('returns error result on API failure', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockIssuesDeleteComment.mockRejectedValue(err);

    const result = await deleteComment(9999);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns RATE_LIMITED error when rate-limited', async () => {
    const err = Object.assign(new Error('rate limit exceeded'), { status: 403 });
    mockIssuesDeleteComment.mockRejectedValue(err);

    const result = await deleteComment(500001);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('RATE_LIMITED');
  });
});
