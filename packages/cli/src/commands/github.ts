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
} from '../github/issues.js';
import {
  addItemToProject,
  moveItemToStatus,
  findProject,
} from '../github/projects.js';
import { ensureLabels } from '../github/labels.js';
import { parseCommentMeta, formatCommentHeader } from '../github/comments.js';
import { getRepoInfo } from '../github/client.js';
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
};
