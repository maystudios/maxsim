/**
 * Unit tests for thin/thin+ CLI command handlers in commands/github.ts.
 *
 * Tests the following 12 handlers:
 *   - get-issue (read-only, thin wrapper)
 *   - list-issues (read-only, thin wrapper)
 *   - list-sub-issues (read-only, thin wrapper)
 *   - post-comment (mutating, thin+ with body-file and type header)
 *   - close-issue (mutating, thin wrapper)
 *   - create-issue (mutating, thin+ with labels/milestone)
 *   - ensure-labels (mutating, thin wrapper)
 *   - set-project (config setter, thin wrapper)
 *   - create-milestone (mutating, thin wrapper)
 *   - post-plan-comment (mutating, thin+ with plan marker)
 *   - delete-comments (mutating, thin+ with type filtering)
 *   - move-issue (mutating, thin+ with project board)
 *
 * Strategy: mock the entire github module (issues, labels, projects, etc.)
 * and the core config/client modules, then call handlers directly with
 * controlled args arrays. Pattern matches github-commands-phase2.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// -- Hoisted mocks -------------------------------------------------------
// vi.mock() factories are hoisted by Vitest. Variables used inside them must
// be created via vi.hoisted() so they are initialised before the factory runs.

const {
  mockUpdateIssue,
  mockCloseIssue,
  mockAddLabelToIssue,
  mockRemoveLabelFromIssue,
  mockAddComment,
  mockListIssues,
  mockListSubIssues,
  mockGetIssue,
  mockCreateIssue,
  mockAddSubIssue,
  mockAddItemToProject,
  mockMoveItemToStatus,
  mockFindProject,
  mockEnsureLabels,
  mockListComments,
  mockDeleteComment,
  mockEnsureMilestone,
  mockGetRepoInfo,
  mockGhJson,
  mockLoadConfig,
  mockSaveConfig,
} = vi.hoisted(() => ({
  mockUpdateIssue: vi.fn(),
  mockCloseIssue: vi.fn(),
  mockAddLabelToIssue: vi.fn(),
  mockRemoveLabelFromIssue: vi.fn(),
  mockAddComment: vi.fn(),
  mockListIssues: vi.fn(),
  mockListSubIssues: vi.fn(),
  mockGetIssue: vi.fn(),
  mockCreateIssue: vi.fn(),
  mockAddSubIssue: vi.fn(),
  mockAddItemToProject: vi.fn(),
  mockMoveItemToStatus: vi.fn(),
  mockFindProject: vi.fn(),
  mockEnsureLabels: vi.fn(),
  mockListComments: vi.fn(),
  mockDeleteComment: vi.fn(),
  mockEnsureMilestone: vi.fn(),
  mockGetRepoInfo: vi.fn(),
  mockGhJson: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockSaveConfig: vi.fn(),
}));

// -- Module mocks ---------------------------------------------------------

vi.mock('../../src/github/issues.js', () => ({
  getIssue: mockGetIssue,
  listIssues: mockListIssues,
  listSubIssues: mockListSubIssues,
  listComments: mockListComments,
  addComment: mockAddComment,
  createIssue: mockCreateIssue,
  closeIssue: mockCloseIssue,
  updateIssue: mockUpdateIssue,
  deleteComment: mockDeleteComment,
  addSubIssue: mockAddSubIssue,
}));

vi.mock('../../src/github/labels.js', () => ({
  ensureLabels: mockEnsureLabels,
  addLabelToIssue: mockAddLabelToIssue,
  removeLabelFromIssue: mockRemoveLabelFromIssue,
}));

vi.mock('../../src/github/projects.js', () => ({
  addItemToProject: mockAddItemToProject,
  moveItemToStatus: mockMoveItemToStatus,
  findProject: mockFindProject,
}));

vi.mock('../../src/github/milestones.js', () => ({
  ensureMilestone: mockEnsureMilestone,
}));

vi.mock('../../src/github/client.js', () => ({
  getRepoInfo: mockGetRepoInfo,
  ghJson: mockGhJson,
}));

vi.mock('../../src/github/comments.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/github/comments.js')>();
  return {
    ...actual,
  };
});

vi.mock('../../src/core/config.js', () => ({
  loadConfig: mockLoadConfig,
  saveConfig: mockSaveConfig,
}));

// Import after mocks are established.
import { GITHUB_COMMANDS } from '../../src/commands/github.js';

// -- Helpers --------------------------------------------------------------

/** Default config returned by loadConfig mock. */
const DEFAULT_TEST_CONFIG = {
  github: {
    projectName: 'Test Project',
    project_number: 7,
    milestone_number: 1,
    auto_push: true,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepoInfo.mockReturnValue({ owner: 'test-owner', repo: 'test-repo', isOrg: false });
  mockLoadConfig.mockReturnValue(structuredClone(DEFAULT_TEST_CONFIG));
});

