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

// ── status (argument validation) ─────────────────────────────────────────────

describe('status handler argument validation', () => {
  it('returns error when --phase-number is not a valid integer', async () => {
    const result = await GITHUB_COMMANDS['status'].handler(['--phase-number', 'abc']);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.error).toContain('integer');
  });
});

// ── create-phase (argument validation) ───────────────────────────────────────

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

// ── batch-create-tasks (argument validation) ─────────────────────────────────

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

// ── detect-external-edits (argument validation) ──────────────────────────────

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

// ── all-progress (basic behavior) ────────────────────────────────────────────

describe('all-progress handler', () => {
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
