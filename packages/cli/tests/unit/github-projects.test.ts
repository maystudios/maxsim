/**
 * Unit tests for github/projects.ts
 *
 * All calls to execFileSync are mocked at the node:child_process module level.
 * The mock intercepts both `git` calls (getRepoInfo) and `gh` calls (ghJson/ghExec).
 *
 * Note: vi.mock() is hoisted by Vitest, so the mock is in place before any
 * imports resolve — including the singleton state inside client.ts.
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
import {
  createProject,
  listProjects,
  findProject,
  listProjectFields,
  getStatusField,
  addItemToProject,
  moveItemToStatus,
  ensureProjectBoard,
} from '../../src/github/projects.js';

const execFileSyncMock = vi.mocked(childProcess.execFileSync);

// ── Shared fixture data ─────────────────────────────────────────────────────

const REPO_REMOTE_URL = 'git@github.com:testorg/testrepo.git';

const MOCK_PROJECT = {
  id: 'PVT_kwDOAbc123',
  number: 7,
  title: 'My Board',
  url: 'https://github.com/orgs/testorg/projects/7',
  closed: false,
};

const MOCK_FIELDS = {
  fields: [
    { id: 'PVTF_title', name: 'Title', type: 'TEXT' },
    {
      id: 'PVTSSF_status',
      name: 'Status',
      type: 'SINGLE_SELECT',
      options: [
        { id: 'opt_backlog', name: 'Backlog' },
        { id: 'opt_todo', name: 'To Do' },
        { id: 'opt_inprogress', name: 'In Progress' },
        { id: 'opt_inreview', name: 'In Review' },
        { id: 'opt_done', name: 'Done' },
      ],
    },
  ],
};

// ── Helper: set up execFileSync responses per call ──────────────────────────

/**
 * Configure the mock so that:
 *   - The first call (git remote get-url origin) returns the repo URL.
 *   - Subsequent calls return the supplied responses in order.
 *
 * Each element of `ghResponses` is either a string (raw stdout) or an Error
 * to throw.
 */
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

// ── createProject ───────────────────────────────────────────────────────────

