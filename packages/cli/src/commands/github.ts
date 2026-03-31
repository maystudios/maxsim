/**
 * GitHub command handlers for the CLI.
 * Namespace: `github <subcommand> [args]`
 *
 * Wraps functions from packages/cli/src/github/ and exposes them as
 * human-readable CLI commands suitable for LLM consumption.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { cmdOk, cmdErr } from '../core/types.js';
import { loadConfig, saveConfig } from '../core/config.js';
import {
  getIssue,
  listIssues,
  listSubIssues,
  listComments,
  addComment,
  createIssue,
  closeIssue,
  deleteComment,
  addSubIssue,
} from '../github/issues.js';
import {
  addItemToProject,
  moveItemToStatus,
  findProject,
} from '../github/projects.js';
import { ensureLabels } from '../github/labels.js';
import { parseCommentMeta, formatCommentHeader, buildIssueBody } from '../github/comments.js';
import { getRepoInfo } from '../github/client.js';
import { ensureMilestone } from '../github/milestones.js';
import { MAXSIM_LABELS } from '../github/types.js';
import {
  getFlag,
  hasFlag,
  getRequiredFlag,
  getIntFlag,
  type CommandRegistry,
} from './types.js';

// ── Helpers ────────────────────────────────────────────────────────────

/** Truncate a string to at most `max` characters, appending "..." if cut. */
function truncate(text: string, max = 200): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

/** Collect all values for a repeated flag (e.g., multiple --label flags). */
function getAllFlagValues(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === flag) {
      values.push(args[i + 1]);
    }
  }
  return values;
}

// ── GITHUB_COMMANDS ────────────────────────────────────────────────────

