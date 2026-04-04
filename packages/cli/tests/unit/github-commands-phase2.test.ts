/**
 * Unit tests for Phase 2 CLI command handlers in commands/github.ts.
 *
 * Tests the following new/enhanced commands:
 *   - reopen-issue
 *   - add-label
 *   - remove-label
 *   - handle-verification-failure
 *   - handle-verification-success
 *   - status (argument validation)
 *   - create-phase (argument validation)
 *   - batch-create-tasks (argument validation)
 *   - detect-external-edits (argument validation)
 *   - all-progress (basic behavior)
 *
 * Strategy: mock the entire github module (issues, labels, projects, etc.)
 * and the core config/client modules, then call handlers directly with
 * controlled args arrays.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────
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
  mockReadFileSync,
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
  mockReadFileSync: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────────

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

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: mockReadFileSync,
  };
});

// Import after mocks are established.
import { GITHUB_COMMANDS } from '../../src/commands/github.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── reopen-issue ─────────────────────────────────────────────────────────────

describe('reopen-issue handler', () => {
  it('calls updateIssue with state:open and returns success message', async () => {
    mockUpdateIssue.mockResolvedValue({ ok: true, data: { number: 42 } });

    const result = await GITHUB_COMMANDS['reopen-issue'].handler(['--issue-number', '42']);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('42');
    expect(result.result).toContain('reopened');

    expect(mockUpdateIssue).toHaveBeenCalledOnce();
    expect(mockUpdateIssue).toHaveBeenCalledWith(42, { state: 'open' });
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['reopen-issue'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });

  it('returns error when --issue-number is not a valid integer', async () => {
    const result = await GITHUB_COMMANDS['reopen-issue'].handler(['--issue-number', 'abc']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });

  it('returns error when updateIssue fails', async () => {
    mockUpdateIssue.mockResolvedValue({ ok: false, error: 'Not Found', code: 'NOT_FOUND' });

    const result = await GITHUB_COMMANDS['reopen-issue'].handler(['--issue-number', '99']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Not Found');
  });
});

// ── add-label ────────────────────────────────────────────────────────────────

describe('add-label handler', () => {
  it('calls addLabelToIssue with correct params and returns success', async () => {
    mockAddLabelToIssue.mockResolvedValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['add-label'].handler([
      '--issue-number', '42',
      '--label', 'verification:failed',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('verification:failed');
    expect(result.result).toContain('42');

    expect(mockAddLabelToIssue).toHaveBeenCalledOnce();
    expect(mockAddLabelToIssue).toHaveBeenCalledWith(42, 'verification:failed');
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['add-label'].handler(['--label', 'type:task']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });

  it('returns error when --label is missing', async () => {
    const result = await GITHUB_COMMANDS['add-label'].handler(['--issue-number', '42']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--label');
  });

  it('returns error when addLabelToIssue fails', async () => {
    mockAddLabelToIssue.mockResolvedValue({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });

    const result = await GITHUB_COMMANDS['add-label'].handler([
      '--issue-number', '42',
      '--label', 'type:task',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Unauthorized');
  });
});

// ── remove-label ─────────────────────────────────────────────────────────────

describe('remove-label handler', () => {
  it('calls removeLabelFromIssue with correct params and returns success', async () => {
    mockRemoveLabelFromIssue.mockResolvedValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['remove-label'].handler([
      '--issue-number', '42',
      '--label', 'verification:failed',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('verification:failed');
    expect(result.result).toContain('42');

    expect(mockRemoveLabelFromIssue).toHaveBeenCalledOnce();
    expect(mockRemoveLabelFromIssue).toHaveBeenCalledWith(42, 'verification:failed');
  });

  it('returns error when --issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['remove-label'].handler(['--label', 'type:task']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--issue-number');
  });

  it('returns error when --label is missing', async () => {
    const result = await GITHUB_COMMANDS['remove-label'].handler(['--issue-number', '42']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--label');
  });

  it('returns error when removeLabelFromIssue fails', async () => {
    mockRemoveLabelFromIssue.mockResolvedValue({ ok: false, error: 'Server Error', code: 'UNKNOWN' });

    const result = await GITHUB_COMMANDS['remove-label'].handler([
      '--issue-number', '42',
      '--label', 'type:task',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Server Error');
  });
});

// ── handle-verification-failure ──────────────────────────────────────────────

describe('handle-verification-failure handler', () => {
  it('calls reopen + addLabel + addComment and returns action log', async () => {
    mockUpdateIssue.mockResolvedValue({ ok: true, data: { number: 216 } });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_abc' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });
    mockAddLabelToIssue.mockResolvedValue({ ok: true, data: undefined });
    mockAddComment.mockResolvedValue({ ok: true, data: { id: 1 } });

    const result = await GITHUB_COMMANDS['handle-verification-failure'].handler([
      '--phase-issue-number', '216',
      '--reason', 'tests failed',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    const output = result.result as string;
    expect(output).toContain('Reopened phase issue #216');
    expect(output).toContain('verification:failed');
    expect(output).toContain('error comment');

    // Verify calls
    expect(mockUpdateIssue).toHaveBeenCalledWith(216, { state: 'open' });
    expect(mockAddLabelToIssue).toHaveBeenCalledWith(216, 'verification:failed');
    expect(mockAddComment).toHaveBeenCalledOnce();
  });

  it('reopens specified task sub-issues when --task-numbers provided', async () => {
    mockUpdateIssue.mockResolvedValue({ ok: true, data: {} });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_abc' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });
    mockAddLabelToIssue.mockResolvedValue({ ok: true, data: undefined });
    mockAddComment.mockResolvedValue({ ok: true, data: { id: 1 } });

    const result = await GITHUB_COMMANDS['handle-verification-failure'].handler([
      '--phase-issue-number', '216',
      '--reason', 'lint failed',
      '--task-numbers', '253,254',
    ]);

    expect(result.ok).toBe(true);

    // Phase issue + 2 task issues = 3 updateIssue calls
    expect(mockUpdateIssue).toHaveBeenCalledTimes(3);
    expect(mockUpdateIssue).toHaveBeenCalledWith(253, { state: 'open' });
    expect(mockUpdateIssue).toHaveBeenCalledWith(254, { state: 'open' });
  });

  it('returns error when --phase-issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['handle-verification-failure'].handler([
      '--reason', 'tests failed',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--phase-issue-number');
  });

  it('returns error when --reason is missing', async () => {
    const result = await GITHUB_COMMANDS['handle-verification-failure'].handler([
      '--phase-issue-number', '216',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--reason');
  });

  it('returns error when phase reopen fails', async () => {
    mockUpdateIssue.mockResolvedValue({ ok: false, error: 'Not Found', code: 'NOT_FOUND' });

    const result = await GITHUB_COMMANDS['handle-verification-failure'].handler([
      '--phase-issue-number', '216',
      '--reason', 'tests failed',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('reopen');
  });

  it('returns error when --phase-issue-number is not a valid integer', async () => {
    const result = await GITHUB_COMMANDS['handle-verification-failure'].handler([
      '--phase-issue-number', 'abc',
      '--reason', 'tests failed',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });
});

// ── handle-verification-success ──────────────────────────────────────────────

describe('handle-verification-success handler', () => {
  it('calls removeLabel + close + addComment and returns action log', async () => {
    mockRemoveLabelFromIssue.mockResolvedValue({ ok: true, data: undefined });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_abc' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });
    mockCloseIssue.mockResolvedValue({ ok: true, data: { number: 216 } });
    mockAddComment.mockResolvedValue({ ok: true, data: { id: 2 } });

    const result = await GITHUB_COMMANDS['handle-verification-success'].handler([
      '--phase-issue-number', '216',
      '--summary', 'all criteria met',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    const output = result.result as string;
    expect(output).toContain('verification:failed');
    expect(output).toContain('Closed phase issue #216');
    expect(output).toContain('phase-complete comment');

    // Verify calls
    expect(mockRemoveLabelFromIssue).toHaveBeenCalledWith(216, 'verification:failed');
    expect(mockCloseIssue).toHaveBeenCalledWith(216);
    expect(mockAddComment).toHaveBeenCalledOnce();
  });

  it('uses default summary when --summary is not provided', async () => {
    mockRemoveLabelFromIssue.mockResolvedValue({ ok: true, data: undefined });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_abc' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });
    mockCloseIssue.mockResolvedValue({ ok: true, data: {} });
    mockAddComment.mockResolvedValue({ ok: true, data: { id: 3 } });

    await GITHUB_COMMANDS['handle-verification-success'].handler([
      '--phase-issue-number', '216',
    ]);

    // The comment body should contain default "Verification passed."
    const commentBody = mockAddComment.mock.calls[0][1] as string;
    expect(commentBody).toContain('Verification passed.');
  });

  it('returns error when --phase-issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['handle-verification-success'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--phase-issue-number');
  });

  it('returns error when closeIssue fails', async () => {
    mockRemoveLabelFromIssue.mockResolvedValue({ ok: true, data: undefined });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_abc' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });
    mockCloseIssue.mockResolvedValue({ ok: false, error: 'Forbidden', code: 'FORBIDDEN' });

    const result = await GITHUB_COMMANDS['handle-verification-success'].handler([
      '--phase-issue-number', '216',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('close');
  });

  it('moves phase to Done on the board before closing', async () => {
    mockRemoveLabelFromIssue.mockResolvedValue({ ok: true, data: undefined });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_abc' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });
    mockCloseIssue.mockResolvedValue({ ok: true, data: {} });
    mockAddComment.mockResolvedValue({ ok: true, data: { id: 4 } });

    const result = await GITHUB_COMMANDS['handle-verification-success'].handler([
      '--phase-issue-number', '216',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Done');

    expect(mockMoveItemToStatus).toHaveBeenCalledWith(
      7,
      'PVTI_abc',
      'Done',
    );
  });
});

// ── status (argument validation + composite tests) ──────────────────────────

describe('status handler argument validation', () => {
  it('returns error when --phase-number is not a valid integer', async () => {
    const result = await GITHUB_COMMANDS.status.handler(['--phase-number', 'abc']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });
});

describe('status handler — single-phase happy path', () => {
  it('returns phase header, task list, and acceptance criteria', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 100, title: 'Phase 3: Test Coverage', state: 'open', labels: [] },
      ],
    });
    mockGetIssue.mockResolvedValue({
      ok: true,
      data: {
        number: 100,
        title: 'Phase 3: Test Coverage',
        state: 'open',
        body: '## Acceptance Criteria\n- [x] All tests pass\n- [ ] Coverage above 80%',
        labels: [],
        htmlUrl: 'https://github.com/test/test/issues/100',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    mockListSubIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 101, title: 'Task 3.1: Write unit tests', state: 'closed' },
        { number: 102, title: 'Task 3.2: Write integration tests', state: 'open' },
      ],
    });

    const result = await GITHUB_COMMANDS.status.handler(['--phase-number', '3']);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Phase 3');
    expect(output).toContain('Test Coverage');
    expect(output).toContain('Tasks (1/2)');
    expect(output).toContain('#101');
    expect(output).toContain('#102');
    expect(output).toContain('All tests pass');
    expect(output).toContain('Coverage above 80%');
  });
});

describe('status handler — all-phases happy path', () => {
  it('returns connectivity info and phase list when no --phase-number', async () => {
    mockFindProject.mockReturnValue({
      ok: true,
      data: { number: 7, title: 'Test Project' },
    });
    mockEnsureLabels.mockResolvedValue({
      ok: true,
      data: { created: [], existing: ['type:phase', 'type:task'] },
    });
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 100, title: 'Phase 1: Setup', state: 'closed', labels: [] },
        { number: 200, title: 'Phase 2: Core', state: 'open', labels: [] },
      ],
    });
    mockListSubIssues
      .mockResolvedValueOnce({ ok: true, data: [{ number: 101, state: 'closed' }] })
      .mockResolvedValueOnce({ ok: true, data: [{ number: 201, state: 'open' }, { number: 202, state: 'closed' }] });

    const result = await GITHUB_COMMANDS.status.handler([]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('test-owner/test-repo');
    expect(output).toContain('Auth: OK');
    expect(output).toContain('Phase 1');
    expect(output).toContain('Phase 2');
    expect(output).toContain('DONE');
    expect(output).toContain('OPEN');
  });
});

describe('status handler — phase not found', () => {
  it('returns error when the requested phase does not exist', async () => {
    mockListIssues.mockResolvedValue({ ok: true, data: [] });

    const result = await GITHUB_COMMANDS.status.handler(['--phase-number', '99']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Phase issue not found');
  });
});

describe('status handler — degraded mode', () => {
  it('returns partial output when phase list fetch fails in all-phases mode', async () => {
    mockFindProject.mockReturnValue({ ok: false, error: 'not found' });
    mockEnsureLabels.mockResolvedValue({
      ok: true,
      data: { created: [], existing: [] },
    });
    mockListIssues.mockResolvedValue({ ok: false, error: 'Rate limited', code: 'RATE_LIMITED' });

    const result = await GITHUB_COMMANDS.status.handler([]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    // Even when phase fetch fails, connectivity info is shown
    expect(output).toContain('test-owner/test-repo');
    expect(output).toContain('could not fetch phase issues');
  });
});

describe('status handler — drift warning', () => {
  it('warns when all tasks closed but acceptance criteria remain unchecked', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [{ number: 50, title: 'Phase 1: Init', state: 'open', labels: [] }],
    });
    mockGetIssue.mockResolvedValue({
      ok: true,
      data: {
        number: 50,
        title: 'Phase 1: Init',
        state: 'open',
        body: '## Acceptance Criteria\n- [x] Setup done\n- [ ] Docs written',
        labels: [],
        htmlUrl: 'https://github.com/test/test/issues/50',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    mockListSubIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 51, title: 'Task 1.1: Setup', state: 'closed' },
        { number: 52, title: 'Task 1.2: Config', state: 'closed' },
      ],
    });

    const result = await GITHUB_COMMANDS.status.handler(['--phase-number', '1']);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('WARNING');
    expect(output).toContain('drift');
    expect(output).toContain('1 acceptance criteria remain unchecked');
  });
});

// ── create-phase (argument validation + composite tests) ─────────────────────

describe('create-phase handler argument validation', () => {
  it('returns error when --phase-number is missing', async () => {
    const result = await GITHUB_COMMANDS['create-phase'].handler([
      '--title', 'Test Phase',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--phase-number');
  });

  it('returns error when --title is missing', async () => {
    const result = await GITHUB_COMMANDS['create-phase'].handler([
      '--phase-number', '1',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--title');
  });

  it('returns error when --phase-number is not a valid integer', async () => {
    const result = await GITHUB_COMMANDS['create-phase'].handler([
      '--phase-number', 'abc',
      '--title', 'Test Phase',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });
});

describe('create-phase handler — happy path', () => {
  it('creates issue with labels, milestone, and board placement', async () => {
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockCreateIssue.mockResolvedValue({
      ok: true,
      data: { number: 300, title: 'Phase 5: Deploy', labels: [] },
    });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_xyz' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['create-phase'].handler([
      '--phase-number', '5',
      '--title', 'Deploy',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Created Phase #300');
    expect(output).toContain('Phase 5: Deploy');

    // Verify createIssue was called with correct labels
    expect(mockCreateIssue).toHaveBeenCalledOnce();
    const createArgs = mockCreateIssue.mock.calls[0][0];
    expect(createArgs.title).toContain('Phase 5: Deploy');
    expect(createArgs.labels).toContain('type:phase');
    expect(createArgs.labels).toContain('maxsim:auto');

    // Verify board operations
    expect(mockAddItemToProject).toHaveBeenCalledOnce();
    expect(mockMoveItemToStatus).toHaveBeenCalledWith(7, 'PVTI_xyz', 'To Do');
  });
});

describe('create-phase handler — no project configured', () => {
  it('creates issue without board placement when no project_number', async () => {
    mockLoadConfig.mockReturnValue({
      github: {
        projectName: '',
        project_number: undefined,
        milestone_number: 1,
        auto_push: true,
      },
    });
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockCreateIssue.mockResolvedValue({
      ok: true,
      data: { number: 301, title: 'Phase 6: Polish', labels: [] },
    });

    const result = await GITHUB_COMMANDS['create-phase'].handler([
      '--phase-number', '6',
      '--title', 'Polish',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(mockAddItemToProject).not.toHaveBeenCalled();
    expect(mockMoveItemToStatus).not.toHaveBeenCalled();
  });
});

describe('create-phase handler — board add fails', () => {
  it('returns success with warning when board add fails', async () => {
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockCreateIssue.mockResolvedValue({
      ok: true,
      data: { number: 302, title: 'Phase 7: Release', labels: [] },
    });
    mockAddItemToProject.mockReturnValue({ ok: false, error: 'Project not found' });

    const result = await GITHUB_COMMANDS['create-phase'].handler([
      '--phase-number', '7',
      '--title', 'Release',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Created Phase #302');
    expect(output).toContain('Warning');
    expect(output).toContain('could not add to project board');
  });
});

describe('create-phase handler — board move fails', () => {
  it('returns success with warning when board move fails', async () => {
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockCreateIssue.mockResolvedValue({
      ok: true,
      data: { number: 303, title: 'Phase 8: Hardening', labels: [] },
    });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_fail' } });
    mockMoveItemToStatus.mockReturnValue({ ok: false, error: 'Invalid status column' });

    const result = await GITHUB_COMMANDS['create-phase'].handler([
      '--phase-number', '8',
      '--title', 'Hardening',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Created Phase #303');
    expect(output).toContain('Warning');
    expect(output).toContain('could not move to "To Do"');
  });
});

describe('create-phase handler — createIssue fails', () => {
  it('returns error when issue creation fails', async () => {
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockCreateIssue.mockResolvedValue({ ok: false, error: 'Validation Failed', code: 'VALIDATION_ERROR' });

    const result = await GITHUB_COMMANDS['create-phase'].handler([
      '--phase-number', '9',
      '--title', 'Broken Phase',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Validation Failed');
  });
});

// ── batch-create-tasks (argument validation + composite tests) ───────────────

describe('batch-create-tasks handler argument validation', () => {
  it('returns error when --phase-issue-number is missing', async () => {
    const result = await GITHUB_COMMANDS['batch-create-tasks'].handler([
      '--tasks-file', '/tmp/tasks.json',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--phase-issue-number');
  });

  it('returns error when --tasks-file is missing', async () => {
    const result = await GITHUB_COMMANDS['batch-create-tasks'].handler([
      '--phase-issue-number', '216',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--tasks-file');
  });

  it('returns error when --phase-issue-number is not a valid integer', async () => {
    const result = await GITHUB_COMMANDS['batch-create-tasks'].handler([
      '--phase-issue-number', 'abc',
      '--tasks-file', '/tmp/tasks.json',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });
});

describe('batch-create-tasks handler — happy path', () => {
  it('creates tasks, links as sub-issues, and adds to board', async () => {
    const tasksJson = JSON.stringify([
      { title: 'Task A', body: 'Body A' },
      { title: 'Task B', body: 'Body B', labels: ['priority:high'], wave: 1 },
    ]);
    mockReadFileSync.mockReturnValue(tasksJson);
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockListSubIssues.mockResolvedValue({ ok: true, data: [] });
    mockCreateIssue
      .mockResolvedValueOnce({ ok: true, data: { number: 401, title: 'Task A' } })
      .mockResolvedValueOnce({ ok: true, data: { number: 402, title: 'Task B' } });
    mockAddSubIssue
      .mockResolvedValueOnce({ ok: true, data: {} })
      .mockResolvedValueOnce({ ok: true, data: {} });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_t1' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['batch-create-tasks'].handler([
      '--phase-issue-number', '216',
      '--tasks-file', '/tmp/tasks.json',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Created 2 tasks');
    expect(output).toContain('#401');
    expect(output).toContain('#402');
    expect(output).toContain('#216');

    // Verify labels include auto-labels and wave
    const secondCallLabels = mockCreateIssue.mock.calls[1][0].labels;
    expect(secondCallLabels).toContain('type:task');
    expect(secondCallLabels).toContain('maxsim:auto');
    expect(secondCallLabels).toContain('priority:high');
    expect(secondCallLabels).toContain('wave:1');

    // Verify sub-issue linking
    expect(mockAddSubIssue).toHaveBeenCalledTimes(2);
    expect(mockAddSubIssue).toHaveBeenCalledWith(216, 401);
    expect(mockAddSubIssue).toHaveBeenCalledWith(216, 402);
  });
});

describe('batch-create-tasks handler — dedup logic', () => {
  it('skips tasks that already exist as sub-issues (case-insensitive)', async () => {
    const tasksJson = JSON.stringify([
      { title: 'Task A', body: 'Body A' },
      { title: 'Task B', body: 'Body B' },
      { title: 'Task C', body: 'Body C' },
    ]);
    mockReadFileSync.mockReturnValue(tasksJson);
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockListSubIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 400, title: 'task a', state: 'open' },  // matches "Task A" case-insensitively
      ],
    });
    mockCreateIssue
      .mockResolvedValueOnce({ ok: true, data: { number: 501, title: 'Task B' } })
      .mockResolvedValueOnce({ ok: true, data: { number: 502, title: 'Task C' } });
    mockAddSubIssue.mockResolvedValue({ ok: true, data: {} });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_d1' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['batch-create-tasks'].handler([
      '--phase-issue-number', '216',
      '--tasks-file', '/tmp/tasks.json',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Created 2 tasks');
    expect(output).toContain('1 skipped: duplicate');

    // Only 2 issues should have been created (not 3)
    expect(mockCreateIssue).toHaveBeenCalledTimes(2);
  });
});

describe('batch-create-tasks handler — partial failure', () => {
  it('continues creating remaining tasks when one fails', async () => {
    const tasksJson = JSON.stringify([
      { title: 'Task OK', body: 'ok' },
      { title: 'Task FAIL', body: 'fail' },
      { title: 'Task OK 2', body: 'ok2' },
    ]);
    mockReadFileSync.mockReturnValue(tasksJson);
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockListSubIssues.mockResolvedValue({ ok: true, data: [] });
    mockCreateIssue
      .mockResolvedValueOnce({ ok: true, data: { number: 601, title: 'Task OK' } })
      .mockResolvedValueOnce({ ok: false, error: 'Server Error', code: 'UNKNOWN' })
      .mockResolvedValueOnce({ ok: true, data: { number: 603, title: 'Task OK 2' } });
    mockAddSubIssue.mockResolvedValue({ ok: true, data: {} });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_p1' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['batch-create-tasks'].handler([
      '--phase-issue-number', '216',
      '--tasks-file', '/tmp/tasks.json',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Created 2 tasks');
    expect(output).toContain('1 errors');
    expect(output).toContain('Failed to create "Task FAIL"');
  });
});

describe('batch-create-tasks handler — sub-issue link failure', () => {
  it('reports error when sub-issue linking fails but issue was created', async () => {
    const tasksJson = JSON.stringify([
      { title: 'Task Link Fail', body: 'body' },
    ]);
    mockReadFileSync.mockReturnValue(tasksJson);
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockListSubIssues.mockResolvedValue({ ok: true, data: [] });
    mockCreateIssue.mockResolvedValue({ ok: true, data: { number: 701, title: 'Task Link Fail' } });
    mockAddSubIssue.mockResolvedValue({ ok: false, error: 'Parent not found', code: 'NOT_FOUND' });
    mockAddItemToProject.mockReturnValue({ ok: true, data: { itemId: 'PVTI_lf' } });
    mockMoveItemToStatus.mockReturnValue({ ok: true, data: undefined });

    const result = await GITHUB_COMMANDS['batch-create-tasks'].handler([
      '--phase-issue-number', '216',
      '--tasks-file', '/tmp/tasks.json',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Created 1 tasks');
    expect(output).toContain('1 errors');
    expect(output).toContain('#701');
    expect(output).toContain('failed to link as sub-issue');
  });
});

describe('batch-create-tasks handler — full dedup', () => {
  it('reports 0 created when all tasks are duplicates', async () => {
    const tasksJson = JSON.stringify([
      { title: 'Existing Task', body: 'body' },
    ]);
    mockReadFileSync.mockReturnValue(tasksJson);
    mockEnsureLabels.mockResolvedValue({ ok: true, data: { created: [], existing: [] } });
    mockListSubIssues.mockResolvedValue({
      ok: true,
      data: [{ number: 800, title: 'existing task', state: 'open' }],
    });

    const result = await GITHUB_COMMANDS['batch-create-tasks'].handler([
      '--phase-issue-number', '216',
      '--tasks-file', '/tmp/tasks.json',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Created 0 tasks');
    expect(output).toContain('1 skipped: duplicate');
    expect(mockCreateIssue).not.toHaveBeenCalled();
  });
});

// ── all-progress (composite tests) ──────────────────────────────────────────

describe('all-progress handler — basic behavior', () => {
  it('returns message when no phase issues exist', async () => {
    mockListIssues.mockResolvedValue({ ok: true, data: [] });

    const result = await GITHUB_COMMANDS['all-progress'].handler([]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.result).toContain('No phase issues found');
  });

  it('returns error when listIssues fails', async () => {
    mockListIssues.mockResolvedValue({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' });

    const result = await GITHUB_COMMANDS['all-progress'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Unauthorized');
  });
});

describe('all-progress handler — multi-phase report', () => {
  it('shows progress for multiple phases sorted by phase number', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 200, title: 'Phase 2: Core', state: 'open', labels: [] },
        { number: 100, title: 'Phase 1: Setup', state: 'closed', labels: [] },
        { number: 300, title: 'Phase 3: Polish', state: 'open', labels: [] },
      ],
    });
    // Mock responses align with sorted order: Phase 1, Phase 2, Phase 3
    mockListSubIssues
      .mockResolvedValueOnce({
        ok: true,
        data: [{ number: 101, title: 'Task 1.1', state: 'closed' }],
      })
      .mockResolvedValueOnce({
        ok: true,
        data: [
          { number: 201, title: 'Task 2.1', state: 'closed' },
          { number: 202, title: 'Task 2.2', state: 'open' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        data: [
          { number: 301, title: 'Task 3.1', state: 'open' },
          { number: 302, title: 'Task 3.2', state: 'open' },
        ],
      });

    const result = await GITHUB_COMMANDS['all-progress'].handler([]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Milestone Progress');
    // Phase 1 should appear as Complete
    expect(output).toContain('Phase 1');
    expect(output).toContain('Complete');
    // Phase 2 should appear as In Progress
    expect(output).toContain('Phase 2');
    expect(output).toContain('In Progress');
    // Phase 3 should appear as Not started (no closed tasks)
    expect(output).toContain('Phase 3');
    expect(output).toContain('Not started');
    // Overall progress bar should exist
    expect(output).toContain('Overall');
  });
});

describe('all-progress handler — sub-issue fetch failure', () => {
  it('shows warning for phase whose sub-issues could not be fetched', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 100, title: 'Phase 1: Setup', state: 'open', labels: [] },
      ],
    });
    mockListSubIssues.mockResolvedValueOnce({
      ok: false,
      error: 'Server Error',
      code: 'UNKNOWN',
    });

    const result = await GITHUB_COMMANDS['all-progress'].handler([]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('could not fetch tasks');
  });
});

describe('all-progress handler — all phases complete', () => {
  it('shows 100% progress when all phases and tasks are closed', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [
        { number: 100, title: 'Phase 1: Setup', state: 'closed', labels: [] },
      ],
    });
    mockListSubIssues.mockResolvedValueOnce({
      ok: true,
      data: [
        { number: 101, title: 'Task 1.1', state: 'closed' },
        { number: 102, title: 'Task 1.2', state: 'closed' },
      ],
    });

    const result = await GITHUB_COMMANDS['all-progress'].handler([]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Complete');
    expect(output).toContain('2/2');
    expect(output).toContain('100%');
  });
});

// ── detect-external-edits (argument validation + composite tests) ────────────

describe('detect-external-edits handler argument validation', () => {
  it('returns error when --phase-number is missing', async () => {
    const result = await GITHUB_COMMANDS['detect-external-edits'].handler([]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('--phase-number');
  });

  it('returns error when --phase-number is not a valid integer', async () => {
    const result = await GITHUB_COMMANDS['detect-external-edits'].handler([
      '--phase-number', 'abc',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });
});

describe('detect-external-edits handler — no edits detected', () => {
  it('reports no external edits when everything is clean', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [{ number: 100, title: 'Phase 1: Setup', state: 'open', labels: [] }],
    });
    mockGetIssue.mockResolvedValue({
      ok: true,
      data: {
        number: 100,
        title: 'Phase 1: Setup',
        state: 'open',
        body: 'Phase body',
        updatedAt: '2026-01-01T10:00:00Z',
        labels: [],
        htmlUrl: 'https://github.com/test/test/issues/100',
      },
    });
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 1,
          body: '<!-- maxsim:type=plan plan=1 -->\nSome plan content',
          createdAt: '2026-01-01T11:00:00Z',
          updatedAt: '2026-01-01T11:00:00Z',
          user: { login: 'maxsim-bot' },
        },
      ],
    });
    // Events: only automation actors
    mockGhJson.mockReturnValue({
      ok: true,
      data: [
        {
          event: 'labeled',
          created_at: '2026-01-01T10:00:00Z',
          actor: { login: 'github-actions[bot]' },
          label: { name: 'type:phase' },
        },
      ],
    });

    const result = await GITHUB_COMMANDS['detect-external-edits'].handler([
      '--phase-number', '1',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('No external edits detected');
  });
});

describe('detect-external-edits handler — body edit detected', () => {
  it('reports body edit when issue updatedAt is after last maxsim comment', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [{ number: 100, title: 'Phase 1: Setup', state: 'open', labels: [] }],
    });
    mockGetIssue.mockResolvedValue({
      ok: true,
      data: {
        number: 100,
        title: 'Phase 1: Setup',
        state: 'open',
        body: 'Modified body',
        updatedAt: '2026-01-02T15:00:00Z',  // After last maxsim comment
        labels: [],
        htmlUrl: 'https://github.com/test/test/issues/100',
      },
    });
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 1,
          body: '<!-- maxsim:type=plan plan=1 -->\nOld plan',
          createdAt: '2026-01-01T10:00:00Z',
          updatedAt: '2026-01-01T10:00:00Z',
          user: { login: 'maxsim-bot' },
        },
      ],
    });
    mockGhJson.mockReturnValue({ ok: true, data: [] });

    const result = await GITHUB_COMMANDS['detect-external-edits'].handler([
      '--phase-number', '1',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Body Edits');
    expect(output).toContain('Total findings');
  });
});

describe('detect-external-edits handler — unmarked comments', () => {
  it('reports comments without maxsim markers', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [{ number: 100, title: 'Phase 1: Setup', state: 'open', labels: [] }],
    });
    mockGetIssue.mockResolvedValue({
      ok: true,
      data: {
        number: 100,
        title: 'Phase 1: Setup',
        state: 'open',
        body: 'Body',
        updatedAt: '2026-01-01T10:00:00Z',
        labels: [],
        htmlUrl: 'https://github.com/test/test/issues/100',
      },
    });
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 42,
          body: 'Hey, I manually changed something here',
          createdAt: '2026-01-01T12:00:00Z',
          updatedAt: '2026-01-01T12:00:00Z',
          user: { login: 'human-dev' },
        },
      ],
    });
    mockGhJson.mockReturnValue({ ok: true, data: [] });

    const result = await GITHUB_COMMANDS['detect-external-edits'].handler([
      '--phase-number', '1',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    expect(output).toContain('Unmarked Comments');
    expect(output).toContain('@human-dev');
    expect(output).toContain('Comment #42');
  });
});

describe('detect-external-edits handler — events fetch failure', () => {
  it('still reports findings when events API fails (graceful degradation)', async () => {
    mockListIssues.mockResolvedValue({
      ok: true,
      data: [{ number: 100, title: 'Phase 1: Setup', state: 'open', labels: [] }],
    });
    mockGetIssue.mockResolvedValue({
      ok: true,
      data: {
        number: 100,
        title: 'Phase 1: Setup',
        state: 'open',
        body: 'Body',
        updatedAt: '2026-01-01T10:00:00Z',
        labels: [],
        htmlUrl: 'https://github.com/test/test/issues/100',
      },
    });
    mockListComments.mockResolvedValue({
      ok: true,
      data: [
        {
          id: 55,
          body: 'Manual note without maxsim marker',
          createdAt: '2026-01-01T12:00:00Z',
          updatedAt: '2026-01-01T12:00:00Z',
          user: { login: 'reviewer' },
        },
      ],
    });
    // Events API fails
    mockGhJson.mockReturnValue({ ok: false, error: 'API timeout', code: 'TIMEOUT' });

    const result = await GITHUB_COMMANDS['detect-external-edits'].handler([
      '--phase-number', '1',
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    const output = result.result as string;
    // Should still report unmarked comments even though events failed
    expect(output).toContain('Unmarked Comments');
    expect(output).toContain('@reviewer');
  });
});

describe('detect-external-edits handler — phase not found', () => {
  it('returns error when the requested phase does not exist', async () => {
    mockListIssues.mockResolvedValue({ ok: true, data: [] });

    const result = await GITHUB_COMMANDS['detect-external-edits'].handler([
      '--phase-number', '99',
    ]);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('Phase issue not found');
  });
});
