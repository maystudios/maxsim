// biome-ignore-all lint/style/noNonNullAssertion: test assertions require non-null access
/**
 * E2E: GitHub Projects v2 — board management against the real API.
 *
 * These tests create a real GitHub Project v2, add items, move them
 * through status columns, and verify listing. The project is cleaned
 * up in afterAll via deleteProject.
 *
 * SKIPPED when no GitHub token is available (GITHUB_TOKEN env var or
 * `gh auth token`).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CAN_RUN_E2E, uniqueName, deleteProject, closeTestIssue } from './setup.js';
import { getRepoInfo, resetClient } from '../../src/github/client.js';
import {
  ensureProjectBoard,
  findProject,
  addItemToProject,
  moveItemToStatus,
  listProjectItems,
  getStatusField,
} from '../../src/github/projects.js';
import { createIssue } from '../../src/github/issues.js';
import { BOARD_COLUMNS } from '../../src/github/types.js';
import type { RepoInfo, GhProject, GhProjectField } from '../../src/github/types.js';

// ── Skip Gate ────────────────────────────────────────────────────────

describe.skipIf(!CAN_RUN_E2E)('GitHub Projects (live API)', () => {
  let repo: RepoInfo;

  // Resources created during tests, cleaned up in afterAll
  const projectName = uniqueName('project');
  let projectId: string;
  let projectNumber: number;
  let statusField: GhProjectField;
  let testIssueNumber: number;
  let testIssueHtmlUrl: string;
  let projectItemId: string;

  beforeAll(() => {
    resetClient();
    repo = getRepoInfo();
  });

  afterAll(async () => {
    // Clean up issue first (close), then delete project
    if (testIssueNumber) {
      await closeTestIssue(repo.owner, repo.repo, testIssueNumber);
    }
    if (projectNumber) {
      await deleteProject(projectNumber);
    }
    resetClient();
  });

  // ── 1. ensureProjectBoard creates project with Status field ──────

  it('ensureProjectBoard creates project with BOARD_COLUMNS', async () => {
    const result = await ensureProjectBoard(projectName);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    projectId = result.data.project.id;
    projectNumber = result.data.project.number;
    statusField = result.data.statusField;

    // Verify project metadata
    expect(result.data.project.title).toBe(projectName);
    expect(result.data.project.number).toBeGreaterThan(0);
    expect(result.data.project.id).toBeTruthy();

    // Verify Status field exists and has the correct type
    expect(result.data.statusField.name).toBe('Status');

    // Re-fetch the Status field to verify all BOARD_COLUMNS options exist
    const freshStatus = getStatusField(projectNumber);
    expect(freshStatus.ok).toBe(true);
    if (!freshStatus.ok) return;

    const optionNames = freshStatus.data!.options?.map((o) => o.name) ?? [];
    for (const col of BOARD_COLUMNS) {
      expect(optionNames).toContain(col.name);
    }
  });

  // ── 2. findProject idempotency ────────────────────────────────────

  it('findProject returns the same project by title', () => {
    const result = findProject(projectName);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data).not.toBeNull();
    expect(result.data!.id).toBe(projectId);
    expect(result.data!.number).toBe(projectNumber);
    expect(result.data!.title).toBe(projectName);
  });

  // ── 3. addItemToProject + moveItemToStatus("In Progress") ────────

  it('adds an issue to the project and moves to In Progress', async () => {
    // First, create a test issue to add to the project
    const issueTitle = uniqueName('proj-item');
    const issueResult = await createIssue(
      {
        title: issueTitle,
        body: 'E2E test issue for project board. Safe to close.',
      },
      repo,
    );

    expect(issueResult.ok).toBe(true);
    if (!issueResult.ok) return;

    testIssueNumber = issueResult.data.number;
    testIssueHtmlUrl = issueResult.data.htmlUrl;

    // Add the issue to the project
    const addResult = addItemToProject(projectNumber, testIssueHtmlUrl);

    expect(addResult.ok).toBe(true);
    if (!addResult.ok) return;

    projectItemId = addResult.data.itemId;
    expect(projectItemId).toBeTruthy();

    // Move the item to "In Progress"
    const moveResult = moveItemToStatus(projectNumber, projectItemId, 'In Progress');

    expect(moveResult.ok).toBe(true);
  });

  // ── 4. listProjectItems verification ──────────────────────────────

  it('listProjectItems returns the added item', () => {
    const result = listProjectItems(projectNumber);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.length).toBeGreaterThan(0);

    // Find our specific item by issue number
    const item = result.data.find((i) => i.issueNumber === testIssueNumber);
    expect(item).toBeDefined();
    expect(item!.id).toBeTruthy();
    expect(item!.contentType).toBe('Issue');
    expect(item!.isArchived).toBe(false);
  });

  // ── 5. moveItemToStatus("Done") column transition ────────────────

  it('moves item from In Progress to Done', () => {
    const moveResult = moveItemToStatus(projectNumber, projectItemId, 'Done');

    expect(moveResult.ok).toBe(true);

    // Verify the item is still on the board (not removed by the move)
    const listResult = listProjectItems(projectNumber);
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;

    const item = listResult.data.find((i) => i.issueNumber === testIssueNumber);
    expect(item).toBeDefined();
    expect(item!.isArchived).toBe(false);
  });
});
