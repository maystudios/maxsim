/**
 * GitHub CLI Commands -- GitHub operations exposed as CLI tool commands
 *
 * Provides cmd* functions for all 27 GitHub CLI commands. Each function follows
 * the CmdResult pattern used throughout the codebase, wrapping the existing
 * adapter modules with auth checks and project root detection.
 *
 * Replaces the MCP server tools with direct CLI invocations.
 *
 * CRITICAL: Never call process.exit() -- return CmdResult instead.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { CmdResult } from '../core/index.js';
import {
  requireAuth,
  getOctokit,
  getRepoInfo,
} from './client.js';
import { AuthError } from './types.js';
import type { IssueStatus, IssueMappingFile, TaskIssueMapping } from './types.js';

import {
  createPhaseIssue,
  createTaskSubIssue,
  postPlanComment,
  closeIssue,
  reopenIssue,
  getPhaseIssue,
  listPhaseSubIssues,
  postCompletionComment,
  postComment,
} from './issues.js';

import {
  ensureProjectBoard,
  addItemToProject,
  moveItemToStatus,
  getProjectBoard,
} from './projects.js';

import { ensureLabels } from './labels.js';
import { ensureMilestone } from './milestones.js';
import { installIssueTemplates } from './templates.js';

import {
  loadMapping,
  saveMapping,
  updateTaskMapping,
  hashBody,
} from './mapping.js';

import {
  checkPhaseProgress,
  getAllPhasesProgress,
  detectInterruptedPhase,
} from './sync.js';

// ---- Helpers ----------------------------------------------------------------

/**
 * Walk up from startDir to find a directory containing `.planning/`.
 * Returns the directory containing `.planning/` or null if not found.
 *
 * Copied from mcp/utils.ts to avoid depending on the MCP module.
 */
function detectProjectRoot(startDir?: string): string | null {
  let dir = startDir || process.cwd();

  for (let i = 0; i < 100; i++) {
    const planningDir = path.join(dir, '.planning');
    try {
      const stat = fs.statSync(planningDir);
      if (stat.isDirectory()) {
        return dir;
      }
    } catch {
      // Not found here, walk up
    }

    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }

  return null;
}

/**
 * Auth guard -- returns a CmdResult error if auth fails, otherwise null.
 */
function checkAuth(): CmdResult | null {
  try {
    requireAuth();
    return null;
  } catch (e) {
    if (e instanceof AuthError) {
      return { ok: false, error: `GitHub auth required: ${e.message}` };
    }
    throw e;
  }
}

/**
 * Find an issue entry in the mapping file (searches phases and todos).
 * Used for status updates on close/bounce.
 */
function updateLocalMappingStatus(
  mapping: IssueMappingFile,
  issueNumber: number,
  status: IssueStatus,
): boolean {
  for (const phase of Object.values(mapping.phases)) {
    if (phase.tracking_issue.number === issueNumber) {
      phase.tracking_issue.status = status;
      return true;
    }
    for (const task of Object.values(phase.tasks)) {
      if (task.number === issueNumber) {
        task.status = status;
        return true;
      }
    }
  }
  return false;
}

// ---- 1. cmdGitHubSetup ------------------------------------------------------

/**
 * Set up GitHub integration: create project board, labels, milestone, and issue templates.
 */