describe('createProject', () => {
  it('returns a GhProject on success', () => {
    setupExecMock(JSON.stringify(MOCK_PROJECT));

    const result = createProject('My Board');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.number).toBe(7);
    expect(result.data.title).toBe('My Board');
    expect(result.data.id).toBe('PVT_kwDOAbc123');
    expect(result.data.url).toBe(MOCK_PROJECT.url);
    expect(result.data.closed).toBe(false);
    expect(result.data.description).toBe('');
  });

  it('passes owner and title to gh project create', () => {
    setupExecMock(JSON.stringify(MOCK_PROJECT));

    createProject('My Board', 'testorg');

    const calls = execFileSyncMock.mock.calls;
    const ghCall = calls.find((c) => c[0] === 'gh' && (c[1] as string[])?.[0] === 'project');
    if (!ghCall) throw new Error('Expected a gh project call');
    const ghArgs = ghCall[1] as string[];
    expect(ghArgs).toContain('create');
    expect(ghArgs).toContain('--owner');
    expect(ghArgs).toContain('testorg');
    expect(ghArgs).toContain('--title');
    expect(ghArgs).toContain('My Board');
  });

  it('returns an error result when gh CLI fails', () => {
    setupExecMock(new Error('gh: 401 Unauthorized'));

    const result = createProject('My Board');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('returns UNKNOWN error for non-JSON response', () => {
    setupExecMock('not valid json at all');

    const result = createProject('My Board');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
    expect(result.error).toContain('non-JSON');
  });
});

// ── listProjects ────────────────────────────────────────────────────────────

describe('listProjects', () => {
  it('returns an array of projects', () => {
    const payload = {
      projects: [
        MOCK_PROJECT,
        { id: 'PVT_kwDOXyz', number: 8, title: 'Other Board', url: 'https://github.com/orgs/testorg/projects/8', closed: false },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = listProjects();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].number).toBe(7);
    expect(result.data[1].title).toBe('Other Board');
  });

  it('returns an empty array when projects list is empty', () => {
    setupExecMock(JSON.stringify({ projects: [] }));

    const result = listProjects();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('handles missing projects key gracefully', () => {
    // Some gh versions may omit the key entirely
    setupExecMock(JSON.stringify({}));

    const result = listProjects();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual([]);
  });

  it('maps closed flag correctly', () => {
    const payload = {
      projects: [
        { ...MOCK_PROJECT, closed: true },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = listProjects();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].closed).toBe(true);
  });

  it('returns error result when gh CLI throws', () => {
    setupExecMock(new Error('gh: 403 Forbidden'));

    const result = listProjects();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});

// ── findProject ─────────────────────────────────────────────────────────────

describe('findProject', () => {
  it('returns the matching project when found', () => {
    const payload = { projects: [MOCK_PROJECT] };
    setupExecMock(JSON.stringify(payload));

    const result = findProject('My Board');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toBeNull();
    expect(result.data?.title).toBe('My Board');
    expect(result.data?.number).toBe(7);
  });

  it('returns null when no project matches the title', () => {
    const payload = { projects: [MOCK_PROJECT] };
    setupExecMock(JSON.stringify(payload));

    const result = findProject('Nonexistent Board');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('returns null for empty project list', () => {
    setupExecMock(JSON.stringify({ projects: [] }));

    const result = findProject('Any Title');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('does exact title matching (not partial)', () => {
    const payload = {
      projects: [
        { ...MOCK_PROJECT, title: 'My Board Extended' },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = findProject('My Board');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('propagates error from listProjects', () => {
    setupExecMock(new Error('gh: 404 Not Found'));

    const result = findProject('My Board');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── listProjectFields ────────────────────────────────────────────────────────

describe('listProjectFields', () => {
  it('returns field definitions', () => {
    setupExecMock(JSON.stringify(MOCK_FIELDS));

    const result = listProjectFields(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('Title');
    expect(result.data[0].dataType).toBe('TEXT');
    expect(result.data[1].name).toBe('Status');
    expect(result.data[1].dataType).toBe('SINGLE_SELECT');
  });

  it('maps options array correctly', () => {
    setupExecMock(JSON.stringify(MOCK_FIELDS));

    const result = listProjectFields(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const statusField = result.data.find((f) => f.name === 'Status');
    expect(statusField?.options).toHaveLength(5);
    expect(statusField?.options?.[0]).toEqual({ id: 'opt_backlog', name: 'Backlog' });
  });

  it('handles fields without options gracefully', () => {
    const payload = {
      fields: [
        { id: 'PVTF_phase', name: 'Phase', type: 'NUMBER' },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = listProjectFields(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data[0].options).toBeUndefined();
  });

  it('passes project number as string in gh args', () => {
    setupExecMock(JSON.stringify(MOCK_FIELDS));

    listProjectFields(42, 'testorg');

    const calls = execFileSyncMock.mock.calls;
    const ghCall = calls.find((c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'field-list');
    if (!ghCall) throw new Error('Expected a gh field-list call');
    const ghArgs = ghCall[1] as string[];
    expect(ghArgs).toContain('42');
    expect(ghArgs).toContain('testorg');
  });

  it('returns error result when gh CLI fails', () => {
    setupExecMock(new Error('gh: 404 Not Found'));

    const result = listProjectFields(7);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── getStatusField ───────────────────────────────────────────────────────────

describe('getStatusField', () => {
  it('returns the Status field with its options', () => {
    setupExecMock(JSON.stringify(MOCK_FIELDS));

    const result = getStatusField(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).not.toBeNull();
    expect(result.data?.name).toBe('Status');
    expect(result.data?.dataType).toBe('SINGLE_SELECT');
    expect(result.data?.options).toHaveLength(5);
  });

  it('returns null when no Status field exists on the project', () => {
    const payload = {
      fields: [
        { id: 'PVTF_title', name: 'Title', type: 'TEXT' },
        { id: 'PVTF_phase', name: 'Phase', type: 'NUMBER' },
      ],
    };
    setupExecMock(JSON.stringify(payload));

    const result = getStatusField(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('returns all five board columns as options', () => {
    setupExecMock(JSON.stringify(MOCK_FIELDS));

    const result = getStatusField(7);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const names = result.data?.options?.map((o) => o.name);
    expect(names).toContain('Backlog');
    expect(names).toContain('To Do');
    expect(names).toContain('In Progress');
    expect(names).toContain('In Review');
    expect(names).toContain('Done');
  });

  it('propagates error from listProjectFields', () => {
    setupExecMock(new Error('gh: 401 Unauthorized'));

    const result = getStatusField(7);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNAUTHORIZED');
  });
});

// ── addItemToProject ─────────────────────────────────────────────────────────

describe('addItemToProject', () => {
  it('returns the item ID when issue is added successfully', () => {
    const itemPayload = { id: 'PVTI_kwDOabc' };
    setupExecMock(JSON.stringify(itemPayload));

    const result = addItemToProject(7, 'https://github.com/testorg/testrepo/issues/42');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.itemId).toBe('PVTI_kwDOabc');
  });

  it('passes project number, owner, and issue URL to gh', () => {
    const itemPayload = { id: 'PVTI_kwDOabc' };
    setupExecMock(JSON.stringify(itemPayload));

    addItemToProject(7, 'https://github.com/testorg/testrepo/issues/42', 'testorg');

    const calls = execFileSyncMock.mock.calls;
    const ghCall = calls.find((c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'item-add');
    if (!ghCall) throw new Error('Expected a gh item-add call');
    const ghArgs = ghCall[1] as string[];
    expect(ghArgs).toContain('7');
    expect(ghArgs).toContain('testorg');
    expect(ghArgs).toContain('https://github.com/testorg/testrepo/issues/42');
  });

  it('returns error when gh CLI fails', () => {
    setupExecMock(new Error('gh: 404 Not Found'));

    const result = addItemToProject(7, 'https://github.com/testorg/testrepo/issues/99');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
  });
});

// ── moveItemToStatus ─────────────────────────────────────────────────────────

describe('moveItemToStatus', () => {
  it('successfully moves an item to a valid status column', () => {
    // Call order for moveItemToStatus:
    //   1. getStatusField -> listProjectFields -> gh field-list  (MOCK_FIELDS)
    //   2. listProjects -> gh project list                       (project list)
    //   3. ghExec -> gh project item-edit                        (empty stdout)
    const projectListPayload = { projects: [MOCK_PROJECT] };
    setupExecMock(
      JSON.stringify(MOCK_FIELDS),
      JSON.stringify(projectListPayload),
      '',
    );

    const result = moveItemToStatus(7, 'PVTI_kwDOabc', 'In Progress');

    expect(result.ok).toBe(true);
  });

  it('passes the correct field ID and option ID to gh item-edit', () => {
    const projectListPayload = { projects: [MOCK_PROJECT] };
    setupExecMock(
      JSON.stringify(MOCK_FIELDS),
      JSON.stringify(projectListPayload),
      '',
    );

    moveItemToStatus(7, 'PVTI_kwDOabc', 'Done');

    const calls = execFileSyncMock.mock.calls;
    const editCall = calls.find((c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'item-edit');
    if (!editCall) throw new Error('Expected a gh item-edit call');
    const args = editCall[1] as string[];
    expect(args).toContain('--field-id');
    expect(args).toContain('PVTSSF_status');
    expect(args).toContain('--single-select-option-id');
    expect(args).toContain('opt_done');
    expect(args).toContain('--id');
    expect(args).toContain('PVTI_kwDOabc');
  });

  it('returns NOT_FOUND when project has no Status field', () => {
    const noStatusFields = {
      fields: [{ id: 'PVTF_title', name: 'Title', type: 'TEXT' }],
    };
    setupExecMock(JSON.stringify(noStatusFields));

    const result = moveItemToStatus(7, 'PVTI_kwDOabc', 'Done');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
    expect(result.error).toContain('Status field not found');
  });

  it('returns VALIDATION error when status option name does not exist', () => {
    const projectListPayload = { projects: [MOCK_PROJECT] };
    setupExecMock(
      JSON.stringify(MOCK_FIELDS),
      JSON.stringify(projectListPayload),
    );

    const result = moveItemToStatus(7, 'PVTI_kwDOabc', 'Nonexistent Column');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION');
    expect(result.error).toContain('"Nonexistent Column"');
    expect(result.error).toContain('Available:');
  });

  it('returns NOT_FOUND when the project number is not in list', () => {
    const emptyList = { projects: [] };
    setupExecMock(
      JSON.stringify(MOCK_FIELDS),
      JSON.stringify(emptyList),
    );

    const result = moveItemToStatus(7, 'PVTI_kwDOabc', 'Done');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
    expect(result.error).toContain('#7');
  });

  it('propagates error from getStatusField', () => {
    setupExecMock(new Error('gh: 403 Forbidden'));

    const result = moveItemToStatus(7, 'PVTI_kwDOabc', 'Done');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });
});

// ── ensureProjectBoard ───────────────────────────────────────────────────────

describe('ensureProjectBoard', () => {
  it('creates a new project when none is found and returns it with its Status field', async () => {
    // Call order:
    //   1. findProject -> listProjects -> gh project list   (empty)
    //   2. createProject -> gh project create               (new project)
    //   3. getStatusField -> listProjectFields -> gh field-list (fields with all columns)
    const emptyList = { projects: [] };
    setupExecMock(
      JSON.stringify(emptyList),
      JSON.stringify(MOCK_PROJECT),
      JSON.stringify(MOCK_FIELDS),
    );

    const result = await ensureProjectBoard('My Board', 'testorg');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.project.title).toBe('My Board');
    expect(result.data.project.number).toBe(7);
    expect(result.data.statusField.name).toBe('Status');
  });

  it('returns existing project without creating a new one', async () => {
    // Call order:
    //   1. findProject -> listProjects -> gh project list   (project found)
    //   2. getStatusField -> listProjectFields -> gh field-list
    const projectList = { projects: [MOCK_PROJECT] };
    setupExecMock(
      JSON.stringify(projectList),
      JSON.stringify(MOCK_FIELDS),
    );

    const result = await ensureProjectBoard('My Board', 'testorg');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.project.number).toBe(7);

    // Verify create was NOT called
    const calls = execFileSyncMock.mock.calls;
    const createCall = calls.find(
      (c) => c[0] === 'gh' && (c[1] as string[])?.[1] === 'create',
    );
    expect(createCall).toBeUndefined();
  });

  it('returns NOT_FOUND when Status field is absent after creation', async () => {
    const emptyList = { projects: [] };
    const noStatusFields = {
      fields: [{ id: 'PVTF_title', name: 'Title', type: 'TEXT' }],
    };
    setupExecMock(
      JSON.stringify(emptyList),
      JSON.stringify(MOCK_PROJECT),
      JSON.stringify(noStatusFields),
    );

    const result = await ensureProjectBoard('My Board', 'testorg');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NOT_FOUND');
    expect(result.error).toContain('Status field not found');
  });

  it('updates Status field with missing board columns via GraphQL', async () => {
    // Status field exists but is missing columns
    const partialFields = {
      fields: [
        {
          id: 'PVTSSF_status',
          name: 'Status',
          type: 'SINGLE_SELECT',
          options: [
            { id: 'opt_backlog', name: 'Backlog', color: 'GRAY' },
          ],
        },
      ],
    };
    const projectList = { projects: [MOCK_PROJECT] };
    // After GraphQL mutation call, return empty string (success)
    setupExecMock(
      JSON.stringify(projectList),
      JSON.stringify(partialFields),
      '', // GraphQL updateProjectV2Field mutation
    );

    const result = await ensureProjectBoard('My Board', 'testorg');

    expect(result.ok).toBe(true);

    const calls = execFileSyncMock.mock.calls;
    const graphqlCalls = calls.filter(
      (c) => c[0] === 'gh' && (c[1] as string[])?.[0] === 'api' && (c[1] as string[])?.[1] === 'graphql',
    );
    // Should make one GraphQL call to update Status field options
    expect(graphqlCalls.length).toBe(1);
  });

  it('returns ok: false when GraphQL mutation to add missing Status options fails', async () => {
    // Status field exists but is missing columns, and the GraphQL update fails.
    // We need a custom mock because setupExecMock catches all `gh api` calls
    // as getRepoInfo type-detection. Here we differentiate `gh api graphql`
    // (the mutation) from `gh api /users/...` (the type check).
    const partialFields = {
      fields: [
        {
          id: 'PVTSSF_status',
          name: 'Status',
          type: 'SINGLE_SELECT',
          options: [
            { id: 'opt_backlog', name: 'Backlog', color: 'GRAY' },
          ],
        },
      ],
    };
    const projectList = { projects: [MOCK_PROJECT] };
    const ghResponses = [
      JSON.stringify(projectList),
      JSON.stringify(partialFields),
    ];
    let callIndex = 0;
    execFileSyncMock.mockImplementation((_cmd: string, args?: readonly string[]) => {
      const argList = args ?? [];

      // git calls used by getRepoInfo
      if (_cmd === 'git') {
        if (argList[0] === 'remote') return REPO_REMOTE_URL;
      }

      // gh api /users/* call used to detect org/user type
      if (_cmd === 'gh' && argList[0] === 'api' && String(argList[1]).startsWith('/users/')) {
        return 'User';
      }

      // gh api graphql — the mutation call should fail
      if (_cmd === 'gh' && argList[0] === 'api' && argList[1] === 'graphql') {
        throw new Error('gh: GraphQL mutation failed');
      }

      // All other gh calls — dispatch from the queue
      const response = ghResponses[callIndex++];
      if (response instanceof Error) throw response;
      return response ?? '';
    });

    const result = await ensureProjectBoard('My Board', 'testorg');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN');
    expect(result.error).toContain('Failed to add missing Status options');
  });

  it('propagates error from findProject', async () => {
    setupExecMock(new Error('gh: 401 Unauthorized'));

    const result = await ensureProjectBoard('My Board', 'testorg');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNAUTHORIZED');
  });

  it('propagates error from createProject when list is empty', async () => {
    const emptyList = { projects: [] };
    setupExecMock(
      JSON.stringify(emptyList),
      new Error('gh: 403 Forbidden'),
    );

    const result = await ensureProjectBoard('My Board', 'testorg');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FORBIDDEN');
  });

  it('uses repo owner when no explicit owner is passed', async () => {
    // With no owner arg, getRepoInfo provides 'testorg' from the mocked remote
    const projectList = { projects: [MOCK_PROJECT] };
    setupExecMock(
      JSON.stringify(projectList),
      JSON.stringify(MOCK_FIELDS),
    );

    const result = await ensureProjectBoard('My Board');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.project.number).toBe(7);
  });
});
