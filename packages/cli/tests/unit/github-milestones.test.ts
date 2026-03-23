/**
 * Unit tests for github/milestones.ts
 *
 * The milestones module calls `getOctokit()` and `getRepoInfo()` from
 * `../github/client.js` at runtime. Both are mocked here so no real
 * GitHub token or network access is required.
 *
 * Note: vi.mock() calls are hoisted to the top of the module by Vitest,
 * so the mocked modules are in place before any imports or tests run.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────

// Mock the client module so getOctokit / getRepoInfo can be controlled.
vi.mock('../../src/github/client.js', () => ({
  getOctokit: vi.fn(),
  getRepoInfo: vi.fn(),
  withGhResult: async (fn: () => Promise<unknown>) => {
    try {
      const data = await fn();
      return { ok: true, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number }).status;
      if (status === 404) return { ok: false, error: msg, code: 'NOT_FOUND' };
      if (status === 401) return { ok: false, error: msg, code: 'UNAUTHORIZED' };
      if (status === 403) return { ok: false, error: msg, code: msg.toLowerCase().includes('rate limit') ? 'RATE_LIMITED' : 'FORBIDDEN' };
      if (status === 422) return { ok: false, error: msg, code: 'VALIDATION' };
      return { ok: false, error: msg, code: 'UNKNOWN' };
    }
  },
}));

// Import the module under test after mocks are declared.
import {
  createMilestone,
  listMilestones,
  findMilestone,
  ensureMilestone,
  updateMilestone,
} from '../../src/github/milestones.js';
import { getOctokit, getRepoInfo } from '../../src/github/client.js';
import type { GhMilestone } from '../../src/github/types.js';

// ── Typed mock references ─────────────────────────────────────────────────

const mockGetOctokit = vi.mocked(getOctokit);
const mockGetRepoInfo = vi.mocked(getRepoInfo);

// ── Fixtures ──────────────────────────────────────────────────────────────

const REPO_INFO = { owner: 'test-owner', repo: 'test-repo', isOrg: false };

/**
 * Build a raw Octokit milestone response (the shape returned by
 * `octokit.rest.issues.createMilestone` and `updateMilestone`).
 */
function makeRawMilestone(overrides: Partial<{
  number: number;
  id: number;
  node_id: string;
  title: string;
  description: string | null;
  state: string;
  open_issues: number;
  closed_issues: number;
  due_on: string | null;
  created_at: string;
  updated_at: string;
}> = {}) {
  return {
    number: overrides.number ?? 1,
    id: overrides.id ?? 100,
    node_id: overrides.node_id ?? 'MDk6TWlsZXN0b25lMQ==',
    title: overrides.title ?? 'v1.0',
    // Use `'description' in overrides` so that an explicit null is preserved
    // rather than replaced by the default via the `??` operator.
    description: 'description' in overrides ? overrides.description! : 'First release',
    state: overrides.state ?? 'open',
    open_issues: overrides.open_issues ?? 3,
    closed_issues: overrides.closed_issues ?? 7,
    due_on: 'due_on' in overrides ? overrides.due_on! : null,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
    updated_at: overrides.updated_at ?? '2026-01-02T00:00:00Z',
  };
}

/**
 * Build the expected GhMilestone shape that the module should return after
 * mapping the raw Octokit response.
 */
function makeGhMilestone(overrides: Partial<GhMilestone> = {}): GhMilestone {
  return {
    number: overrides.number ?? 1,
    id: overrides.id ?? 100,
    nodeId: overrides.nodeId ?? 'MDk6TWlsZXN0b25lMQ==',
    title: overrides.title ?? 'v1.0',
    description: overrides.description ?? 'First release',
    state: overrides.state ?? 'open',
    openIssues: overrides.openIssues ?? 3,
    closedIssues: overrides.closedIssues ?? 7,
    dueOn: overrides.dueOn ?? null,
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: overrides.updatedAt ?? '2026-01-02T00:00:00Z',
  };
}