// -- get-issue ------------------------------------------------------------

describe('get-issue handler', () => {
  it('returns formatted issue data on success', async () => {
    mockGetIssue.mockResolvedValue({
      ok: true,
      data: {
        number: 42,
        title: 'Phase 1: Setup',
        state: 'open',
        stateReason: null,
        labels: [{ name: 'type:phase' }],
        htmlUrl: 'https://github.com/test-owner/test-repo/issues/42',
        body: 'Issue body text',
      },
    });

    const result = await GITHUB_COMMANDS['get-issue'].handler(['--issue-number', '42']);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('Issue #42');
    expect(result.result).toContain('Phase 1: Setup');
    expect(result.result).toContain('type:phase');

    expect(mockGetIssue).toHaveBeenCalledOnce();
    expect(mockGetIssue).toHaveBeenCalledWith(42);
  });

  it('includes comments when --include-comments is set', async () => {
    mockGetIssue.mockResolvedValue({
      ok: true,
      data: {
        number: 42,
        title: 'Phase 1: Setup',
        state: 'open',
        stateReason: null,
        labels: [],
        htmlUrl: 'https://github.com/test-owner/test-repo/issues/42',
        body: 'Body',
      },
    });
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        { id: 1, body: '<!-- maxsim:type=plan plan=1 -->\nPlan content', user: { login: 'bot' }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ],
    });

    const result = await GITHUB_COMMANDS['get-issue'].handler([
      '--issue-number', '42',
      '--include-comments',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('Comments (1)');
    expect(result.result).toContain('[type:plan]');
    expect(mockListComments).toHaveBeenCalledWith(42);
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['get-issue'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });
});

// -- list-issues ----------------------------------------------------------

describe('list-issues handler', () => {
  it('returns formatted table of issues on success', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [
        {
          number: 10,
          title: 'Phase 1: Core',
          state: 'open',
          labels: [{ name: 'type:phase' }],
        },
        {
          number: 11,
          title: 'Phase 2: Tests',
          state: 'closed',
          labels: [{ name: 'type:phase' }],
        },
      ],
    });

    const result = await GITHUB_COMMANDS['list-issues'].handler([
      '--label', 'type:phase',
      '--state', 'all',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('#10');
    expect(result.result).toContain('#11');
    expect(result.result).toContain('Phase 1: Core');

    expect(mockListIssues).toHaveBeenCalledWith({ labels: 'type:phase', state: 'all' });
  });

  it('returns empty message when no issues match', async () => {
    mockListIssues.mockResolvedValue({ ok: true, data: [] });

    const result = await GITHUB_COMMANDS['list-issues'].handler(['--state', 'open']);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('No issues found');
  });
});

// -- list-sub-issues ------------------------------------------------------

describe('list-sub-issues handler', () => {
  it('returns formatted table of sub-issues on success', async () => {
    mockListSubIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 50, title: 'Task 1.1: Init', state: 'closed' },
        { number: 51, title: 'Task 1.2: Config', state: 'open' },
      ],
    });

    const result = await GITHUB_COMMANDS['list-sub-issues'].handler([
      '--phase-issue-number', '42',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('#50');
    expect(result.result).toContain('#51');
    expect(result.result).toContain('Task 1.1: Init');

    expect(mockListSubIssues).toHaveBeenCalledWith(42);
  });

  it('returns error when --phase-issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['list-sub-issues'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--phase-issue-number');
  });
});

// -- post-comment ---------------------------------------------------------

