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
  updateIssue,
  deleteComment,
  addSubIssue,
} from '../github/issues.js';
import {
  addItemToProject,
  moveItemToStatus,
  findProject,
} from '../github/projects.js';
import { ensureLabels, addLabelToIssue, removeLabelFromIssue } from '../github/labels.js';
import { parseCommentMeta, formatCommentHeader, buildIssueBody } from '../github/comments.js';
import { getRepoInfo, ghJson } from '../github/client.js';
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

// ── Status helpers ────────────────────────────────────────────────────

/** Extract phase number from an issue title like "Phase 2: ..." */
function extractPhaseNumber(title: string): number {
  const match = title.match(/Phase\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 999;
}

/**
 * Parse acceptance criteria checkboxes from an issue body.
 * Looks for lines matching `- [ ] ...` (unchecked) or `- [x] ...` (checked).
 */
function parseAcceptanceCriteria(body: string): Array<{ checked: boolean; text: string }> {
  const criteria: Array<{ checked: boolean; text: string }> = [];
  const lines = body.split('\n');
  let inAcceptanceSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect acceptance criteria section header
    if (/^#+\s*acceptance\s+criteria/i.test(trimmed)) {
      inAcceptanceSection = true;
      continue;
    }

    // Stop when hitting the next header section
    if (inAcceptanceSection && /^#+\s/.test(trimmed) && !/^#+\s*acceptance/i.test(trimmed)) {
      inAcceptanceSection = false;
      continue;
    }

    // Parse checkbox lines within the acceptance criteria section
    if (inAcceptanceSection) {
      const checkboxMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.+)$/);
      if (checkboxMatch) {
        const checked = checkboxMatch[1].toLowerCase() === 'x';
        const text = checkboxMatch[2].trim();
        criteria.push({ checked, text });
      }
    }
  }

  return criteria;
}

/** Single-phase detail mode: phase header, task list, acceptance criteria, drift warning. */
async function statusSinglePhase(phaseNumber: number) {
  // Find the phase issue by label and title pattern
  const listResult = await listIssues({ labels: 'type:phase', state: 'all' });
  if (!listResult.ok) return cmdErr(listResult.error);

  const phaseIssue = listResult.data.find(
    (i) => extractPhaseNumber(i.title) === phaseNumber,
  );
  if (!phaseIssue) {
    return cmdErr(`Phase issue not found for phase ${phaseNumber}`);
  }

  // Fetch full issue data for body content
  const issueResult = await getIssue(phaseIssue.number);
  if (!issueResult.ok) return cmdErr(issueResult.error);
  const issue = issueResult.data;

  // Fetch sub-issues (tasks)
  const subResult = await listSubIssues(phaseIssue.number);
  if (!subResult.ok) return cmdErr(subResult.error);
  const tasks = subResult.data;

  const lines: string[] = [];

  // ── Phase header ────────────────────────────────────────────────────
  const stateDisplay = issue.state === 'closed' ? 'CLOSED' : 'OPEN';
  lines.push(`# Phase ${phaseNumber}: ${issue.title.replace(/^Phase\s+\d+:\s*/i, '').trim()}`);
  lines.push(`State: ${stateDisplay}  |  Issue: #${issue.number}`);
  lines.push('');

  // ── Task list ───────────────────────────────────────────────────────
  const closedCount = tasks.filter((t) => t.state === 'closed').length;
  lines.push(`## Tasks (${closedCount}/${tasks.length})`);

  if (tasks.length === 0) {
    lines.push('  (no tasks)');
  } else {
    // Sort: closed first, then open, by issue number within each group
    const sorted = [...tasks].sort((a, b) => {
      if (a.state === 'closed' && b.state !== 'closed') return -1;
      if (a.state !== 'closed' && b.state === 'closed') return 1;
      return a.number - b.number;
    });

    for (const task of sorted) {
      const marker = task.state === 'closed' ? '\u2713' : '\u25CB';
      const taskTitle = task.title.replace(/^Task\s+[\d.]+:\s*/i, '').trim();
      lines.push(`  ${marker} #${task.number}: ${taskTitle}`);
    }
  }
  lines.push('');

  // ── Acceptance criteria ─────────────────────────────────────────────
  const criteria = parseAcceptanceCriteria(issue.body);
  if (criteria.length > 0) {
    const checkedCount = criteria.filter((c) => c.checked).length;
    lines.push(`## Acceptance Criteria (${checkedCount}/${criteria.length})`);
    for (const c of criteria) {
      const marker = c.checked ? '[x]' : '[ ]';
      lines.push(`  ${marker} ${c.text}`);
    }
    lines.push('');

    // ── Drift warning ───────────────────────────────────────────────
    const allTasksClosed = tasks.length > 0 && closedCount === tasks.length;
    const allCriteriaChecked = checkedCount === criteria.length;
    if (allTasksClosed && !allCriteriaChecked) {
      const unchecked = criteria.length - checkedCount;
      lines.push(`WARNING: All ${tasks.length} tasks are closed but ${unchecked} acceptance criteria remain unchecked — potential drift`);
      lines.push('');
    }
  }

  return cmdOk(lines.join('\n'));
}