/** Create a minimal mock Octokit instance. */
function makeOctokitMock(overrides: {
  createMilestone?: ReturnType<typeof vi.fn>;
  updateMilestone?: ReturnType<typeof vi.fn>;
  listMilestones?: ReturnType<typeof vi.fn>;
  paginate?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    rest: {
      issues: {
        createMilestone: overrides.createMilestone ?? vi.fn(),
        updateMilestone: overrides.updateMilestone ?? vi.fn(),
        listMilestones: overrides.listMilestones ?? vi.fn(),
      },
    },
    paginate: overrides.paginate ?? vi.fn(),
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRepoInfo.mockReturnValue(REPO_INFO);
});

// ── createMilestone ───────────────────────────────────────────────────────

describe('createMilestone', () => {
  it('returns a GhMilestone on success', async () => {
    const raw = makeRawMilestone();
    const octokit = makeOctokitMock({
      createMilestone: vi.fn().mockResolvedValue({ data: raw }),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await createMilestone({ title: 'v1.0', description: 'First release' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data).toEqual(makeGhMilestone());
  });

  it('maps all fields from the raw Octokit response correctly', async () => {
    const raw = makeRawMilestone({
      number: 5,
      id: 999,
      node_id: 'NODEID',
      title: 'v2.0',
      description: 'Second release',
      state: 'closed',
      open_issues: 0,
      closed_issues: 20,
      due_on: '2026-06-01T00:00:00Z',
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-15T00:00:00Z',
    });
    const octokit = makeOctokitMock({
      createMilestone: vi.fn().mockResolvedValue({ data: raw }),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await createMilestone({ title: 'v2.0', description: 'Second release', dueOn: '2026-06-01T00:00:00Z' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data).toEqual<GhMilestone>({
      number: 5,
      id: 999,
      nodeId: 'NODEID',
      title: 'v2.0',
      description: 'Second release',
      state: 'closed',
      openIssues: 0,
      closedIssues: 20,
      dueOn: '2026-06-01T00:00:00Z',
      createdAt: '2026-03-01T00:00:00Z',
      updatedAt: '2026-03-15T00:00:00Z',
    });
  });

  it('coerces null description to empty string', async () => {
    const raw = makeRawMilestone({ description: null });
    const octokit = makeOctokitMock({
      createMilestone: vi.fn().mockResolvedValue({ data: raw }),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await createMilestone({ title: 'v1.0' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.description).toBe('');
  });

  it('passes title, description, and dueOn to the Octokit call', async () => {
    const createMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone() });
    const octokit = makeOctokitMock({ createMilestone: createMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await createMilestone({ title: 'v3.0', description: 'Third', dueOn: '2026-12-31T00:00:00Z' });

    expect(createMilestoneFn).toHaveBeenCalledWith({
      owner: REPO_INFO.owner,
      repo: REPO_INFO.repo,
      title: 'v3.0',
      description: 'Third',
      due_on: '2026-12-31T00:00:00Z',
    });
  });

  it('uses provided repo override instead of getRepoInfo()', async () => {
    const customRepo = { owner: 'custom-owner', repo: 'custom-repo', isOrg: true };
    const createMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone() });
    const octokit = makeOctokitMock({ createMilestone: createMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await createMilestone({ title: 'v1.0' }, customRepo);

    expect(createMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'custom-owner', repo: 'custom-repo' }),
    );
    // getRepoInfo should not be called when repo is explicitly supplied.
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('returns an error result when the API call throws a 404', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    const octokit = makeOctokitMock({
      createMilestone: vi.fn().mockRejectedValue(err),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await createMilestone({ title: 'v1.0' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns UNAUTHORIZED for 401 errors', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    const octokit = makeOctokitMock({
      createMilestone: vi.fn().mockRejectedValue(err),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await createMilestone({ title: 'v1.0' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('returns VALIDATION for 422 errors', async () => {
    const err = Object.assign(new Error('Validation Failed'), { status: 422 });
    const octokit = makeOctokitMock({
      createMilestone: vi.fn().mockRejectedValue(err),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await createMilestone({ title: '' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('VALIDATION');
  });
});

// ── listMilestones ────────────────────────────────────────────────────────

describe('listMilestones', () => {
  it('returns an array of GhMilestone on success', async () => {
    const rawList = [makeRawMilestone({ number: 1, title: 'v1.0' }), makeRawMilestone({ number: 2, title: 'v2.0' })];
    const octokit = makeOctokitMock({
      paginate: vi.fn().mockResolvedValue(rawList),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await listMilestones();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data).toHaveLength(2);
    expect(result.data[0].title).toBe('v1.0');
    expect(result.data[1].title).toBe('v2.0');
  });

  it('uses "all" as the default state', async () => {
    const paginateFn = vi.fn().mockResolvedValue([]);
    const octokit = makeOctokitMock({ paginate: paginateFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await listMilestones();

    expect(paginateFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ state: 'all' }),
    );
  });

  it('passes state: "open" to paginate when specified', async () => {
    const paginateFn = vi.fn().mockResolvedValue([]);
    const octokit = makeOctokitMock({ paginate: paginateFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await listMilestones('open');

    expect(paginateFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ state: 'open' }),
    );
  });

  it('passes state: "all" to paginate when explicitly specified', async () => {
    const paginateFn = vi.fn().mockResolvedValue([]);
    const octokit = makeOctokitMock({ paginate: paginateFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await listMilestones('all');

    expect(paginateFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ state: 'all' }),
    );
  });

  it('passes per_page: 100 for pagination', async () => {
    const paginateFn = vi.fn().mockResolvedValue([]);
    const octokit = makeOctokitMock({ paginate: paginateFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await listMilestones('open');

    expect(paginateFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ per_page: 100 }),
    );
  });

  it('returns an empty array when no milestones exist', async () => {
    const octokit = makeOctokitMock({ paginate: vi.fn().mockResolvedValue([]) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await listMilestones('open');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data).toEqual([]);
  });

  it('maps all milestone fields correctly', async () => {
    const raw = makeRawMilestone({
      number: 3,
      id: 300,
      node_id: 'NODE3',
      title: 'v3.0',
      description: 'Third milestone',
      state: 'closed',
      open_issues: 1,
      closed_issues: 10,
      due_on: '2026-09-01T00:00:00Z',
      created_at: '2026-02-01T00:00:00Z',
      updated_at: '2026-02-28T00:00:00Z',
    });
    const octokit = makeOctokitMock({ paginate: vi.fn().mockResolvedValue([raw]) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await listMilestones();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data[0]).toEqual<GhMilestone>({
      number: 3,
      id: 300,
      nodeId: 'NODE3',
      title: 'v3.0',
      description: 'Third milestone',
      state: 'closed',
      openIssues: 1,
      closedIssues: 10,
      dueOn: '2026-09-01T00:00:00Z',
      createdAt: '2026-02-01T00:00:00Z',
      updatedAt: '2026-02-28T00:00:00Z',
    });
  });

  it('coerces null description to empty string', async () => {
    const raw = makeRawMilestone({ description: null });
    const octokit = makeOctokitMock({ paginate: vi.fn().mockResolvedValue([raw]) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await listMilestones();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data[0].description).toBe('');
  });

  it('returns an error result when paginate throws', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    const octokit = makeOctokitMock({ paginate: vi.fn().mockRejectedValue(err) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await listMilestones();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('FORBIDDEN');
  });
});

// ── findMilestone ─────────────────────────────────────────────────────────

describe('findMilestone', () => {
  it('returns the matching milestone when found by exact title', async () => {
    const rawList = [
      makeRawMilestone({ number: 1, title: 'v1.0' }),
      makeRawMilestone({ number: 2, title: 'v2.0' }),
    ];
    const octokit = makeOctokitMock({ paginate: vi.fn().mockResolvedValue(rawList) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await findMilestone('v2.0');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data).not.toBeNull();
    expect(result.data?.title).toBe('v2.0');
    expect(result.data?.number).toBe(2);
  });

  it('returns null when no milestone matches the title', async () => {
    const rawList = [makeRawMilestone({ number: 1, title: 'v1.0' })];
    const octokit = makeOctokitMock({ paginate: vi.fn().mockResolvedValue(rawList) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await findMilestone('v99.0');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data).toBeNull();
  });

  it('returns null when the milestone list is empty', async () => {
    const octokit = makeOctokitMock({ paginate: vi.fn().mockResolvedValue([]) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await findMilestone('v1.0');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data).toBeNull();
  });

  it('does NOT match on partial title (exact match only)', async () => {
    const rawList = [makeRawMilestone({ number: 1, title: 'v1.0 - Initial Release' })];
    const octokit = makeOctokitMock({ paginate: vi.fn().mockResolvedValue(rawList) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await findMilestone('v1.0');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data).toBeNull();
  });

  it('propagates the error result when listMilestones fails', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    const octokit = makeOctokitMock({ paginate: vi.fn().mockRejectedValue(err) });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await findMilestone('v1.0');

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('forwards the repo override to listMilestones', async () => {
    const customRepo = { owner: 'other-owner', repo: 'other-repo', isOrg: false };
    const paginateFn = vi.fn().mockResolvedValue([]);
    const octokit = makeOctokitMock({ paginate: paginateFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await findMilestone('v1.0', customRepo);

    expect(paginateFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ owner: 'other-owner', repo: 'other-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });
});

// ── ensureMilestone ───────────────────────────────────────────────────────

describe('ensureMilestone', () => {
  it('returns the existing milestone when found by title', async () => {
    const existing = makeRawMilestone({ number: 7, title: 'Sprint 1' });
    const paginateFn = vi.fn().mockResolvedValue([existing]);
    const createMilestoneFn = vi.fn();
    const octokit = makeOctokitMock({ paginate: paginateFn, createMilestone: createMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await ensureMilestone({ title: 'Sprint 1' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.title).toBe('Sprint 1');
    expect(result.data.number).toBe(7);
    // createMilestone should NOT be called when the milestone already exists.
    expect(createMilestoneFn).not.toHaveBeenCalled();
  });

  it('creates a new milestone when not found', async () => {
    const paginateFn = vi.fn().mockResolvedValue([]);
    const newRaw = makeRawMilestone({ number: 8, title: 'Sprint 2' });
    const createMilestoneFn = vi.fn().mockResolvedValue({ data: newRaw });
    const octokit = makeOctokitMock({ paginate: paginateFn, createMilestone: createMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await ensureMilestone({ title: 'Sprint 2', description: 'Second sprint' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.title).toBe('Sprint 2');
    expect(result.data.number).toBe(8);
    expect(createMilestoneFn).toHaveBeenCalledOnce();
  });

  it('passes description and dueOn to createMilestone when creating', async () => {
    const paginateFn = vi.fn().mockResolvedValue([]);
    const createMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone({ title: 'Sprint 3' }) });
    const octokit = makeOctokitMock({ paginate: paginateFn, createMilestone: createMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await ensureMilestone({ title: 'Sprint 3', description: 'Third sprint', dueOn: '2026-09-30T00:00:00Z' });

    expect(createMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sprint 3',
        description: 'Third sprint',
        due_on: '2026-09-30T00:00:00Z',
      }),
    );
  });

  it('propagates error from findMilestone without attempting creation', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    const paginateFn = vi.fn().mockRejectedValue(err);
    const createMilestoneFn = vi.fn();
    const octokit = makeOctokitMock({ paginate: paginateFn, createMilestone: createMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await ensureMilestone({ title: 'Sprint 4' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('FORBIDDEN');
    expect(createMilestoneFn).not.toHaveBeenCalled();
  });

  it('propagates error from createMilestone when creation fails', async () => {
    const paginateFn = vi.fn().mockResolvedValue([]);
    const err = Object.assign(new Error('Validation Failed'), { status: 422 });
    const createMilestoneFn = vi.fn().mockRejectedValue(err);
    const octokit = makeOctokitMock({ paginate: paginateFn, createMilestone: createMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await ensureMilestone({ title: '' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('VALIDATION');
  });
});

// ── updateMilestone ───────────────────────────────────────────────────────

describe('updateMilestone', () => {
  it('returns updated GhMilestone on success', async () => {
    const updated = makeRawMilestone({ number: 1, title: 'v1.1', description: 'Patch release' });
    const updateMilestoneFn = vi.fn().mockResolvedValue({ data: updated });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(1, { title: 'v1.1', description: 'Patch release' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.title).toBe('v1.1');
    expect(result.data.description).toBe('Patch release');
  });

  it('passes the milestone number as milestone_number', async () => {
    const updateMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone() });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await updateMilestone(42, { title: 'new title' });

    expect(updateMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({ milestone_number: 42 }),
    );
  });

  it('updates the title field', async () => {
    const updateMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone({ title: 'Renamed' }) });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(1, { title: 'Renamed' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.title).toBe('Renamed');
    expect(updateMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Renamed' }),
    );
  });

  it('updates the description field', async () => {
    const updateMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone({ description: 'Updated description' }) });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(1, { description: 'Updated description' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.description).toBe('Updated description');
    expect(updateMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Updated description' }),
    );
  });

  it('updates the state to "closed"', async () => {
    const updateMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone({ state: 'closed' }) });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(1, { state: 'closed' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.state).toBe('closed');
    expect(updateMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'closed' }),
    );
  });

  it('updates the state to "open"', async () => {
    const updateMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone({ state: 'open' }) });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(1, { state: 'open' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.state).toBe('open');
  });

  it('updates the dueOn field with a date string', async () => {
    const updateMilestoneFn = vi.fn().mockResolvedValue({
      data: makeRawMilestone({ due_on: '2026-12-31T00:00:00Z' }),
    });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(1, { dueOn: '2026-12-31T00:00:00Z' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.dueOn).toBe('2026-12-31T00:00:00Z');
    expect(updateMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({ due_on: '2026-12-31T00:00:00Z' }),
    );
  });

  it('clears the dueOn field when null is passed', async () => {
    const updateMilestoneFn = vi.fn().mockResolvedValue({
      data: makeRawMilestone({ due_on: null }),
    });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(1, { dueOn: null });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok result');
    expect(result.data.dueOn).toBeNull();
    expect(updateMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({ due_on: null }),
    );
  });

  it('uses the provided repo override', async () => {
    const customRepo = { owner: 'fork-owner', repo: 'fork-repo', isOrg: false };
    const updateMilestoneFn = vi.fn().mockResolvedValue({ data: makeRawMilestone() });
    const octokit = makeOctokitMock({ updateMilestone: updateMilestoneFn });
    mockGetOctokit.mockReturnValue(octokit as never);

    await updateMilestone(1, { title: 'v1.0' }, customRepo);

    expect(updateMilestoneFn).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'fork-owner', repo: 'fork-repo' }),
    );
    expect(mockGetRepoInfo).not.toHaveBeenCalled();
  });

  it('returns NOT_FOUND when the milestone does not exist', async () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    const octokit = makeOctokitMock({
      updateMilestone: vi.fn().mockRejectedValue(err),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(9999, { title: 'ghost' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('NOT_FOUND');
  });

  it('returns UNKNOWN for unclassified errors', async () => {
    const err = new Error('Something unexpected happened');
    const octokit = makeOctokitMock({
      updateMilestone: vi.fn().mockRejectedValue(err),
    });
    mockGetOctokit.mockReturnValue(octokit as never);

    const result = await updateMilestone(1, { title: 'v1.0' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected error result');
    expect(result.code).toBe('UNKNOWN');
    expect(result.error).toBe('Something unexpected happened');
  });
});
