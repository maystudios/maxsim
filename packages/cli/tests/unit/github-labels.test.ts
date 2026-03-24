/**
 * Unit tests for github/labels.ts
 *
 * The labels module uses getOctokit() and getRepoInfo() from the client module
 * and calls the Octokit REST API. We mock the client module to inject a fake
 * Octokit so no real gh CLI or network calls are made.
 *
 * Note: vi.mock() calls are hoisted by Vitest, so the mock is in place before
 * any imports are resolved.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the GitHub client module ─────────────────────────────────────────────
// We replace getOctokit() with a factory that returns a controllable fake, and
// getRepoInfo() with a fixed test repo. withGhResult is used as-is (real impl).

const mockGetLabel = vi.fn();
const mockCreateLabel = vi.fn();
const mockListLabelsForRepo = vi.fn();
const mockPaginate = vi.fn();

const mockOctokit = {
  rest: {
    issues: {
      getLabel: mockGetLabel,
      createLabel: mockCreateLabel,
      listLabelsForRepo: mockListLabelsForRepo,
    },
  },
  paginate: mockPaginate,
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
import { getLabel, createLabel, ensureLabels } from '../../src/github/labels.js';
import { MAXSIM_LABELS } from '../../src/github/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a minimal raw Octokit label response.
 *  Pass `description: null` explicitly to simulate a label with no description. */
function makeRawLabel(overrides: Partial<{
  id: number;
  node_id: string;
  name: string;
  description: string | null;
  color: string;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    node_id: overrides.node_id ?? 'MDU6TGFiZWwx',
    name: overrides.name ?? 'type:phase',
    // Use 'in' check so an explicit null override is preserved, not replaced by default.
    description: 'description' in overrides ? overrides.description : 'Phase issue',
    color: overrides.color ?? '1f6feb',
    // Fields the Octokit response includes that we do not use
    url: 'https://api.github.com/repos/test-owner/test-repo/labels/type:phase',
    default: false,
  };
}

// ── MAXSIM_LABELS constant ────────────────────────────────────────────────────

describe('MAXSIM_LABELS constant', () => {
  it('has exactly 6 entries', () => {
    expect(MAXSIM_LABELS).toHaveLength(6);
  });

  it('contains all type: namespace labels (4 entries)', () => {
    const typeLabels = MAXSIM_LABELS.filter((l) => l.name.startsWith('type:'));
    expect(typeLabels).toHaveLength(4);
    const names = typeLabels.map((l) => l.name);
    expect(names).toContain('type:phase');
    expect(names).toContain('type:task');
    expect(names).toContain('type:bug');
    expect(names).toContain('type:quick');
  });

  it('contains all maxsim: namespace labels (2 entries)', () => {
    const maxsimLabels = MAXSIM_LABELS.filter((l) => l.name.startsWith('maxsim:'));
    expect(maxsimLabels).toHaveLength(2);
    const names = maxsimLabels.map((l) => l.name);
    expect(names).toContain('maxsim:auto');
    expect(names).toContain('maxsim:user');
  });

  it('accounts for all 6 labels across the 2 namespaces', () => {
    const typeCount = MAXSIM_LABELS.filter((l) => l.name.startsWith('type:')).length;
    const maxsimCount = MAXSIM_LABELS.filter((l) => l.name.startsWith('maxsim:')).length;
    // 4 type + 2 maxsim = 6
    expect(typeCount + maxsimCount).toBe(6);
  });

  it('every entry has non-empty name, description, and color', () => {
    for (const label of MAXSIM_LABELS) {
      expect(label.name.length).toBeGreaterThan(0);
      expect(label.description.length).toBeGreaterThan(0);
      expect(label.color.length).toBeGreaterThan(0);
    }
  });

  it('all label names are unique', () => {
    const names = MAXSIM_LABELS.map((l) => l.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all color values are valid 6-character hex strings', () => {
    for (const label of MAXSIM_LABELS) {
      expect(label.color).toMatch(/^[0-9a-f]{6}$/i);
    }
  });
});

// ── getLabel ──────────────────────────────────────────────────────────────────

describe('getLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok:true with the mapped GhLabel when the label exists', async () => {
    const raw = makeRawLabel({ id: 42, node_id: 'LA_abc123', name: 'type:phase', description: 'Phase issue', color: '1f6feb' });
    mockGetLabel.mockResolvedValue({ data: raw });

    const result = await getLabel('type:phase');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    expect(result.data).toEqual({
      id: 42,
      nodeId: 'LA_abc123',
      name: 'type:phase',
      description: 'Phase issue',
      color: '1f6feb',
    });
  });

  it('passes the label name to the Octokit call', async () => {
    const raw = makeRawLabel({ name: 'maxsim:auto' });
    mockGetLabel.mockResolvedValue({ data: raw });

    await getLabel('maxsim:auto');

    expect(mockGetLabel).toHaveBeenCalledOnce();
    expect(mockGetLabel).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'maxsim:auto' }),
    );
  });

  it('passes owner and repo from getRepoInfo to the Octokit call', async () => {
    const raw = makeRawLabel();
    mockGetLabel.mockResolvedValue({ data: raw });

    await getLabel('type:task');

    expect(mockGetLabel).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('returns ok:true with null when the label is not found (404 thrown)', async () => {
    // The inner try/catch in getLabel catches any error and returns null.
    mockGetLabel.mockRejectedValue(Object.assign(new Error('Not Found'), { status: 404 }));

    const result = await getLabel('nonexistent-label');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data).toBeNull();
  });

  it('returns ok:true with null for any exception thrown by Octokit', async () => {
    mockGetLabel.mockRejectedValue(new Error('Network error'));

    const result = await getLabel('some-label');

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');
    expect(result.data).toBeNull();
  });

  it('uses the provided explicit RepoInfo rather than calling getRepoInfo', async () => {
    const raw = makeRawLabel({ name: 'type:bug' });
    mockGetLabel.mockResolvedValue({ data: raw });

    await getLabel('type:bug', { owner: 'custom-owner', repo: 'custom-repo', isOrg: true });

    expect(mockGetLabel).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'custom-owner', repo: 'custom-repo' }),
    );
  });

  it('maps null API description to an empty string', async () => {
    const raw = makeRawLabel({ description: null });
    mockGetLabel.mockResolvedValue({ data: raw });

    const result = await getLabel('type:phase');
    if (!result.ok) throw new Error('Expected ok:true');

    expect(result.data?.description).toBe('');
  });
});