/** All-phases summary mode: connectivity checks + compact phase list. */
async function statusAllPhases() {
  const lines: string[] = [];

  // Step 1: Repo info
  try {
    const repoInfo = getRepoInfo();
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
  lines.push('');

  // Step 5: Compact phase list with open/closed counts
  const phaseResult = await listIssues({ labels: 'type:phase', state: 'all' });
  if (!phaseResult.ok) {
    lines.push('Phases: could not fetch phase issues');
    return cmdOk(lines.join('\n'));
  }

  const phases = phaseResult.data;
  if (phases.length === 0) {
    lines.push('Phases: none found');
    return cmdOk(lines.join('\n'));
  }

  // Sort by phase number
  phases.sort((a, b) => extractPhaseNumber(a.title) - extractPhaseNumber(b.title));

  // Fetch sub-issues in parallel
  const subResults = await Promise.all(phases.map((p) => listSubIssues(p.number)));

  lines.push('## Phases');
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const phaseNum = extractPhaseNumber(phase.title);
    const shortTitle = phase.title.replace(/^Phase\s+\d+:\s*/i, '').trim();
    const stateTag = phase.state === 'closed' ? 'DONE' : 'OPEN';

    let taskInfo = '';
    const sub = subResults[i];
    if (sub.ok) {
      const closed = sub.data.filter((t) => t.state === 'closed').length;
      taskInfo = ` (${closed}/${sub.data.length} tasks)`;
    }

    lines.push(`  Phase ${phaseNum}: ${shortTitle} [${stateTag}]${taskInfo}`);
  }

  return cmdOk(lines.join('\n'));
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

  'reopen-issue': {
    name: 'reopen-issue',
    description: 'Reopen a closed issue. Usage: reopen-issue --issue-number 216',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const result = await updateIssue(issueNumber, { state: 'open' });
      if (!result.ok) return cmdErr(result.error);

      return cmdOk(`Issue #${issueNumber} reopened`);
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

  'add-label': {
    name: 'add-label',
    description: 'Add a label to an issue. Usage: add-label --issue-number 216 --label "label-name"',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      let labelName: string;
      try {
        labelName = getRequiredFlag(args, '--label');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const result = await addLabelToIssue(issueNumber, labelName);
      if (!result.ok) return cmdErr(result.error);

      return cmdOk(`Label "${labelName}" added to issue #${issueNumber}.`);
    },
  },

  'remove-label': {
    name: 'remove-label',
    description: 'Remove a label from an issue. Usage: remove-label --issue-number 216 --label "label-name"',
    async handler(args) {
      let issueNumber: number;
      try {
        const raw = getRequiredFlag(args, '--issue-number');
        issueNumber = parseInt(raw, 10);
        if (Number.isNaN(issueNumber)) return cmdErr('--issue-number must be an integer');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      let labelName: string;
      try {
        labelName = getRequiredFlag(args, '--label');
      } catch (e) {
        return cmdErr((e as Error).message);
      }

      const result = await removeLabelFromIssue(issueNumber, labelName);
      if (!result.ok) return cmdErr(result.error);

      return cmdOk(`Label "${labelName}" removed from issue #${issueNumber}.`);
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
      if (config.github.project_number) {
        projectNumber = config.github.project_number;
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
      config.github.project_number = projectNumber;
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
    description: 'Show project status. Usage: status [--phase-number N]  Without --phase-number: connectivity + all-phases summary. With --phase-number: detailed single-phase view.',
    async handler(args) {
      const phaseNumberRaw = getIntFlag(args, '--phase-number');

      // ── Single-phase detail mode ────────────────────────────────────
      if (phaseNumberRaw !== undefined) {
        if (Number.isNaN(phaseNumberRaw)) return cmdErr('--phase-number must be an integer');
        return statusSinglePhase(phaseNumberRaw);
      }

      // ── All-phases summary mode ─────────────────────────────────────
      return statusAllPhases();
    },
  },

  // ── Task 3.2: Create phase issue ──────────────────────────────────────

  'create-phase': {
    name: 'create-phase',
    description: 'Create a phase issue with labels, milestone, and board placement. Usage: create-phase --phase-number 1 --title "Title" [--body "..."] [--body-file /path] [--milestone-number 11] [--project-number 4]',
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

      // Load config for defaults
      const config = loadConfig(process.cwd());

      // Resolve milestone: flag > config
      const milestoneFlag = getIntFlag(args, '--milestone-number') ?? getIntFlag(args, '--milestone');
      const milestone = milestoneFlag !== undefined && !Number.isNaN(milestoneFlag)
        ? milestoneFlag
        : config.github.milestone_number ?? undefined;

      // Resolve project number: flag > config
      const projectFlag = getIntFlag(args, '--project-number');
      const projectNumber = projectFlag !== undefined && !Number.isNaN(projectFlag)
        ? projectFlag
        : config.github.project_number;

      // Ensure labels exist before creating the issue
      await ensureLabels();

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
      const warnings: string[] = [];

      // Add to project board and move to "To Do" if configured
      if (projectNumber) {
        const repoInfo = getRepoInfo();
        const issueUrl = `https://github.com/${repoInfo.owner}/${repoInfo.repo}/issues/${issue.number}`;
        const addResult = addItemToProject(projectNumber, issueUrl);
        if (!addResult.ok) {
          warnings.push(`could not add to project board — ${addResult.error}`);
        } else {
          const moveResult = moveItemToStatus(projectNumber, addResult.data.itemId, 'To Do');
          if (!moveResult.ok) {
            warnings.push(`added to board but could not move to "To Do" — ${moveResult.error}`);
          }
        }
      }

      const output = [`Created Phase #${issue.number}: ${issueTitle}`];
      if (milestone) {
        output.push(`Milestone: ${milestone}`);
      }
      if (projectNumber) {
        output.push(`Project board: #${projectNumber}`);
      }
      if (warnings.length > 0) {
        for (const w of warnings) output.push(`Warning: ${w}`);
      }

      return cmdOk(output.join('\n'));
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
      const projectNumber = config.github.project_number;
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
    description: 'Show adaptive progress for all phase issues with detail levels and progress bar. Usage: all-progress',
    async handler(_args) {
      // Fetch all phase issues (label is 'maxsim:phase' per actual GitHub data)
      const result = await listIssues({ labels: 'maxsim:phase', state: 'all' });
      if (!result.ok) return cmdErr(result.error);

      const phases = result.data;
      if (phases.length === 0) {
        return cmdOk('No phase issues found (label: maxsim:phase)');
      }

      // Extract phase number from title (e.g., "Phase 2: ..." → 2) for sorting
      function extractPhaseNumber(title: string): number {
        const match = title.match(/Phase\s+(\d+)/i);
        return match ? parseInt(match[1], 10) : 999;
      }

      // Sort phases by extracted phase number
      phases.sort((a, b) => extractPhaseNumber(a.title) - extractPhaseNumber(b.title));

      // Fetch sub-issues for all phases in parallel
      const subIssueResults = await Promise.all(
        phases.map((phase) => listSubIssues(phase.number)),
      );

      // Classify phases and accumulate totals
      let totalTasks = 0;
      let totalClosed = 0;
      const lines: string[] = [];

      lines.push('# Milestone Progress');
      lines.push('');

      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        const subResult = subIssueResults[i];
        const phaseNum = extractPhaseNumber(phase.title);
        const phaseLabel = `Phase ${phaseNum}`;

        // Strip "Phase N: " prefix from title for cleaner display
        const shortTitle = phase.title.replace(/^Phase\s+\d+:\s*/i, '').trim();

        if (!subResult.ok) {
          // Could not fetch sub-issues — show warning
          lines.push(`${phaseLabel}: ${shortTitle} — [could not fetch tasks]`);
          lines.push('');
          continue;
        }

        const tasks = subResult.data;
        const closed = tasks.filter((t) => t.state === 'closed').length;
        const total = tasks.length;
        totalTasks += total;
        totalClosed += closed;

        // Determine phase status category
        const allClosed = phase.state === 'closed' || (total > 0 && closed === total);
        const hasProgress = closed > 0 && closed < total;
        const isInProgress = phase.state === 'open' && (hasProgress || total === 0);

        if (allClosed) {
          // DONE — compact one-liner
          lines.push(`${phaseLabel}: ${shortTitle} — Complete (${total} tasks)`);
        } else if (isInProgress && total > 0) {
          // IN-PROGRESS — expanded with task list
          lines.push(`${phaseLabel}: ${shortTitle} — In Progress (${closed}/${total})`);

          // Sort tasks: closed first, then open
          const sortedTasks = [...tasks].sort((a, b) => {
            if (a.state === 'closed' && b.state !== 'closed') return -1;
            if (a.state !== 'closed' && b.state === 'closed') return 1;
            return a.number - b.number;
          });

          for (const task of sortedTasks) {
            const marker = task.state === 'closed' ? '[x]' : '[ ]';
            const taskTitle = task.title.replace(/^Task\s+[\d.]+:\s*/i, '').trim();
            lines.push(`  ${marker} #${task.number}: ${taskTitle}`);
          }
        } else {
          // NOT STARTED — compact one-liner
          const taskNote = total > 0 ? `${total} tasks` : 'no tasks';
          lines.push(`${phaseLabel}: ${shortTitle} — Not started (${taskNote})`);
        }

        lines.push('');
      }

      // Overall progress bar
      const barWidth = 20;
      const pct = totalTasks > 0 ? totalClosed / totalTasks : 0;
      const filled = Math.round(pct * barWidth);
      const empty = barWidth - filled;
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(empty);
      const pctDisplay = Math.round(pct * 100);

      lines.push('---');
      lines.push(`Overall: ${bar} ${totalClosed}/${totalTasks} (${pctDisplay}%)`);

      return cmdOk(lines.join('\n'));
    },
  },

  'detect-external-edits': {
    name: 'detect-external-edits',
    description: 'Detect ALL external modifications on a phase issue: body edits, label/status changes, edited comments, and unmarked comments. Usage: detect-external-edits --phase-number 1',
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

      const issueNumber = phaseIssue.number;

      // Fetch full issue data (includes updatedAt)
      const issueResult = await getIssue(issueNumber);
      if (!issueResult.ok) return cmdErr(issueResult.error);
      const issue = issueResult.data;

      // List comments on the phase issue
      const commentsResult = await listComments(issueNumber);
      if (!commentsResult.ok) return cmdErr(commentsResult.error);
      const comments = commentsResult.data;

      // ── Detection categories ───────────────────────────────────────────

      const report: {
        bodyEdits: Array<{ issueUpdatedAt: string; lastMaxsimCommentAt: string }>;
        editedComments: Array<{ id: number; type: string; createdAt: string; updatedAt: string }>;
        unmarkedComments: Array<{ id: number; user: string; createdAt: string; excerpt: string }>;
        labelEvents: Array<{ event: string; label: string; actor: string; createdAt: string }>;
        statusEvents: Array<{ event: string; actor: string; createdAt: string }>;
      } = {
        bodyEdits: [],
        editedComments: [],
        unmarkedComments: [],
        labelEvents: [],
        statusEvents: [],
      };

      // ── 1. Body edits: compare issue updatedAt vs last MAXSIM comment ─
      const maxsimCommentTimestamps: string[] = [];
      for (const comment of comments) {
        const meta = parseCommentMeta(comment.body);
        if (meta) {
          maxsimCommentTimestamps.push(comment.createdAt);
        }
      }

      if (maxsimCommentTimestamps.length > 0) {
        const lastMaxsimComment = maxsimCommentTimestamps.sort().pop()!;
        if (issue.updatedAt > lastMaxsimComment) {
          report.bodyEdits.push({
            issueUpdatedAt: issue.updatedAt,
            lastMaxsimCommentAt: lastMaxsimComment,
          });
        }
      }

      // ── 2. Edited MAXSIM comments ─────────────────────────────────────
      for (const comment of comments) {
        const meta = parseCommentMeta(comment.body);
        if (!meta) continue;
        if (comment.updatedAt > comment.createdAt) {
          report.editedComments.push({
            id: comment.id,
            type: meta.type,
            createdAt: comment.createdAt,
            updatedAt: comment.updatedAt,
          });
        }
      }

      // ── 3. Unmarked comments (no maxsim marker) ───────────────────────
      for (const comment of comments) {
        const meta = parseCommentMeta(comment.body);
        if (!meta) {
          report.unmarkedComments.push({
            id: comment.id,
            user: comment.user.login,
            createdAt: comment.createdAt,
            excerpt: truncate(comment.body.replace(/\n/g, ' '), 80),
          });
        }
      }

      // ── 4. Label and status events from external actors ────────────────
      const { owner, repo } = getRepoInfo();
      const eventsResult = ghJson<Array<{
        event: string;
        created_at: string;
        actor?: { login: string };
        label?: { name: string };
      }>>(['api', `repos/${owner}/${repo}/issues/${issueNumber}/events`, '--paginate']);

      if (eventsResult.ok) {
        const automationActors = new Set(['github-actions[bot]', 'github-project-automation[bot]']);
        for (const ev of eventsResult.data) {
          const actor = ev.actor?.login ?? 'unknown';
          const isAutomation = automationActors.has(actor);

          if ((ev.event === 'labeled' || ev.event === 'unlabeled') && !isAutomation) {
            report.labelEvents.push({
              event: ev.event,
              label: ev.label?.name ?? 'unknown',
              actor,
              createdAt: ev.created_at,
            });
          }

          if (
            (ev.event === 'moved_columns_in_project' ||
              ev.event === 'reopened' ||
              ev.event === 'closed') &&
            !isAutomation
          ) {
            report.statusEvents.push({
              event: ev.event,
              actor,
              createdAt: ev.created_at,
            });
          }
        }
      }

      // ── Build structured report ────────────────────────────────────────
      const totalFindings =
        report.bodyEdits.length +
        report.editedComments.length +
        report.unmarkedComments.length +
        report.labelEvents.length +
        report.statusEvents.length;

      if (totalFindings === 0) {
        return cmdOk('No external edits detected.');
      }

      const lines: string[] = [
        `External edit report for Phase ${phaseNumber} (#${issueNumber}):`,
        `Total findings: ${totalFindings}`,
        '',
      ];

      if (report.bodyEdits.length > 0) {
        lines.push('## Body Edits');
        for (const b of report.bodyEdits) {
          lines.push(`  Issue updated at ${b.issueUpdatedAt} (after last MAXSIM comment at ${b.lastMaxsimCommentAt})`);
        }
        lines.push('');
      }

      if (report.editedComments.length > 0) {
        lines.push(`## Edited MAXSIM Comments (${report.editedComments.length})`);
        for (const e of report.editedComments) {
          lines.push(`  Comment #${e.id} [type:${e.type}] — created: ${e.createdAt}, updated: ${e.updatedAt}`);
        }
        lines.push('');
      }

      if (report.unmarkedComments.length > 0) {
        lines.push(`## Unmarked Comments (${report.unmarkedComments.length})`);
        for (const u of report.unmarkedComments) {
          lines.push(`  Comment #${u.id} by @${u.user} at ${u.createdAt}: "${u.excerpt}"`);
        }
        lines.push('');
      }

      if (report.labelEvents.length > 0) {
        lines.push(`## Label Changes (${report.labelEvents.length})`);
        for (const l of report.labelEvents) {
          lines.push(`  ${l.event}: "${l.label}" by @${l.actor} at ${l.createdAt}`);
        }
        lines.push('');
      }

      if (report.statusEvents.length > 0) {
        lines.push(`## Status Changes (${report.statusEvents.length})`);
        for (const s of report.statusEvents) {
          lines.push(`  ${s.event} by @${s.actor} at ${s.createdAt}`);
        }
        lines.push('');
      }

      return cmdOk(lines.join('\n'));
    },
  },
};