describe('post-comment handler', () => {
  it('posts a plain comment and returns success', async () => {
    mockAddComment.mockResolvedValue({ ok: true, data: { id: 100 } });

    const result = await GITHUB_COMMANDS['post-comment'].handler([
      '--issue-number', '42',
      '--body', 'Hello world',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('#42');

    expect(mockAddComment).toHaveBeenCalledOnce();
    expect(mockAddComment).toHaveBeenCalledWith(42, 'Hello world');
  });

  it('prepends type header when --type is provided', async () => {
    mockAddComment.mockResolvedValue({ ok: true, data: { id: 101 } });

    const result = await GITHUB_COMMANDS['post-comment'].handler([
      '--issue-number', '42',
      '--body', 'My plan content',
      '--type', 'plan',
      '--plan-number', '3',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    const postedBody = mockAddComment.mock.calls[0][1] as string;
    expect(postedBody).toContain('maxsim:type=plan');
    expect(postedBody).toContain('plan=3');
    expect(postedBody).toContain('My plan content');
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['post-comment'].handler([
      '--body', 'Some text',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });

  it('returns error when neither --body nor --body-file is provided', async () => {
    const result = await GITHUB_COMMANDS['post-comment'].handler([
      '--issue-number', '42',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--body');
  });
});

// -- close-issue ----------------------------------------------------------

describe('close-issue handler', () => {
  it('closes an issue and returns success message', async () => {
    mockCloseIssue.mockResolvedValue({ ok: true, data: { number: 42 } });

    const result = await GITHUB_COMMANDS['close-issue'].handler([
      '--issue-number', '42',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('42');
    expect(result.result).toContain('closed');

    expect(mockCloseIssue).toHaveBeenCalledOnce();
    expect(mockCloseIssue).toHaveBeenCalledWith(42, 'completed');
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['close-issue'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });
});

// -- create-issue ---------------------------------------------------------

describe('create-issue handler', () => {
  it('creates an issue with title and returns success', async () => {
    mockCreateIssue.mockResolvedValue({
      ok: true,
      data: { number: 99, title: 'New Feature' },
    });

    const result = await GITHUB_COMMANDS['create-issue'].handler([
      '--title', 'New Feature',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('#99');
    expect(result.result).toContain('New Feature');

    expect(mockCreateIssue).toHaveBeenCalledOnce();
    expect(mockCreateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'New Feature' }),
    );
  });

  it('passes labels and milestone when provided', async () => {
    mockCreateIssue.mockResolvedValue({
      ok: true,
      data: { number: 100, title: 'Task' },
    });

    const result = await GITHUB_COMMANDS['create-issue'].handler([
      '--title', 'Task',
      '--body', 'Description',
      '--label', 'type:task',
      '--label', 'wave:1',
      '--milestone', '5',
    ]);

    expect(result.ok).toBe(true);

    expect(mockCreateIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Task',
        body: 'Description',
        labels: ['type:task', 'wave:1'],
        milestone: 5,
      }),
    );
  });

  it('returns error when --title is missing', async () => {
    const result = await GITHUB_COMMANDS['create-issue'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--title');
  });
});

// -- ensure-labels --------------------------------------------------------

describe('ensure-labels handler', () => {
  it('returns summary of created and existing labels', async () => {
    mockEnsureLabels.mockResolvedValue({
      ok: true,
      data: { created: ['new-label'], existing: ['type:phase', 'type:task'] },
    });

    const result = await GITHUB_COMMANDS['ensure-labels'].handler([]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('1 created');
    expect(result.result).toContain('2 existing');

    expect(mockEnsureLabels).toHaveBeenCalledOnce();
  });
});

// -- set-project ----------------------------------------------------------

describe('set-project handler', () => {
  it('updates config with project number and returns success', async () => {
    const result = await GITHUB_COMMANDS['set-project'].handler([
      '--project-number', '4',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('4');

    expect(mockSaveConfig).toHaveBeenCalledOnce();
    // Verify the config was mutated and saved with the new project number
    const savedConfig = mockSaveConfig.mock.calls[0][1];
    expect(savedConfig.github.project_number).toBe(4);
  });

  it('returns error when --project-number is missing', async () => {
    const result = await GITHUB_COMMANDS['set-project'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--project-number');
  });
});

// -- create-milestone -----------------------------------------------------

describe('create-milestone handler', () => {
  it('creates a milestone and returns success', async () => {
    mockEnsureMilestone.mockResolvedValue({
      ok: true,
      data: { number: 3, title: 'v1.0' },
    });

    const result = await GITHUB_COMMANDS['create-milestone'].handler([
      '--title', 'v1.0',
      '--description', 'First release',
      '--due-date', '2026-06-01',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('#3');
    expect(result.result).toContain('v1.0');

    expect(mockEnsureMilestone).toHaveBeenCalledOnce();
    expect(mockEnsureMilestone).toHaveBeenCalledWith({
      title: 'v1.0',
      description: 'First release',
      dueOn: '2026-06-01',
    });
  });

  it('returns error when --title is missing', async () => {
    const result = await GITHUB_COMMANDS['create-milestone'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--title');
  });
});

// -- post-plan-comment ----------------------------------------------------

describe('post-plan-comment handler', () => {
  it('posts a plan comment with maxsim type marker and returns success', async () => {
    mockAddComment.mockResolvedValue({ ok: true, data: { id: 200 } });

    const result = await GITHUB_COMMANDS['post-plan-comment'].handler([
      '--issue-number', '42',
      '--plan-number', '1',
      '--body', 'Plan content here',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('Plan 1');
    expect(result.result).toContain('#42');

    expect(mockAddComment).toHaveBeenCalledOnce();
    const postedBody = mockAddComment.mock.calls[0][1] as string;
    expect(postedBody).toContain('<!-- maxsim:type=plan plan=1 -->');
    expect(postedBody).toContain('Plan content here');
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['post-plan-comment'].handler([
      '--plan-number', '1',
      '--body', 'content',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });

  it('returns error when --body is empty and no --body-file', async () => {
    const result = await GITHUB_COMMANDS['post-plan-comment'].handler([
      '--issue-number', '42',
      '--plan-number', '1',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--body');
  });
});

// -- delete-comments ------------------------------------------------------

describe('delete-comments handler', () => {
  it('deletes matching typed comments and returns count', async () => {
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        { id: 1, body: '<!-- maxsim:type=plan plan=1 -->\nPlan A', user: { login: 'bot' }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 2, body: '<!-- maxsim:type=context -->\nContext info', user: { login: 'bot' }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
        { id: 3, body: 'Regular comment without marker', user: { login: 'user' }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ],
    });
    mockDeleteComment.mockResolvedValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['delete-comments'].handler([
      '--issue-number', '42',
      '--type', 'plan,context',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('Deleted 2');
    expect(result.result).toContain('plan');
    expect(result.result).toContain('context');

    expect(mockDeleteComment).toHaveBeenCalledTimes(2);
    expect(mockDeleteComment).toHaveBeenCalledWith(1);
    expect(mockDeleteComment).toHaveBeenCalledWith(2);
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['delete-comments'].handler([
      '--type', 'plan',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });

  it('returns error when --type is missing', async () => {
    const result = await GITHUB_COMMANDS['delete-comments'].handler([
      '--issue-number', '42',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--type');
  });

  it('handles case when no comments match the type', async () => {
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        { id: 1, body: 'No maxsim marker here', user: { login: 'user' }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      ],
    });

    const result = await GITHUB_COMMANDS['delete-comments'].handler([
      '--issue-number', '42',
      '--type', 'plan',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('Deleted 0');
    expect(mockDeleteComment).not.toHaveBeenCalled();
  });
});

// -- move-issue -----------------------------------------------------------

describe('move-issue handler', () => {
  it('adds issue to project and moves to specified status', async () => {
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_xyz' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['move-issue'].handler([
      '--issue-number', '42',
      '--status', 'In Progress',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('#42');
    expect(result.result).toContain('In Progress');

    expect(mockAddItemToProject).toHaveBeenCalledWith(
      7,
      'https://github.com/test-owner/test-repo/issues/42',
    );
    expect(mockMoveItemToStatus).toHaveBeenCalledWith(7, 'PVTI_xyz', 'In Progress');
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['move-issue'].handler([
      '--status', 'Done',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });

  it('returns error when --status is missing', async () => {
    const result = await GITHUB_COMMANDS['move-issue'].handler([
      '--issue-number', '42',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--status');
  });

  it('returns error when project number is not configured', async () => {
    mockLoadConfig.mockReturnValue({
      github: {
        projectName: '',
        project_number: undefined,
        milestone_number: 1,
        auto_push: true,
      },
    });

    const result = await GITHUB_COMMANDS['move-issue'].handler([
      '--issue-number', '42',
      '--status', 'Done',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('not configured');
  });
});