// ── createLabel ───────────────────────────────────────────────────────────────

describe('createLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok:true with the mapped GhLabel on successful creation', async () => {
    const raw = makeRawLabel({
      id: 99,
      node_id: 'LA_newlabel',
      name: 'maxsim:managed',
      description: 'Managed by MaxsimCLI',
      color: '5319e7',
    });
    mockCreateLabel.mockResolvedValue({ data: raw });

    const result = await createLabel({
      name: 'maxsim:managed',
      description: 'Managed by MaxsimCLI',
      color: '5319e7',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    expect(result.data).toEqual({
      id: 99,
      nodeId: 'LA_newlabel',
      name: 'maxsim:managed',
      description: 'Managed by MaxsimCLI',
      color: '5319e7',
    });
  });

  it('passes all label fields to the Octokit createLabel call', async () => {
    const raw = makeRawLabel({ name: 'custom:label', color: 'ff0000', description: 'A custom label' });
    mockCreateLabel.mockResolvedValue({ data: raw });

    await createLabel({ name: 'custom:label', description: 'A custom label', color: 'ff0000' });

    expect(mockCreateLabel).toHaveBeenCalledOnce();
    expect(mockCreateLabel).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'test-owner',
        repo: 'test-repo',
        name: 'custom:label',
        description: 'A custom label',
        color: 'ff0000',
      }),
    );
  });

  it('uses the provided explicit RepoInfo over getRepoInfo', async () => {
    const raw = makeRawLabel();
    mockCreateLabel.mockResolvedValue({ data: raw });

    await createLabel(
      { name: 'type:phase', description: 'Phase issue', color: '1f6feb' },
      { owner: 'org-owner', repo: 'org-repo', isOrg: true },
    );

    expect(mockCreateLabel).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'org-owner', repo: 'org-repo' }),
    );
  });

  it('returns ok:false with VALIDATION code when Octokit throws 422', async () => {
    const err = Object.assign(new Error('Validation Failed'), { status: 422 });
    mockCreateLabel.mockRejectedValue(err);

    const result = await createLabel({ name: 'duplicate', description: 'Already exists', color: 'aabbcc' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('VALIDATION');
  });

  it('returns ok:false with UNAUTHORIZED code when Octokit throws 401', async () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockCreateLabel.mockRejectedValue(err);

    const result = await createLabel({ name: 'some-label', description: 'Test', color: '000000' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('returns ok:false with UNKNOWN code for unexpected errors', async () => {
    mockCreateLabel.mockRejectedValue(new Error('Unexpected network failure'));

    const result = await createLabel({ name: 'some-label', description: 'Test', color: '000000' });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNKNOWN');
  });

  it('maps null API description to an empty string in the returned GhLabel', async () => {
    const raw = makeRawLabel({ description: null });
    mockCreateLabel.mockResolvedValue({ data: raw });

    const result = await createLabel({ name: 'type:phase', description: '', color: '1f6feb' });
    if (!result.ok) throw new Error('Expected ok:true');

    expect(result.data.description).toBe('');
  });
});

// ── ensureLabels ──────────────────────────────────────────────────────────────

describe('ensureLabels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates all 6 labels when the repo has none', async () => {
    mockPaginate.mockResolvedValue([]); // No existing labels
    mockCreateLabel.mockResolvedValue({ data: makeRawLabel() });

    const result = await ensureLabels();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    expect(result.data.created).toHaveLength(6);
    expect(result.data.existing).toHaveLength(0);
    expect(mockCreateLabel).toHaveBeenCalledTimes(6);
  });

  it('skips existing labels and only creates missing ones', async () => {
    // Simulate 2 labels already on the repo
    const alreadyPresent = ['type:phase', 'maxsim:auto'];
    mockPaginate.mockResolvedValue(alreadyPresent.map((name) => makeRawLabel({ name })));
    mockCreateLabel.mockResolvedValue({ data: makeRawLabel() });

    const result = await ensureLabels();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    expect(result.data.existing).toHaveLength(2);
    expect(result.data.existing).toEqual(expect.arrayContaining(alreadyPresent));

    expect(result.data.created).toHaveLength(4); // 6 - 2
    expect(mockCreateLabel).toHaveBeenCalledTimes(4);
  });

  it('skips all labels when all 6 already exist on the repo', async () => {
    mockPaginate.mockResolvedValue(MAXSIM_LABELS.map((l) => makeRawLabel({ name: l.name })));

    const result = await ensureLabels();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    expect(result.data.existing).toHaveLength(6);
    expect(result.data.created).toHaveLength(0);
    expect(mockCreateLabel).not.toHaveBeenCalled();
  });

  it('reports created labels by their exact names', async () => {
    mockPaginate.mockResolvedValue([]);
    // Echo back the name from the createLabel call
    mockCreateLabel.mockImplementation((args: { name: string }) =>
      Promise.resolve({ data: makeRawLabel({ name: args.name }) }),
    );

    const result = await ensureLabels();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected ok:true');

    const expectedNames = MAXSIM_LABELS.map((l) => l.name);
    expect(result.data.created).toEqual(expectedNames);
  });

  it('passes owner and repo from getRepoInfo to listLabelsForRepo', async () => {
    mockPaginate.mockResolvedValue([]);
    mockCreateLabel.mockResolvedValue({ data: makeRawLabel() });

    await ensureLabels();

    expect(mockPaginate).toHaveBeenCalledOnce();
    // paginate is called as paginate(octokit.rest.issues.listLabelsForRepo, params)
    expect(mockPaginate).toHaveBeenCalledWith(
      mockListLabelsForRepo,
      expect.objectContaining({ owner: 'test-owner', repo: 'test-repo' }),
    );
  });

  it('uses the provided explicit RepoInfo over getRepoInfo', async () => {
    mockPaginate.mockResolvedValue([]);
    mockCreateLabel.mockResolvedValue({ data: makeRawLabel() });

    await ensureLabels({ owner: 'explicit-owner', repo: 'explicit-repo', isOrg: false });

    expect(mockPaginate).toHaveBeenCalledWith(
      mockListLabelsForRepo,
      expect.objectContaining({ owner: 'explicit-owner', repo: 'explicit-repo' }),
    );
  });

  it('returns ok:false when listLabelsForRepo rejects', async () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    mockPaginate.mockRejectedValue(err);

    const result = await ensureLabels();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('FORBIDDEN');
  });

  it('returns ok:false when createLabel rejects mid-run', async () => {
    mockPaginate.mockResolvedValue([]);
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    mockCreateLabel.mockRejectedValue(err);

    const result = await ensureLabels();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected ok:false');
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('passes per_page:100 to listLabelsForRepo to handle large repos', async () => {
    mockPaginate.mockResolvedValue([]);
    mockCreateLabel.mockResolvedValue({ data: makeRawLabel() });

    await ensureLabels();

    expect(mockPaginate).toHaveBeenCalledWith(
      mockListLabelsForRepo,
      expect.objectContaining({ per_page: 100 }),
    );
  });

  it('creates each missing label with the correct name, description, and color from MAXSIM_LABELS', async () => {
    // Only one label pre-exists; remaining 5 should be created.
    mockPaginate.mockResolvedValue([makeRawLabel({ name: 'type:phase' })]);
    mockCreateLabel.mockResolvedValue({ data: makeRawLabel() });

    await ensureLabels();

    // Verify every non-existing MAXSIM label was passed correctly to createLabel.
    const missingLabels = MAXSIM_LABELS.filter((l) => l.name !== 'type:phase');
    for (const label of missingLabels) {
      expect(mockCreateLabel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: label.name,
          description: label.description,
          color: label.color,
        }),
      );
    }
  });
});
