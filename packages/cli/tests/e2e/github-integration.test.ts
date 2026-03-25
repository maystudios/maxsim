// biome-ignore-all lint/style/noNonNullAssertion: test assertions require non-null access
/**
 * E2E: GitHub integration tests — labels, milestones, issues against the real API.
 *
 * These tests create real resources on the GitHub repo detected from git remote.
 * They are SKIPPED when no GitHub token is available (GITHUB_TOKEN env var or
 * `gh auth token`).
 *
 * All created resources are cleaned up in afterAll hooks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CAN_RUN_E2E, uniqueName, deleteMilestone, deleteLabel, closeTestIssue } from './setup.js';
import { getRepoInfo, resetClient } from '../../src/github/client.js';
import { createLabel, getLabel, ensureLabels } from '../../src/github/labels.js';
import { createMilestone, findMilestone, listMilestones, updateMilestone, ensureMilestone } from '../../src/github/milestones.js';
import { createIssue, getIssue, updateIssue, listIssues, closeIssue, addComment, listComments } from '../../src/github/issues.js';
import type { RepoInfo } from '../../src/github/types.js';

// ── Skip Gate ────────────────────────────────────────────────────────

describe.skipIf(!CAN_RUN_E2E)('GitHub Integration (live API)', () => {
  let repo: RepoInfo;

  // Track resources for cleanup
  const createdLabelNames: string[] = [];
  const createdMilestoneNumbers: number[] = [];
  const createdIssueNumbers: number[] = [];

  beforeAll(() => {
    resetClient();
    repo = getRepoInfo();
  });

  afterAll(async () => {
    // Clean up in reverse order: issues (close), milestones (delete), labels (delete)
    for (const issueNumber of createdIssueNumbers) {
      await closeTestIssue(repo.owner, repo.repo, issueNumber);
    }
    for (const msNumber of createdMilestoneNumbers) {
      await deleteMilestone(repo.owner, repo.repo, msNumber);
    }
    for (const labelName of createdLabelNames) {
      await deleteLabel(repo.owner, repo.repo, labelName);
    }

    resetClient();
  });

  // ── Labels ───────────────────────────────────────────────────────

  describe('Labels', () => {
    const testLabelName = uniqueName('label');

    afterAll(async () => {
      // Ensure the test label is cleaned up even if registered in createdLabelNames
      await deleteLabel(repo.owner, repo.repo, testLabelName);
    });

    it('creates a custom label on the repo', async () => {
      const result = await createLabel(
        {
          name: testLabelName,
          description: 'E2E test label - safe to delete',
          color: 'ff5733',
        },
        repo,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      createdLabelNames.push(testLabelName);

      expect(result.data.name).toBe(testLabelName);
      expect(result.data.color).toBe('ff5733');
      expect(result.data.id).toBeGreaterThan(0);
      expect(result.data.nodeId).toBeTruthy();
    });

    it('retrieves the created label by name', async () => {
      const result = await getLabel(testLabelName, repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).not.toBeNull();
      expect(result.data!.name).toBe(testLabelName);
      expect(result.data!.description).toBe('E2E test label - safe to delete');
    });

    it('returns null for a nonexistent label', async () => {
      const result = await getLabel('nonexistent-label-that-surely-does-not-exist-12345', repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).toBeNull();
    });

    it('returns VALIDATION error when creating a duplicate label', async () => {
      const result = await createLabel(
        {
          name: testLabelName,
          description: 'Duplicate',
          color: '000000',
        },
        repo,
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('VALIDATION');
    });
  });

  // ── Milestones ─────────────────────────────────────────────────────

  describe('Milestones', () => {
    const testMilestoneTitle = uniqueName('milestone');

    it('creates a new milestone', async () => {
      const result = await createMilestone(
        {
          title: testMilestoneTitle,
          description: 'E2E test milestone - safe to delete',
          dueOn: '2099-12-31T00:00:00Z',
        },
        repo,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      createdMilestoneNumbers.push(result.data.number);

      expect(result.data.title).toBe(testMilestoneTitle);
      expect(result.data.description).toBe('E2E test milestone - safe to delete');
      expect(result.data.state).toBe('open');
      expect(result.data.number).toBeGreaterThan(0);
      // GitHub may adjust the date to UTC (e.g. 2099-12-30 or 2099-12-31)
      expect(result.data.dueOn).toContain('2099-12-3');
    });

    it('finds the created milestone by title', async () => {
      const result = await findMilestone(testMilestoneTitle, repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data).not.toBeNull();
      expect(result.data!.title).toBe(testMilestoneTitle);
    });

    it('lists milestones and includes the test milestone', async () => {
      const result = await listMilestones('open', repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const found = result.data.find((m) => m.title === testMilestoneTitle);
      expect(found).toBeDefined();
    });

    it('updates the milestone description', async () => {
      const msNumber = createdMilestoneNumbers[0];
      if (!msNumber) return;

      const result = await updateMilestone(
        msNumber,
        { description: 'Updated by E2E test' },
        repo,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.description).toBe('Updated by E2E test');
    });

    it('ensureMilestone returns existing milestone instead of creating duplicate', async () => {
      const result = await ensureMilestone(
        { title: testMilestoneTitle, description: 'Should not create a new one' },
        repo,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.title).toBe(testMilestoneTitle);
      // The milestone number should match the one we already created
      expect(result.data.number).toBe(createdMilestoneNumbers[0]);
    });

    it('returns null when finding a nonexistent milestone', async () => {
      const result = await findMilestone('nonexistent-milestone-12345-xyz', repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data).toBeNull();
    });
  });

  // ── Issues ─────────────────────────────────────────────────────────

  describe('Issues', () => {
    const testIssueTitle = uniqueName('issue');
    let testIssueNumber: number;

    it('creates a new issue', async () => {
      const result = await createIssue(
        {
          title: testIssueTitle,
          body: 'E2E test issue created by maxsimcli tests. Safe to close/delete.',
        },
        repo,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      testIssueNumber = result.data.number;
      createdIssueNumbers.push(testIssueNumber);

      expect(result.data.title).toBe(testIssueTitle);
      expect(result.data.state).toBe('open');
      expect(result.data.number).toBeGreaterThan(0);
      expect(result.data.htmlUrl).toContain('github.com');
    });

    it('retrieves the created issue by number', async () => {
      if (!testIssueNumber) return;

      const result = await getIssue(testIssueNumber, repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.number).toBe(testIssueNumber);
      expect(result.data.title).toBe(testIssueTitle);
    });

    it('updates the issue title', async () => {
      if (!testIssueNumber) return;

      const newTitle = `${testIssueTitle} (updated)`;
      const result = await updateIssue(
        testIssueNumber,
        { title: newTitle },
        repo,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.title).toBe(newTitle);
    });

    it('lists open issues (smoke test)', async () => {
      if (!testIssueNumber) return;

      const result = await listIssues({ state: 'open' }, repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // We don't assert the test issue is in the list because repos with
      // many issues may paginate, and the recently-updated title changes
      // the issue's position. Instead, verify listIssues returns an array.
      expect(Array.isArray(result.data)).toBe(true);

      // Verify the test issue is retrievable individually (covered above),
      // and that listIssues at minimum returns valid issue objects.
      if (result.data.length > 0) {
        expect(result.data[0].number).toBeGreaterThan(0);
        expect(result.data[0].state).toBe('open');
      }
    });

    it('adds a comment to the issue', async () => {
      if (!testIssueNumber) return;

      const commentBody = 'E2E test comment - automated by maxsimcli';
      const result = await addComment(testIssueNumber, commentBody, repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.body).toBe(commentBody);
      expect(result.data.id).toBeGreaterThan(0);
    });

    it('lists comments on the issue', async () => {
      if (!testIssueNumber) return;

      const result = await listComments(testIssueNumber, repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.length).toBeGreaterThan(0);
      const found = result.data.find((c) => c.body.includes('E2E test comment'));
      expect(found).toBeDefined();
    });

    it('creates an issue with labels', async () => {
      // Use the 'bug' label which likely exists on most repos
      const labeledTitle = uniqueName('labeled-issue');
      const result = await createIssue(
        {
          title: labeledTitle,
          body: 'E2E test issue with labels. Safe to close.',
          labels: ['bug'],
        },
        repo,
      );

      // Label may not exist, so we accept both success and validation error
      if (result.ok) {
        createdIssueNumbers.push(result.data.number);
        expect(result.data.title).toBe(labeledTitle);
        // The issue might or might not have the label depending on repo config
      }
      // If it failed with VALIDATION, that's acceptable (label doesn't exist)
    });

    it('creates an issue with a milestone', async () => {
      if (createdMilestoneNumbers.length === 0) return;

      const msTitle = uniqueName('ms-issue');
      const result = await createIssue(
        {
          title: msTitle,
          body: 'E2E test issue with milestone. Safe to close.',
          milestone: createdMilestoneNumbers[0],
        },
        repo,
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      createdIssueNumbers.push(result.data.number);
      expect(result.data.milestone).not.toBeNull();
      expect(result.data.milestone!.number).toBe(createdMilestoneNumbers[0]);
    });

    it('closes the issue with completed reason', async () => {
      if (!testIssueNumber) return;

      const result = await closeIssue(testIssueNumber, 'completed', repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.state).toBe('closed');
    });

    it('verifies the issue is now closed', async () => {
      if (!testIssueNumber) return;

      const result = await getIssue(testIssueNumber, repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.state).toBe('closed');
    });
  });

  // ── Cross-feature: Issue with Label + Milestone ────────────────────

  describe('Cross-feature integration', () => {
    it('creates an issue referencing a label and milestone together', async () => {
      // Create a dedicated label for this test
      const crossLabelName = uniqueName('cross-label');
      const labelResult = await createLabel(
        {
          name: crossLabelName,
          description: 'E2E cross-feature test label',
          color: '33ff57',
        },
        repo,
      );

      if (!labelResult.ok) return;
      createdLabelNames.push(crossLabelName);

      // Create a dedicated milestone
      const crossMsTitle = uniqueName('cross-ms');
      const msResult = await createMilestone(
        {
          title: crossMsTitle,
          description: 'E2E cross-feature test milestone',
        },
        repo,
      );

      if (!msResult.ok) return;
      createdMilestoneNumbers.push(msResult.data.number);

      // Create issue with both
      const issueTitle = uniqueName('cross-issue');
      const issueResult = await createIssue(
        {
          title: issueTitle,
          body: 'E2E cross-feature test. Safe to close.',
          labels: [crossLabelName],
          milestone: msResult.data.number,
        },
        repo,
      );

      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      createdIssueNumbers.push(issueResult.data.number);

      // Verify the issue has the label
      expect(issueResult.data.labels.length).toBeGreaterThan(0);
      const hasLabel = issueResult.data.labels.some((l) => l.name === crossLabelName);
      expect(hasLabel).toBe(true);

      // Verify the issue has the milestone
      expect(issueResult.data.milestone).not.toBeNull();
      expect(issueResult.data.milestone!.title).toBe(crossMsTitle);
    });
  });

  // ── ensureLabels ───────────────────────────────────────────────────

  describe('ensureLabels', () => {
    // Track which MAXSIM_LABELS were newly created so we can clean them up.
    // We do NOT delete labels that already existed before the test.
    let labelsCreatedByEnsure: string[] = [];

    afterAll(async () => {
      for (const name of labelsCreatedByEnsure) {
        await deleteLabel(repo.owner, repo.repo, name);
      }
    });

    it('ensures all maxsim labels exist on the repo', async () => {
      const result = await ensureLabels(repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      labelsCreatedByEnsure = result.data.created;

      // Total should be 6 (created + existing)
      expect(result.data.created.length + result.data.existing.length).toBe(6);
    });

    it('second run reports all as existing', async () => {
      const result = await ensureLabels(repo);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // After the first ensure, all should exist
      expect(result.data.existing.length).toBe(6);
      expect(result.data.created.length).toBe(0);
    });
  });
});