export async function cmdGitHubSetup(
  cwd: string,
  milestoneTitle?: string | null,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const root = detectProjectRoot(cwd);
    if (!root) {
      return { ok: false, error: 'No .planning/ directory found. Project not detected.' };
    }

    const boardTitle = 'MAXSIM Task Board';
    const boardResult = await ensureProjectBoard(boardTitle);
    if (!boardResult.ok) {
      return { ok: false, error: `Board setup failed: ${boardResult.error}` };
    }

    const labelsResult = await ensureLabels();
    if (!labelsResult.ok) {
      return { ok: false, error: `Label setup failed: ${labelsResult.error}` };
    }

    let milestoneData: { number: number } | null = null;
    if (milestoneTitle) {
      const msResult = await ensureMilestone(milestoneTitle);
      if (msResult.ok) {
        milestoneData = msResult.data;
      }
    }

    installIssueTemplates(root);

    const data = {
      board: {
        projectNumber: boardResult.data.projectNumber,
        projectId: boardResult.data.projectId,
      },
      labels_created: true,
      milestone: milestoneData
        ? { number: milestoneData.number, title: milestoneTitle }
        : null,
      templates_installed: true,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 2. cmdGitHubCreatePhase ------------------------------------------------

/**
 * Create a GitHub Issue for a MAXSIM phase with auto-board placement.
 */
export async function cmdGitHubCreatePhase(
  cwd: string,
  phaseNumber: string,
  phaseName: string,
  goal: string,
  requirements?: string[],
  successCriteria?: string[],
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await createPhaseIssue(
      phaseNumber,
      phaseName,
      goal,
      requirements ?? [],
      successCriteria ?? [],
    );

    if (!result.ok) {
      return { ok: false, error: `Phase issue creation failed: ${result.error}` };
    }

    const data: Record<string, unknown> = {
      issue_number: result.data.number,
      issue_id: result.data.id,
    };

    // Auto-add to board and set status "To Do"
    const root = detectProjectRoot(cwd);
    if (root) {
      const mapping = loadMapping(root);
      if (mapping && mapping.project_number) {
        const addResult = await addItemToProject(mapping.project_number, result.data.number);
        if (addResult.ok) {
          data.item_id = addResult.data.itemId;
          data.project_number = mapping.project_number;

          const moveResult = await moveItemToStatus(
            mapping.project_number,
            addResult.data.itemId,
            'To Do',
          );
          if (!moveResult.ok) {
            data.board_warning = `Added to board but could not set status: ${moveResult.error}`;
          }
        } else {
          data.board_warning = `Issue created but could not add to board: ${addResult.error}`;
        }
      }
    }

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 3. cmdGitHubCreateTask -------------------------------------------------

/**
 * Create a task sub-issue and link it to a parent phase Issue.
 */
export async function cmdGitHubCreateTask(
  cwd: string,
  phaseNumber: string,
  taskId: string,
  title: string,
  body: string,
  parentIssueNumber: number,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await createTaskSubIssue(
      phaseNumber,
      taskId,
      title,
      body,
      parentIssueNumber,
    );

    if (!result.ok) {
      return { ok: false, error: `Task issue creation failed: ${result.error}` };
    }

    const data: Record<string, unknown> = {
      issue_number: result.data.number,
      issue_id: result.data.id,
      parent_issue_number: parentIssueNumber,
    };

    // Auto-update mapping cache
    const root = detectProjectRoot(cwd);
    if (root) {
      try {
        updateTaskMapping(root, phaseNumber, taskId, {
          number: result.data.number,
          id: result.data.id,
          node_id: '',
          item_id: '',
          status: 'To Do',
        });
      } catch (mappingErr) {
        data.mapping_warning = `Issue created but mapping update failed: ${(mappingErr as Error).message}`;
      }
    }

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 4. cmdGitHubBatchCreateTasks -------------------------------------------

/**
 * Create multiple task sub-issues for a phase with automatic rollback on failure.
 */
export async function cmdGitHubBatchCreateTasks(
  cwd: string,
  phaseNumber: string,
  parentIssueNumber: number,
  tasksJson: Array<{ task_id: string; title: string; body: string }>,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const succeeded: Array<{ task_id: string; issue_number: number }> = [];
    const failed: Array<{ task_id: string; error: string }> = [];
    const created: Array<{ issueNumber: number; taskId: string }> = [];

    for (const task of tasksJson) {
      const result = await createTaskSubIssue(
        phaseNumber,
        task.task_id,
        task.title,
        task.body,
        parentIssueNumber,
      );

      if (result.ok) {
        created.push({ issueNumber: result.data.number, taskId: task.task_id });
        succeeded.push({ task_id: task.task_id, issue_number: result.data.number });

        // Update mapping cache (best-effort)
        const root = detectProjectRoot(cwd);
        if (root) {
          try {
            updateTaskMapping(root, phaseNumber, task.task_id, {
              number: result.data.number,
              id: result.data.id,
              node_id: '',
              item_id: '',
              status: 'To Do',
            });
          } catch {
            // Mapping update failure does not block batch
          }
        }
      } else {
        failed.push({ task_id: task.task_id, error: result.error });

        // Rollback: close all previously created issues with 'not_planned'
        const rolledBack: number[] = [];
        for (const c of [...created].reverse()) {
          const rollbackResult = await closeIssue(
            c.issueNumber,
            '[MAXSIM-ROLLBACK] Partial batch failure',
            'not_planned',
          );
          if (rollbackResult.ok) {
            rolledBack.push(c.issueNumber);
          }
        }

        const data = {
          succeeded,
          failed,
          rolled_back: rolledBack,
          partial: true,
        };

        return {
          ok: true,
          result: JSON.stringify(data, null, 2),
          rawValue: data,
        };
      }
    }

    const data = {
      succeeded,
      failed,
      rolled_back: [] as number[],
      partial: false,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 5. cmdGitHubPostPlanComment --------------------------------------------

/**
 * Post a structured plan comment on a phase issue.
 */
export async function cmdGitHubPostPlanComment(
  phaseIssueNumber: number,
  planNumber: string,
  planContent: string,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await postPlanComment(phaseIssueNumber, planNumber, planContent);

    if (!result.ok) {
      return { ok: false, error: `Plan comment failed: ${result.error}` };
    }

    const data = {
      phase_issue_number: phaseIssueNumber,
      plan_number: planNumber,
      comment_id: result.data.commentId,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 6. cmdGitHubPostComment ------------------------------------------------

/**
 * Post a comment on a GitHub issue with optional type marker.
 */
export async function cmdGitHubPostComment(
  issueNumber: number,
  body: string,
  type?: string | null,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    // Prefix body with type marker if provided
    const commentBody = type
      ? `<!-- maxsim:type=${type} -->\n${body}`
      : body;

    const result = await postComment(issueNumber, commentBody);
    if (!result.ok) {
      return { ok: false, error: `Comment failed: ${result.error}` };
    }

    const data = {
      issue_number: issueNumber,
      comment_id: result.data.commentId,
      type: type ?? 'general',
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 7. cmdGitHubPostCompletion ---------------------------------------------

/**
 * Post a structured completion comment on an issue.
 */
export async function cmdGitHubPostCompletion(
  issueNumber: number,
  commitSha: string,
  filesChanged: string[],
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await postCompletionComment(issueNumber, commitSha, filesChanged);
    if (!result.ok) {
      return { ok: false, error: `Completion comment failed: ${result.error}` };
    }

    const data = {
      issue_number: issueNumber,
      commit_sha: commitSha,
      comment_id: result.data.commentId,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 8. cmdGitHubGetIssue ---------------------------------------------------

/**
 * Get details of a specific GitHub issue, optionally including comments.
 */
export async function cmdGitHubGetIssue(
  issueNumber: number,
  includeComments?: boolean,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await getPhaseIssue(issueNumber);
    if (!result.ok) {
      return { ok: false, error: `Fetch failed: ${result.error}` };
    }

    const issue = result.data;
    const data: Record<string, unknown> = {
      number: issue.number,
      id: issue.id,
      title: issue.title,
      state: issue.state,
      body: issue.body,
      updated_at: issue.updated_at,
      labels: issue.labels,
      comments_url: issue.comments_url,
    };

    // Optionally fetch comments
    if (includeComments) {
      try {
        const octokit = getOctokit();
        const { owner, repo } = await getRepoInfo();
        const comments = await octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number: issueNumber,
          per_page: 100,
        });
        data.comments = comments.data.map(c => ({
          id: c.id,
          body: c.body ?? '',
          created_at: c.created_at,
          user: c.user?.login ?? '',
        }));
      } catch {
        data.comments_warning = 'Failed to fetch comments';
      }
    }

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 9. cmdGitHubListSubIssues ----------------------------------------------

/**
 * List all sub-issues of a phase issue.
 */
export async function cmdGitHubListSubIssues(
  phaseIssueNumber: number,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await listPhaseSubIssues(phaseIssueNumber);
    if (!result.ok) {
      return { ok: false, error: `List failed: ${result.error}` };
    }

    const data = {
      phase_issue_number: phaseIssueNumber,
      sub_issues: result.data,
      count: result.data.length,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 10. cmdGitHubCloseIssue ------------------------------------------------

/**
 * Close a GitHub issue with optional reason comment and auto-mapping update.
 */
export async function cmdGitHubCloseIssue(
  issueNumber: number,
  reason?: string | null,
  stateReason?: string | null,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const sr = (stateReason === 'not_planned' ? 'not_planned' : 'completed') as 'completed' | 'not_planned';
    const result = await closeIssue(issueNumber, reason ?? undefined, sr);
    if (!result.ok) {
      return { ok: false, error: `Close failed: ${result.error}` };
    }

    const data = {
      issue_number: issueNumber,
      closed: true,
      state_reason: sr,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 11. cmdGitHubReopenIssue -----------------------------------------------

/**
 * Reopen a closed GitHub issue.
 */
export async function cmdGitHubReopenIssue(
  issueNumber: number,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await reopenIssue(issueNumber);
    if (!result.ok) {
      return { ok: false, error: `Reopen failed: ${result.error}` };
    }

    const data = {
      issue_number: issueNumber,
      reopened: true,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 12. cmdGitHubBounceIssue -----------------------------------------------

/**
 * Bounce a task from In Review to In Progress with a feedback comment.
 */
export async function cmdGitHubBounceIssue(
  cwd: string,
  issueNumber: number,
  reason: string,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    let commented = false;
    let githubWarning: string | undefined;

    // Post reviewer feedback comment
    const commentBody = `## Bounced Back to In Progress\n\n**Reason:** ${reason}\n\n---\n*Review feedback posted by MAXSIM*`;
    const commentResult = await postComment(issueNumber, commentBody);
    commented = commentResult.ok;
    if (!commentResult.ok) {
      githubWarning = `Comment failed: ${commentResult.error}`;
    }

    // Update local mapping status (best-effort)
    const root = detectProjectRoot(cwd);
    if (root) {
      const mapping = loadMapping(root);
      if (mapping) {
        updateLocalMappingStatus(mapping, issueNumber, 'In Progress');
        saveMapping(root, mapping);
      }
    }

    const data: Record<string, unknown> = {
      issue_number: issueNumber,
      status: 'In Progress',
      commented,
      reason,
    };
    if (githubWarning) data.github_warning = githubWarning;

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 13. cmdGitHubMoveIssue -------------------------------------------------

/**
 * Move a GitHub issue to a new status column on the project board.
 *
 * Resolves `project_number` and `item_id` from the local mapping file
 * (`.planning/github-issues.json`) using the human-readable issue number.
 */
export async function cmdGitHubMoveIssue(
  cwd: string,
  issueNumber: number,
  status: string,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  if (!issueNumber) {
    return { ok: false, error: 'Missing --issue-number' };
  }
  if (!status) {
    return { ok: false, error: 'Missing --status' };
  }

  try {
    // Load the mapping file to resolve project_number and item_id
    const mapping = loadMapping(cwd);
    if (!mapping) {
      return { ok: false, error: 'github-issues.json not found. Run project setup first.' };
    }

    const projectNumber = mapping.project_number;
    if (!projectNumber) {
      return { ok: false, error: 'project_number not set in github-issues.json.' };
    }

    // Search through phases for a matching issue number
    let itemId: string | null = null;

    for (const phase of Object.values(mapping.phases)) {
      // Check tracking issue
      if (phase.tracking_issue?.number === issueNumber) {
        itemId = phase.tracking_issue.item_id;
        break;
      }
      // Check task sub-issues
      for (const task of Object.values(phase.tasks)) {
        if (task.number === issueNumber) {
          itemId = task.item_id;
          break;
        }
      }
      if (itemId) break;
    }

    // Also check todos
    if (!itemId && mapping.todos) {
      for (const todo of Object.values(mapping.todos)) {
        if (todo.number === issueNumber) {
          itemId = todo.item_id;
          break;
        }
      }
    }

    if (!itemId) {
      return { ok: false, error: `Issue #${issueNumber} not found in github-issues.json mapping.` };
    }

    const result = await moveItemToStatus(
      projectNumber,
      itemId,
      status as IssueStatus,
    );

    if (!result.ok) {
      return { ok: false, error: `Move failed: ${result.error}` };
    }

    const data = {
      project_number: projectNumber,
      item_id: itemId,
      issue_number: issueNumber,
      status,
      moved: true,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 14. cmdGitHubDetectExternalEdits ---------------------------------------

/**
 * Check if a phase issue body was modified outside MAXSIM.
 */
export async function cmdGitHubDetectExternalEdits(
  cwd: string,
  phaseNumber: string,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const root = detectProjectRoot(cwd);
    if (!root) {
      return { ok: false, error: 'No .planning/ directory found. Project not detected.' };
    }

    const mapping = loadMapping(root);
    if (!mapping) {
      return { ok: false, error: 'github-issues.json not found. Run project setup first.' };
    }

    const phaseMapping = mapping.phases[phaseNumber];
    if (!phaseMapping) {
      return { ok: false, error: `Phase ${phaseNumber} not found in mapping` };
    }

    const storedHash = phaseMapping.body_hash;
    const issueNumber = phaseMapping.tracking_issue.number;

    const issueResult = await getPhaseIssue(issueNumber);
    if (!issueResult.ok) {
      return { ok: false, error: `Failed to fetch issue #${issueNumber}: ${issueResult.error}` };
    }

    const liveHash = hashBody(issueResult.data.body);

    if (!storedHash) {
      const data = {
        modified: false,
        phase_number: phaseNumber,
        issue_number: issueNumber,
        note: 'No stored hash -- baseline not yet established',
      };
      return { ok: true, result: JSON.stringify(data, null, 2), rawValue: data };
    }

    const modified = liveHash !== storedHash;
    const data = {
      modified,
      phase_number: phaseNumber,
      issue_number: issueNumber,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 15. cmdGitHubQueryBoard ------------------------------------------------

/**
 * Query the GitHub project board. Returns items with their status and issue details.
 */
export async function cmdGitHubQueryBoard(
  projectNumber: number,
  status?: string | null,
  phase?: string | null,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await getProjectBoard(projectNumber);
    if (!result.ok) {
      return { ok: false, error: `Board query failed: ${result.error}` };
    }

    let items = result.data.items;

    if (status) {
      items = items.filter(item => item.status === status);
    }

    // Phase filtering would need issue title lookup -- skip for now
    // (same as MCP implementation)

    const data = {
      items: items.map(item => ({
        item_id: item.id,
        issue_number: item.issueNumber,
        status: item.status,
      })),
      count: items.length,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 16. cmdGitHubAddToBoard ------------------------------------------------

/**
 * Add a GitHub issue to the project board.
 */
export async function cmdGitHubAddToBoard(
  projectNumber: number,
  issueNumber: number,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await addItemToProject(projectNumber, issueNumber);
    if (!result.ok) {
      return { ok: false, error: `Add to board failed: ${result.error}` };
    }

    const data = {
      project_number: projectNumber,
      issue_number: issueNumber,
      item_id: result.data.itemId,
      added: true,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 17. cmdGitHubSearchIssues ----------------------------------------------

/**
 * Search GitHub issues by label, state, or text query.
 */
export async function cmdGitHubSearchIssues(
  labels?: string[] | null,
  state?: string | null,
  query?: string | null,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const octokit = getOctokit();
    const { owner, repo } = await getRepoInfo();

    const issueState = (state === 'closed' ? 'closed' : state === 'all' ? 'all' : 'open') as 'open' | 'closed' | 'all';

    const issues = await octokit.paginate(
      octokit.rest.issues.listForRepo,
      {
        owner,
        repo,
        state: issueState,
        labels: labels ? labels.join(',') : undefined,
        per_page: 100,
      },
    );

    let filtered = issues.map(issue => ({
      number: issue.number,
      title: issue.title,
      state: issue.state,
      labels: issue.labels
        .map(l => (typeof l === 'string' ? l : l.name ?? ''))
        .filter(Boolean),
    }));

    // Text query filter on title
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(issue =>
        issue.title.toLowerCase().includes(q),
      );
    }

    const data = { issues: filtered, count: filtered.length };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 18. cmdGitHubSyncCheck -------------------------------------------------

/**
 * Verify local github-issues.json mapping is in sync with live GitHub state.
 */
export async function cmdGitHubSyncCheck(
  cwd: string,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const root = detectProjectRoot(cwd);
    if (!root) {
      return { ok: false, error: 'No .planning/ directory found. Project not detected.' };
    }

    const mapping = loadMapping(root);
    if (!mapping) {
      return { ok: false, error: 'github-issues.json not found. Run project setup first.' };
    }

    const mismatches: Array<{
      phase_number: string;
      issue_number: number;
      local_state: string;
      remote_state: string;
    }> = [];
    const missing_remote: Array<{ phase_number: string; issue_number: number }> = [];

    for (const [phaseNum, phaseMapping] of Object.entries(mapping.phases)) {
      const issueNumber = phaseMapping.tracking_issue.number;
      if (!issueNumber) continue;

      const issueResult = await getPhaseIssue(issueNumber);
      if (!issueResult.ok) {
        if (issueResult.error.includes('NOT_FOUND') || issueResult.error.includes('404')) {
          missing_remote.push({ phase_number: phaseNum, issue_number: issueNumber });
        }
        continue;
      }

      const localStatus = phaseMapping.tracking_issue.status;
      const remoteState = issueResult.data.state;

      if (remoteState === 'closed' && localStatus !== 'Done') {
        mismatches.push({
          phase_number: phaseNum,
          issue_number: issueNumber,
          local_state: localStatus,
          remote_state: remoteState,
        });
      } else if (remoteState === 'open' && localStatus === 'Done') {
        mismatches.push({
          phase_number: phaseNum,
          issue_number: issueNumber,
          local_state: localStatus,
          remote_state: remoteState,
        });
      }
    }

    const in_sync = mismatches.length === 0 && missing_remote.length === 0;

    const data = {
      in_sync,
      mismatches,
      missing_local: [] as unknown[],
      missing_remote,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 19. cmdGitHubPhaseProgress ---------------------------------------------

/**
 * Get progress of a phase by counting open/closed sub-issues on GitHub.
 */
export async function cmdGitHubPhaseProgress(
  phaseIssueNumber: number,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await checkPhaseProgress(phaseIssueNumber);
    if (!result.ok) {
      return { ok: false, error: `Progress check failed: ${result.error}` };
    }

    const progress = result.data;
    const data = {
      phase_issue_number: phaseIssueNumber,
      total: progress.total,
      completed: progress.completed,
      in_progress: progress.inProgress,
      remaining: progress.remaining,
      tasks: progress.tasks,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 20. cmdGitHubAllProgress -----------------------------------------------

/**
 * Get progress overview for all phases from GitHub Issues.
 */
export async function cmdGitHubAllProgress(): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await getAllPhasesProgress();
    if (!result.ok) {
      return { ok: false, error: `All progress check failed: ${result.error}` };
    }

    const phases = result.data;
    const data = {
      phases: phases.map(p => ({
        phase_number: p.phaseNumber,
        title: p.title,
        issue_number: p.issueNumber,
        total: p.progress.total,
        completed: p.progress.completed,
        remaining: p.progress.remaining,
      })),
      count: phases.length,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 21. cmdGitHubDetectInterrupted -----------------------------------------

/**
 * Detect whether a phase was interrupted (mix of open/closed sub-issues).
 */
export async function cmdGitHubDetectInterrupted(
  phaseIssueNumber: number,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const result = await detectInterruptedPhase(phaseIssueNumber);
    if (!result.ok) {
      return { ok: false, error: `Interruption check failed: ${result.error}` };
    }

    const d = result.data;
    const data = {
      phase_issue_number: phaseIssueNumber,
      interrupted: d.interrupted,
      completed_tasks: d.completedTasks,
      remaining_tasks: d.remainingTasks,
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 22. cmdGitHubStatus ----------------------------------------------------

/**
 * Combined status: all-progress + detect-interrupted + board overview.
 */
export async function cmdGitHubStatus(
  cwd: string,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const data: Record<string, unknown> = {};

    // All phases progress
    const progressResult = await getAllPhasesProgress();
    if (progressResult.ok) {
      data.phases = progressResult.data.map(p => ({
        phase_number: p.phaseNumber,
        title: p.title,
        issue_number: p.issueNumber,
        total: p.progress.total,
        completed: p.progress.completed,
        remaining: p.progress.remaining,
      }));

      // Check for interrupted phases
      const interrupted: Array<Record<string, unknown>> = [];
      for (const p of progressResult.data) {
        if (p.progress.completed > 0 && p.progress.completed < p.progress.total) {
          interrupted.push({
            phase_number: p.phaseNumber,
            issue_number: p.issueNumber,
            completed: p.progress.completed,
            remaining: p.progress.remaining,
          });
        }
      }
      data.interrupted_phases = interrupted;
    } else {
      data.progress_error = progressResult.error;
    }

    // Board overview from mapping
    const root = detectProjectRoot(cwd);
    if (root) {
      const mapping = loadMapping(root);
      if (mapping && mapping.project_number) {
        const boardResult = await getProjectBoard(mapping.project_number);
        if (boardResult.ok) {
          const grouped: Record<string, number> = {
            'To Do': 0,
            'In Progress': 0,
            'In Review': 0,
            'Done': 0,
          };
          for (const item of boardResult.data.items) {
            grouped[item.status] = (grouped[item.status] || 0) + 1;
          }
          data.board = {
            project_number: mapping.project_number,
            columns: grouped,
            total_items: boardResult.data.items.length,
          };
        }
      }
    }

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---- 26. cmdGitHubSync ------------------------------------------------------

/**
 * Sync check + report issues. Convenience wrapper around sync-check.
 */
export async function cmdGitHubSync(
  cwd: string,
): Promise<CmdResult> {
  return cmdGitHubSyncCheck(cwd);
}

// ---- 27. cmdGitHubOverview --------------------------------------------------

/**
 * Board summary grouped by column.
 */
export async function cmdGitHubOverview(
  cwd: string,
): Promise<CmdResult> {
  const authErr = checkAuth();
  if (authErr) return authErr;

  try {
    const root = detectProjectRoot(cwd);
    if (!root) {
      return { ok: false, error: 'No .planning/ directory found. Project not detected.' };
    }

    const mapping = loadMapping(root);
    if (!mapping || !mapping.project_number) {
      return { ok: false, error: 'No project board configured. Run github setup first.' };
    }

    const boardResult = await getProjectBoard(mapping.project_number);
    if (!boardResult.ok) {
      return { ok: false, error: `Board query failed: ${boardResult.error}` };
    }

    // Group items by status
    const columns: Record<string, Array<{ item_id: string; issue_number: number }>> = {
      'To Do': [],
      'In Progress': [],
      'In Review': [],
      'Done': [],
    };

    for (const item of boardResult.data.items) {
      const col = columns[item.status];
      if (col) {
        col.push({ item_id: item.id, issue_number: item.issueNumber });
      }
    }

    const data = {
      project_number: mapping.project_number,
      columns,
      summary: {
        todo: columns['To Do'].length,
        in_progress: columns['In Progress'].length,
        in_review: columns['In Review'].length,
        done: columns['Done'].length,
        total: boardResult.data.items.length,
      },
    };

    return {
      ok: true,
      result: JSON.stringify(data, null, 2),
      rawValue: data,
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
