/**
 * Unit tests for new label functions added in Phase 2:
 *   - addLabelToIssue
 *   - removeLabelFromIssue
 *
 * Also verifies that MAXSIM_LABELS includes the 'verification:failed' label.
 *
 * Follows the same mocking pattern as github-labels.test.ts: mock the client
 * module to inject a controllable fake Octokit, so no real API calls are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the GitHub client module ─────────────────────────────────────────────

const mockAddLabels = vi.fn();
const mockRemoveLabel = vi.fn();

const mockOctokit = {
  rest: {
    issues: {
      addLabels: mockAddLabels,
      removeLabel: mockRemoveLabel,
    },
  },
};

vi.mock('../../src/github/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/github/client.js')>();
  return {
    ...actual,
    getOctokit: () => mockOctokit,
    getRepoInfo: () => ({ owner: 'test-owner', repo: 'test-repo', isOrg: false }),
  };
});

// Import after mocks are established.
import { addLabelToIssue, removeLabelFromIssue } from '../../src/github/labels.js';
import { MAXSIM_LABELS } from '../../src/github/types.js';

// ── Reset mocks between tests ────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── MAXSIM_LABELS — verification:failed ──────────────────────────────────────

describe('MAXSIM_LABELS includes verification:failed', () => {
  it('contains the verification:failed label', () => {
    const found = MAXSIM_LABELS.find((l) => l.name === 'verification:failed');
    expect(found).toBeDefined();
    expect(found?.name).toBe('verification:failed');
  });

  it('verification:failed has a non-empty description and valid color', () => {
    const found = MAXSIM_LABELS.find((l) => l.name === 'verification:failed');
    expect(found).toBeDefined();
    expect(found!.description.length).toBeGreaterThan(0);
    expect(found!.color).toMatch(/^[0-9a-f]{6}$/i);
  });

  it('has exactly 7 labels (4 type + 2 maxsim + 1 verification)', () => {
    expect(MAXSIM_LABELS).toHaveLength(7);
  });
});

// ── addLabelToIssue ──────────────────────────────────────────────────────────

describe('addLabelToIssue', () => {
  it('returns ok:true on successful label addition', async () => {
    mockAddLabels.mockResolvedValue({ data: [] });

    const result = await addLabelToIssue(42, 'verification:failed');

    expect(result.ok).toBe(true);
  });

  it('calls octokit.rest.issues.addLabels with correct params', async () => {
    mockAddLabels.mockResolvedValue({ data: [] });

    await addLabelToIssue(42, 'type:task');

    expect(mockAddLabels).toHaveBeenCalledOnce();
    expect(mockAddLabels).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        labels: ['type:task'],
      }),
    );
  });

  it('passes the label name in a single-element array', async () => {
    mockAddLabels.mockResolvedValue({ data: [] });

    await addLabelToIssue(100, 'my-custom-label');

    const callArgs = mockAddLabels.mock.calls[0][0];
    expect(callArgs.labels).toEqual(['my-custom-label']);
  });

  it('uses explicit RepoInfo when provided', async () => {
    mockAddLabels.mockResolvedValue({ data: [] });

    await addLabelToIssue(7, 'some-label', { owner: 'org-owner', repo: 'org-repo', isOrg: true });

    expect(mockAddLabels).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'org-owner',
        repo: 'org-repo',
      }),
    );
  });

  it('returns ok:false when Octokit throws a 404 error', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockAddLabels.mockRejectedValue(err);

    const result = await addLabelToIssue(99, 'nonexistent');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns ok:false with UNAUTHORIZED code on 401 error', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockAddLabels.mockRejectedValue(err);

    const result = await addLabelToIssue(1, 'any');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('returns ok:false with UNKNOWN code for unexpected errors', async () => {
    mockAddLabels.mockRejectedValue(new Error('Network failure'));

    const result = await addLabelToIssue(1, 'any');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNKNOWN');
  });
});

// ── removeLabelFromIssue ─────────────────────────────────────────────────────

describe('removeLabelFromIssue', () => {
  it('returns ok:true on successful label removal', async () => {
    mockRemoveLabel.mockResolvedValue({ data: {} });

    const result = await removeLabelFromIssue(42, 'verification:failed');

    expect(result.ok).toBe(true);
  });

  it('calls octokit.rest.issues.removeLabel with correct params', async () => {
    mockRemoveLabel.mockResolvedValue({ data: {} });

    await removeLabelFromIssue(42, 'type:task');

    expect(mockRemoveLabel).toHaveBeenCalledOnce();
    expect(mockRemoveLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 42,
        name: 'type:task',
      }),
    );
  });

  it('treats 404 error as success (label was not on the issue)', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    mockRemoveLabel.mockRejectedValue(err);

    const result = await removeLabelFromIssue(42, 'nonexistent-label');

    expect(result.ok).toBe(true);
  });

  it('returns ok:false for non-404 errors', async () => {
    const err = Object.assign(new Error('Server Error'), { status: 500 });
    mockRemoveLabel.mockRejectedValue(err);

    const result = await removeLabelFromIssue(42, 'some-label');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNKNOWN');
  });

  it('returns ok:false with UNAUTHORIZED code on 401 error', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockRemoveLabel.mockRejectedValue(err);

    const result = await removeLabelFromIssue(42, 'some-label');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('returns ok:false with FORBIDDEN code on 403 error', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    mockRemoveLabel.mockRejectedValue(err);

    const result = await removeLabelFromIssue(42, 'some-label');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('FORBIDDEN');
  });

  it('uses explicit RepoInfo when provided', async () => {
    mockRemoveLabel.mockResolvedValue({ data: {} });

    await removeLabelFromIssue(7, 'some-label', { owner: 'custom-owner', repo: 'custom-repo', isOrg: false });

    expect(mockRemoveLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'custom-owner',
        repo: 'custom-repo',
      }),
    );
  });
});
