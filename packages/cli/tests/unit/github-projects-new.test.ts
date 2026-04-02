/**
 * Unit tests for listProjectItems added in Phase 2.
 *
 * Follows the same mocking pattern as github-projects.test.ts: mock
 * node:child_process so that execFileSync returns controlled responses
 * for both git and gh CLI calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock node:child_process before any project imports ─────────────────────

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    execFileSync: vi.fn(),
  };
});

import * as childProcess from 'node:child_process';
import { resetClient } from '../../src/github/client.js';
import { listProjectItems } from '../../src/github/projects.js';

const execFileSyncMock = vi.mocked(childProcess.execFileSync);

// ── Shared fixture data ─────────────────────────────────────────────────────

const REPO_REMOTE_URL = 'git@github.com:testorg/testrepo.git';

// ── Helper: set up execFileSync responses per call ──────────────────────────

function setupExecMock(...ghResponses: Array<string | Error>): void {
  let callIndex = 0;
  execFileSyncMock.mockImplementation((_cmd: string, args?: readonly string[]) => {
    const argList = args ?? [];

    // git calls used by getRepoInfo
    if (_cmd === 'git') {
      if (argList[0] === 'remote') return REPO_REMOTE_URL;
    }

    // gh api call used to detect org/user type (also inside getRepoInfo)
    if (_cmd === 'gh' && argList[0] === 'api') {
      return 'User';
    }

    // All other gh calls — dispatch from the queue
    const response = ghResponses[callIndex++];
    if (response instanceof Error) throw response;
    return response ?? '';
  });
}

// ── Reset cached client state between every test ────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetClient();
});

// ── listProjectItems ────────────────────────────────────────────────────────

describe('listProjectItems', () => {
  it('returns an array of GhProjectItem on success', () => {
    const payload = {
      items: [
        {
          id: 'PVTI_item1',
          content: { number: 42, title: 'Test Issue', type: 'Issue' },
          isArchived: false,
        },
        {
          id: 'PVTI_item2',
          content: { number: 43, title: 'Another Issue', type: 'PullRequest' },
          isArchived: true,
        },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = listProjectItems(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);

    expect(result.data[0]).toEqual({
      id: 'PVTI_item1',
      contentNodeId: 'PVTI_item1',
      contentType: 'Issue',
      issueNumber: 42,
      title: 'Test Issue',
      isArchived: false,
    });

    expect(result.data[1]).toEqual({
      id: 'PVTI_item2',
      contentNodeId: 'PVTI_item2',
      contentType: 'PullRequest',
      issueNumber: 43,
      title: 'Another Issue',
      isArchived: true,
    });
  });

  it('returns an empty array when items list is empty', () => {
    setupExecMock(JSON.stringify({ items: [] }));

    const result = listProjectItems(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('handles missing items key gracefully (returns empty array)', () => {
    setupExecMock(JSON.stringify({}));

    const result = listProjectItems(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('handles null content (DraftIssue with no content)', () => {
    const payload = {
      items: [
        {
          id: 'PVTI_draft',
          content: null,
          isArchived: false,
        },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = listProjectItems(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual({
      id: 'PVTI_draft',
      contentNodeId: 'PVTI_draft',
      contentType: 'DraftIssue',
      issueNumber: undefined,
      title: '',
      isArchived: false,
    });
  });

  it('passes project number and owner to gh CLI', () => {
    setupExecMock(JSON.stringify({ items: [] }));

    listProjectItems(42, 'testorg');

    const calls = execFileSyncMock.mock.calls;
    const ghCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'item-list',
    );
    if (!ghCall) throw new Error('Expected a gh item-list call');
    const ghArgs = ghCall[1] as string[];
    expect(ghArgs).toContain('42');
    expect(ghArgs).toContain('testorg');
  });

  it('passes --limit 1000 and --format json to gh CLI', () => {
    setupExecMock(JSON.stringify({ items: [] }));

    listProjectItems(7);

    const calls = execFileSyncMock.mock.calls;
    const ghCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'item-list',
    );
    if (!ghCall) throw new Error('Expected a gh item-list call');
    const ghArgs = ghCall[1] as string[];
    expect(ghArgs).toContain('--limit');
    expect(ghArgs).toContain('1000');
    expect(ghArgs).toContain('--format');
    expect(ghArgs).toContain('json');
  });

  it('returns error result when gh CLI fails', () => {
    setupExecMock(new Error('gh: 403 Forbidden'));

    const result = listProjectItems(7);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });

  it('returns error result on 404', () => {
    setupExecMock(new Error('gh: 404 Not Found'));

    const result = listProjectItems(99);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });

  it('maps isArchived correctly from response', () => {
    const payload = {
      items: [
        {
          id: 'PVTI_archived',
          content: { number: 10, title: 'Archived Issue', type: 'Issue' },
          isArchived: true,
        },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = listProjectItems(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].isArchived).toBe(true);
  });

  it('defaults isArchived to false when not provided', () => {
    const payload = {
      items: [
        {
          id: 'PVTI_noarchive',
          content: { number: 11, title: 'Active Issue', type: 'Issue' },
        },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = listProjectItems(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].isArchived).toBe(false);
  });
});