export const GITHUB_COMMANDS: CommandRegistry = {

  // ── Task 2.1: Read-only issue commands ──────────────────────────────

  'get-issue': {
    name: 'get-issue',
    description: 'Get a single issue by number. Usage: get-issue --issue-number 216 [--include-comments]',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const issueResult = await getIssue(issueNumber);
      if (!issueResult.ok) return cmdErr(issueResult.error);

      const issue = issueResult.data;
      const labelNames = issue.labels.map((l) => l.name).join(', ') || '(none)';
      const lines: string[] = [
        `Issue #${issue.number}: ${issue.title}`,
        `State: ${issue.state}${issue.stateReason ? ` (${issue.stateReason})` : ''}`,
        `Labels: ${labelNames}`,
        `URL: ${issue.htmlUrl}`,
        '',
        truncate(issue.body),
      ];

      if (hasFlag(args, '--include-comments')) {
        const commentsResult = await listComments(issueNumber);
        if (!commentsResult.ok) return cmdErr(commentsResult.error);

        const comments = commentsResult.data;
        lines.push('', `Comments (${comments.length}):`);
        for (const comment of comments) {
          const meta = parseCommentMeta(comment.body);
          const typeLabel = meta ? `[type:${meta.type}]` : '[no-type]';
          lines.push(`  ${typeLabel} ${truncate(comment.body, 120)}`);
        }
      }

      return cmdOk(lines.join('\n'));
    },
  },

  'list-issues': {
    name: 'list-issues',
    description: 'List issues with optional filtering. Usage: list-issues [--label type:phase] [--state open]',
    async handler(args) {
      const label = getFlag(args, '--label');
      const state = (getFlag(args, '--state') as 'open' | 'closed' | 'all') ?? 'open';

      const result = await listIssues({ labels: label, state });
      if (!result.ok) return cmdErr(result.error);

      const issues = result.data;
      if (issues.length === 0) {
        return cmdOk(`No issues found (state: ${state}${label ? `, label: ${label}` : ''})`);
      }

      const header = `${'#'.padEnd(6)} ${'Title'.padEnd(60)} ${'State'.padEnd(8)} Labels`;
      const separator = '-'.repeat(header.length);
      const rows = issues.map((issue) => {
        const num = `#${issue.number}`.padEnd(6);
        const title = issue.title.slice(0, 58).padEnd(60);
        const issueState = issue.state.padEnd(8);
        const labels = issue.labels.map((l) => l.name).join(', ');
        return `${num} ${title} ${issueState} ${labels}`;
      });

      const output = [header, separator, ...rows].join('\n');
      return cmdOk(output);
    },
  },

  'list-sub-issues': {
    name: 'list-sub-issues',
    description: 'List sub-issues of a parent issue. Usage: list-sub-issues --phase-issue-number 216',
    async handler(args) {
      let parentNumber: number;
      try {
        const raw = getRequiredFlag(args, '--phase-issue-number');
        parentNumber = parseInt(raw, 10);
        if (Number.isNaN(parentNumber)) return cmdErr('--phase-issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const result = await listSubIssues(parentNumber);
      if (!result.ok) return cmdErr(result.error);

      const subIssues = result.data;
      if (subIssues.length === 0) {
        return cmdOk(`No sub-issues found for #${parentNumber}`);
      }

      const header = `${'#'.padEnd(6)} ${'Title'.padEnd(70)} State`;
      const separator = '-'.repeat(header.length);
      const rows = subIssues.map((issue) => {
        const num = `#${issue.number}`.padEnd(6);
        const title = issue.title.slice(0, 68).padEnd(70);
        return `${num} ${title} ${issue.state}`;
      });

      const output = [header, separator, ...rows].join('\n');
      return cmdOk(output);
    },
  },

  // ── Task 2.2: Mutating issue commands ───────────────────────────────

  'post-comment': {
    name: 'post-comment',
    description: 'Post a comment on an issue. Usage: post-comment --issue-number 216 --body "text" [--body-file /path] [--type plan]',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const bodyFile = getFlag(args, '--body-file');
      let body = getFlag(args, '--body') ?? '';

      if (bodyFile) {
        try {
          body = fs.readFileSync(path.resolve(bodyFile), 'utf8');
        } catch (e) {
          return cmdErr(`Cannot read body file: ${(e as Error).message}`);
        }
      }

      if (!body) {
        return cmdErr('--body or --body-file is required');
      }

      const commentType = getFlag(args, '--type');
      if (commentType) {
        const header = formatCommentHeader({ type: commentType as Parameters<typeof formatCommentHeader>[0]['type'] });
        body = `${header}\n${body}`;
      }

      const result = await addComment(issueNumber, body);
      if (!result.ok) return cmdErr(result.error);

      return cmdOk(`Comment posted on #${issueNumber}`);
    },
  },

  'close-issue': {
    name: 'close-issue',
    description: 'Close an issue. Usage: close-issue --issue-number 216 [--reason completed]',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const reason = (getFlag(args, '--reason') as 'completed' | 'not_planned') ?? 'completed';

      const result = await closeIssue(issueNumber, reason);
      if (!result.ok) return cmdErr(result.error);

      return cmdOk(`Issue #${issueNumber} closed`);
    },
  },

  'create-issue': {
    name: 'create-issue',
    description: 'Create a new issue. Usage: create-issue --title "title" [--body "text"] [--body-file /path] [--label type:task] [--milestone 1]',
    async handler(args) {
      let title: string;
      try {
        title = getRequiredFlag(args, '--title');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const bodyFile = getFlag(args, '--body-file');
      let body = getFlag(args, '--body') ?? '';

      if (bodyFile) {
        try {
          body = fs.readFileSync(path.resolve(bodyFile), 'utf8');
        } catch (e) {
          return cmdErr(`Cannot read body file: ${(e as Error).message}`);
        }
      }

      // Collect all --label values
      const labels = getAllFlagValues(args, '--label');

      const milestoneRaw = getIntFlag(args, '--milestone');
      const milestone = milestoneRaw !== undefined && !Number.isNaN(milestoneRaw) ? milestoneRaw : undefined;

      const result = await createIssue({ title, body, labels, milestone });
      if (!result.ok) return cmdErr(result.error);

      const issue = result.data;
      return cmdOk(`Created issue #${issue.number}: ${issue.title}`, issue.number);
    },
  },

  // ── Task 2.3: Label and comment management ───────────────────────────

  'ensure-labels': {
    name: 'ensure-labels',
    description: 'Ensure all MaxsimCLI labels exist on the repository. Usage: ensure-labels',
    async handler(_args) {
      const result = await ensureLabels();
      if (!result.ok) return cmdErr(result.error);

      const { created, existing } = result.data;
      return cmdOk(`Labels: ${created.length} created, ${existing.length} existing`);
    },
  },

  'delete-comments': {
    name: 'delete-comments',
    description: 'Delete comments of a given type from an issue. Usage: delete-comments --issue-number 216 --type plan',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      let type: string;
      try {
        type = getRequiredFlag(args, '--type');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const commentsResult = await listComments(issueNumber);
      if (!commentsResult.ok) return cmdErr(commentsResult.error);

      const matching = commentsResult.data.filter(
        (c) => parseCommentMeta(c.body)?.type === type,
      );

      for (const comment of matching) {
        const deleteResult = await deleteComment(comment.id);
        if (!deleteResult.ok) return cmdErr(deleteResult.error);
      }

      return cmdOk(`Deleted ${matching.length} ${type} comments from #${issueNumber}`);
    },
  },

  // ── Task 2.4: Project board commands ────────────────────────────────

  'move-issue': {
    name: 'move-issue',
    description: 'Move an issue to a project board status column. Usage: move-issue --issue-number 216 --status "In Progress"',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      let status: string;
      try {
        status = getRequiredFlag(args, '--status');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const projectDir = process.cwd();
      const config = loadConfig(projectDir);

      // Resolve project number
      let projectNumber: number | undefined;
      const configAny = config as unknown as Record<string, unknown>;
      const ghConfig = configAny.github as Record<string, unknown> | undefined;
      if (ghConfig?.project_number && typeof ghConfig.project_number === 'number') {
        projectNumber = ghConfig.project_number;
      } else if (config.github.projectName) {
        const findResult = findProject(config.github.projectName);
        if (!findResult.ok) return cmdErr(findResult.error);
        if (!findResult.data) {
          return cmdErr(`Project "${config.github.projectName}" not found. Use: github set-project --project-number <N>`);
        }
        projectNumber = findResult.data.number;
      }

      if (!projectNumber) {
        return cmdErr('Project number not configured. Use: github set-project --project-number <N>');
      }

      const repoInfo = getRepoInfo();
      const issueUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/${issueNumber}`;

      const addResult = addItemToProject(projectNumber, issueUrl);
      if (!addResult.ok) return cmdErr(addResult.error);

      const moveResult = moveItemToStatus(projectNumber, addResult.data.itemId, status);
      if (!moveResult.ok) return cmdErr(moveResult.error);

      return cmdOk(`Moved #${issueNumber} to ${status}`);
    },
  },

  'set-project': {
    name: 'set-project',
    description: 'Set the GitHub project number in config. Usage: set-project --project-number 4',
    async handler(args) {
      let projectNumber: number;
      try {
        const raw = getRequiredFlag(args, '--project-number');
        projectNumber = parseInt(raw, 10);
        if (Number.isNaN(projectNumber)) return cmdErr('--project-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const projectDir = process.cwd();
      const config = loadConfig(projectDir);
      const configAny = config as unknown as Record<string, unknown>;
      const ghConfig = (configAny.github as Record<string, unknown>) ?? {};
      ghConfig.project_number = projectNumber;
      configAny.github = ghConfig;
      saveConfig(projectDir, config);

      return cmdOk(`Project number set to ${projectNumber}`);
    },
  },

  'set-status': {
    name: 'set-status',
    description: 'Set an issue status on the project board (alias for move-issue). Usage: set-status --issue-number 216 --status "Done"',
    async handler(args) {
      // Delegate to move-issue handler
      return GITHUB_COMMANDS['move-issue'].handler(args);
    },
  },

  // ── Task 3.1: GitHub status diagnostic ──────────────────────────────

  'status': {
    name: 'status',
    description: 'Check GitHub connectivity and show project state. Usage: status',
    async handler(_args) {
      const lines: string[] = [];

      // Step 1: Repo info
      let repoInfo: { owner: string; repo: string } | null = null;
      try {
        repoInfo = getRepoInfo();
        lines.push(`Repository: ${repoInfo.owner}/${repoInfo.repo}`);
        lines.push('Auth: OK (via gh CLI)');
      } catch (e) {
        lines.push(`Repository: ERROR — ${(e as Error).message}`);
        lines.push('Auth: UNKNOWN');
      }

      // Step 2: Load config for project settings
      const config = loadConfig(process.cwd());
      const projectName = config.github.projectName || '(not configured)';

      // Step 3: Find project (best-effort)
      let projectDisplay = `${projectName} (not found)`;
      try {
        const findResult = findProject(config.github.projectName);
        if (findResult.ok && findResult.data) {
          projectDisplay = `${projectName} (#${findResult.data.number})`;
        } else if (!config.github.projectName) {
          projectDisplay = '(not configured)';
        }
      } catch {
        // Network issue — report gracefully
        projectDisplay = `${projectName} (check failed)`;
      }
      lines.push(`Project: ${projectDisplay}`);

      // Step 4: Check labels (best-effort)
      let labelDisplay = `${MAXSIM_LABELS.length} configured`;
      try {
        const labelResult = await ensureLabels();
        if (labelResult.ok) {
          const { created, existing } = labelResult.data;
          labelDisplay = `${MAXSIM_LABELS.length} configured (${existing.length} exist, ${created.length} created)`;
        }
      } catch {
        labelDisplay = `${MAXSIM_LABELS.length} configured (check failed)`;
      }
      lines.push(`Labels: ${labelDisplay}`);

      return cmdOk(lines.join('\n'));
    },
  },

  // ── Task 3.2: Create phase issue ──────────────────────────────────────

  'create-phase': {
    name: 'create-phase',
    description: 'Create a phase issue. Usage: create-phase --phase-number 1 --title "Title" [--body "..."] [--body-file /path] [--milestone 1]',
    async handler(args) {
      let phaseNumber: number;
      try {
        const raw = getRequiredFlag(args, '--phase-number');
        phaseNumber = parseInt(raw, 10);
        if (Number.isNaN(phaseNumber)) return cmdErr('--phase-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      let title: string;
      try {
        title = getRequiredFlag(args, '--title');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const bodyFile = getFlag(args, '--body-file');
      let content = getFlag(args, '--body') ?? '';
      if (bodyFile) {
        try {
          content = fs.readFileSync(path.resolve(bodyFile), 'utf8');
        } catch (e) {
          return cmdErr(`Cannot read body file: ${(e as Error).message}`);
        }
      }

      const milestoneRaw = getIntFlag(args, '--milestone');
      const milestone = milestoneRaw !== undefined && !Number.isNaN(milestoneRaw) ? milestoneRaw : undefined;

      // Build issue body with metadata
      const now = new Date().toISOString();
      const meta = {
        type: 'phase' as const,
        phase: phaseNumber,
        task: null,
        parentIssue: null,
        status: 'planned',
        estimate: null,
        wave: null,
        createdAt: now,
        createdBy: 'maxsim',
      };
      const state = {
        taskIds: [],
        plannedAt: now,
        executedAt: null,
        verifiedAt: null,
        executorBranches: [],
        worktreeBranch: null,
        verificationPassed: null,
        retryCount: 0,
      };
      const body = buildIssueBody(meta, content, state);
      const issueTitle = `Phase ${phaseNumber}: ${title}`;

      const result = await createIssue({ title: issueTitle, body, labels: ['type:phase', 'maxsim:auto'], milestone });
      if (!result.ok) return cmdErr(result.error);

      const issue = result.data;

      // Add to project board if configured
      const config = loadConfig(process.cwd());
      const configAny = config as unknown as Record<string, unknown>;
      const ghConfig = configAny.github as Record<string, unknown> | undefined;
      const projectNumber = typeof ghConfig?.project_number === 'number' ? ghConfig.project_number : undefined;
      if (projectNumber) {
        const repoInfo = getRepoInfo();
        const issueUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/${issue.number}`;
        const addResult = addItemToProject(projectNumber, issueUrl);
        if (!addResult.ok) {
          // Non-fatal: report but don't fail
          return cmdOk(`Created Phase #${issue.number}: ${issueTitle}\nWarning: could not add to project board — ${addResult.error}`);
        }
      }

      return cmdOk(`Created Phase #${issue.number}: ${issueTitle}`);
    },
  },

  // ── Task 3.3: Create milestone ────────────────────────────────────────

  'create-milestone': {
    name: 'create-milestone',
    description: 'Find or create a milestone. Usage: create-milestone --title "Milestone 1" [--description "..."] [--due-date 2026-04-15]',
    async handler(args) {
      let title: string;
      try {
        title = getRequiredFlag(args, '--title');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const description = getFlag(args, '--description');
      const dueDate = getFlag(args, '--due-date');

      const result = await ensureMilestone({ title, description, dueOn: dueDate });
      if (!result.ok) return cmdErr(result.error);

      const milestone = result.data;
      return cmdOk(`Milestone #${milestone.number}: ${milestone.title}`);
    },
  },

  // ── Task 3.4: Post plan comment ───────────────────────────────────────

  'post-plan-comment': {
    name: 'post-plan-comment',
    description: 'Post a structured plan comment. Usage: post-plan-comment --issue-number 216 --plan-number 1 --body "..." [--body-file /path]',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      let planNumber: number;
      try {
        const raw = getRequiredFlag(args, '--plan-number');
        planNumber = parseInt(raw, 10);
        if (Number.isNaN(planNumber)) return cmdErr('--plan-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const bodyFile = getFlag(args, '--body-file');
      let content = getFlag(args, '--body') ?? '';
      if (bodyFile) {
        try {
          content = fs.readFileSync(path.resolve(bodyFile), 'utf8');
        } catch (e) {
          return cmdErr(`Cannot read body file: ${(e as Error).message}`);
        }
      }

      if (!content) {
        return cmdErr('--body or --body-file is required');
      }

      // Prepend the maxsim type marker
      const header = `<!-- maxsim:type=plan plan=${planNumber} -->`;
      const body = `${header}\n${content}`;

      const result = await addComment(issueNumber, body);
      if (!result.ok) return cmdErr(result.error);

      return cmdOk(`Plan ${planNumber} posted on #${issueNumber}`);
    },
  },

  // ── Task 3.5: Batch create tasks ──────────────────────────────────────

  'batch-create-tasks': {
    name: 'batch-create-tasks',
    description: 'Batch create task sub-issues from a JSON file. Usage: batch-create-tasks --phase-issue-number 216 --tasks-file /path/to/tasks.json',
    async handler(args) {
      let phaseIssueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--phase-issue-number');
        phaseIssueNumber = parseInt(raw, 10);
        if (Number.isNaN(phaseIssueNumber)) return cmdErr('--phase-issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      let tasksFile: string;
      try {
        tasksFile = getRequiredFlag(args, '--tasks-file');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      // Read and parse tasks file
      let tasks: Array<{ title: string; body: string; labels?: string[] }>;
      try {
        const raw = fs.readFileSync(path.resolve(tasksFile), 'utf8');
        tasks = JSON.parse(raw);
        if (!Array.isArray(tasks)) return cmdErr('--tasks-file must contain a JSON array');
      } catch (e) {
        return cmdErr(`Cannot read tasks file: ${(e as Error).message}`);
      }

      // Resolve project number for board additions (best-effort)
      const config = loadConfig(process.cwd());
      const configAny = config as unknown as Record<string, unknown>;
      const ghConfig = configAny.github as Record<string, unknown> | undefined;
      const projectNumber = typeof ghConfig?.project_number === 'number' ? ghConfig.project_number : undefined;
      const repoInfo = getRepoInfo();

      let created = 0;
      const errors: string[] = [];

      for (const task of tasks) {
        if (!task.title) {
          errors.push('Skipped task with missing title');
          continue;
        }

        const issueResult = await createIssue({
          title: task.title,
          body: task.body ?? '',
          labels: task.labels ?? [],
        });

        if (!issueResult.ok) {
          errors.push(`Failed to create "${task.title}": ${issueResult.error}`);
          continue;
        }

        const issue = issueResult.data;

        // Link as sub-issue
        const subResult = await addSubIssue(phaseIssueNumber, issue.number);
        if (!subResult.ok) {
          errors.push(`Created #${issue.number} but failed to link as sub-issue: ${subResult.error}`);
        }

        // Add to project board if configured
        if (projectNumber) {
          const issueUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/${issue.number}`;
          addItemToProject(projectNumber, issueUrl); // best-effort, ignore errors
        }

        created++;
      }

      const summary = [`Created ${created} tasks as sub-issues of #${phaseIssueNumber}`];
      if (errors.length > 0) {
        summary.push(`Errors (${errors.length}):`);
        for (const err of errors) summary.push(`  - ${err}`);
      }

      return cmdOk(summary.join('\n'));
    },
  },

  // ── Task 3.6: All-progress and detect-external-edits ─────────────────

  'all-progress': {
    name: 'all-progress',
    description: 'Show progress for all phase issues. Usage: all-progress',
    async handler(_args) {
      const result = await listIssues({ labels: 'type:phase', state: 'all' });
      if (!result.ok) return cmdErr(result.error);

      const phases = result.data;
      if (phases.length === 0) {
        return cmdOk('No phase issues found (label: type:phase)');
      }

      const header = `${'Phase'.padEnd(8)} ${'Title'.padEnd(40)} ${'Tasks'.padEnd(10)} Status`;
      const separator = '-'.repeat(header.length);

      const rows: string[] = [];
      for (const phase of phases) {
        const subResult = await listSubIssues(phase.number);
        let taskDisplay = '?/?';
        if (subResult.ok) {
          const total = subResult.data.length;
          const closed = subResult.data.filter((i) => i.state === 'closed').length;
          taskDisplay = `${closed}/${total}`;
        }
        const phaseCol = `#${phase.number}`.padEnd(8);
        const titleCol = phase.title.slice(0, 38).padEnd(40);
        const taskCol = taskDisplay.padEnd(10);
        rows.push(`${phaseCol} ${titleCol} ${taskCol} ${phase.state}`);
      }

      return cmdOk([header, separator, ...rows].join('\n'));
    },
  },

  'detect-external-edits': {
    name: 'detect-external-edits',
    description: 'Detect external edits to comments on a phase issue. Usage: detect-external-edits --phase-number 1',
    async handler(args) {
      let phaseNumber: number;
      try {
        const raw = getRequiredFlag(args, '--phase-number');
        phaseNumber = parseInt(raw, 10);
        if (Number.isNaN(phaseNumber)) return cmdErr('--phase-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      // Find the phase issue
      const listResult = await listIssues({ labels: 'type:phase', state: 'all' });
      if (!listResult.ok) return cmdErr(listResult.error);

      const phaseIssue = listResult.data.find(
        (i) => i.title.startsWith(`Phase ${phaseNumber}:`),
      );
      if (!phaseIssue) {
        return cmdErr(`Phase issue not found for phase ${phaseNumber}`);
      }

      // List comments on the phase issue
      const commentsResult = await listComments(phaseIssue.number);
      if (!commentsResult.ok) return cmdErr(commentsResult.error);

      const comments = commentsResult.data;
      if (comments.length === 0) {
        return cmdOk('No external edits detected (no comments found)');
      }

      // Check for externally edited maxsim comments
      const edited: Array<{ id: number; type: string; createdAt: string; updatedAt: string }> = [];
      for (const comment of comments) {
        const meta = parseCommentMeta(comment.body);
        if (!meta) continue; // Only check maxsim-typed comments
        if (comment.updatedAt > comment.createdAt) {
          edited.push({
            id: comment.id,
            type: meta.type,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
          });
        }
      }

      if (edited.length === 0) {
        return cmdOk('No external edits detected');
      }

      const lines = [`Warning: ${edited.length} comment(s) modified externally on #${phaseIssue.number}:`];
      for (const e of edited) {
        lines.push(`  Comment #${e.id} [type:${e.type}] — created: ${e.createdAt}, updated: ${e.updatedAt}`);
      }
      return cmdOk(lines.join('\n'));
    },
  },
};
