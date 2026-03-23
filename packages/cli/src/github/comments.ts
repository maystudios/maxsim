/**
 * Structured comment parsing — extract and format HTML comment metadata.
 */

import type { MaxsimIssueMeta, MaxsimIssueState, MaxsimCommentMeta } from './types.js';

// ── Parse HTML Comment Blocks ─────────────────────────────────────────

const META_REGEX = /<!--\s*maxsim:meta\s*\n([\s\S]*?)\n\s*-->/;
const STATE_REGEX = /<!--\s*maxsim:state\s*\n([\s\S]*?)\n\s*-->/;
const COMMENT_META_REGEX = /<!--\s*maxsim:type=(\w+)\s*(.*?)\s*-->/;

/** Parse key-value pairs from a YAML-like block inside HTML comments. */
function parseKV(block: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of block.split('\n')) {
    const match = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

/** Parse JSON-like arrays from a string value. */
function parseArray(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
}

function parseNumberArray(value: string | undefined): number[] {
  return parseArray(value).map(Number).filter(n => !Number.isNaN(n));
}

/** Extract MaxsimIssueMeta from an issue body. */
export function parseIssueMeta(body: string): MaxsimIssueMeta | null {
  const match = body.match(META_REGEX);
  if (!match) return null;

  const kv = parseKV(match[1]);
  return {
    type: (kv.type as MaxsimIssueMeta['type']) ?? 'user',
    phase: kv.phase ? Number(kv.phase) : null,
    task: kv.task ? Number(kv.task) : null,
    parentIssue: kv.parent_issue ? Number(kv.parent_issue) : null,
    status: kv.status ?? 'planning',
    estimate: kv.estimate ? Number(kv.estimate) : null,
    wave: kv.wave ? Number(kv.wave) : null,
    createdAt: kv.created_at ?? new Date().toISOString(),
    createdBy: kv.created_by ?? 'maxsim',
  };
}

/** Extract MaxsimIssueState from an issue body. */
export function parseIssueState(body: string): MaxsimIssueState | null {
  const match = body.match(STATE_REGEX);
  if (!match) return null;

  const kv = parseKV(match[1]);
  return {
    taskIds: parseNumberArray(kv.task_ids),
    plannedAt: kv.planned_at !== 'null' ? (kv.planned_at ?? null) : null,
    executedAt: kv.executed_at !== 'null' ? (kv.executed_at ?? null) : null,
    verifiedAt: kv.verified_at !== 'null' ? (kv.verified_at ?? null) : null,
    executorBranches: parseArray(kv.executor_branches),
    worktreeBranch: kv.worktree_branch !== 'null' ? (kv.worktree_branch ?? null) : null,
    verificationPassed: kv.verification_passed === 'true' ? true : kv.verification_passed === 'false' ? false : null,
    retryCount: kv.retry_count ? Number(kv.retry_count) : 0,
  };
}

/** Extract comment metadata from the first line HTML comment. */
export function parseCommentMeta(body: string): MaxsimCommentMeta | null {
  const match = body.match(COMMENT_META_REGEX);
  if (!match) return null;

  const type = match[1] as MaxsimCommentMeta['type'];
  const attrs: Record<string, unknown> = { type };

  // Parse space-separated key=value pairs
  const attrStr = match[2];
  const attrRegex = /(\w+)=(?:"([^"]*?)"|(\S+))/g;
  for (const attrMatch of attrStr.matchAll(attrRegex)) {
    const key = attrMatch[1];
    const value = attrMatch[2] ?? attrMatch[3];
    // Try to parse as number
    const num = Number(value);
    attrs[key] = Number.isNaN(num) ? value : num;
  }

  return attrs as MaxsimCommentMeta;
}

// ── Format HTML Comment Blocks ────────────────────────────────────────

/** Generate the meta HTML comment block for an issue body. */
export function formatIssueMeta(meta: MaxsimIssueMeta): string {
  const lines = [
    `type: ${meta.type}`,
    `phase: ${meta.phase ?? 'null'}`,
  ];
  if (meta.task !== null) lines.push(`task: ${meta.task}`);
  if (meta.parentIssue !== null) lines.push(`parent_issue: ${meta.parentIssue}`);
  lines.push(
    `status: ${meta.status}`,
    `estimate: ${meta.estimate ?? 'null'}`,
    `wave: ${meta.wave ?? 'null'}`,
    `created_at: ${meta.createdAt}`,
    `created_by: ${meta.createdBy}`,
  );
  return `<!-- maxsim:meta\n${lines.join('\n')}\n-->`;
}

/** Generate the state HTML comment block for an issue body. */
export function formatIssueState(state: MaxsimIssueState): string {
  const lines = [
    `task_ids: ${JSON.stringify(state.taskIds)}`,
    `planned_at: ${state.plannedAt ?? 'null'}`,
    `executed_at: ${state.executedAt ?? 'null'}`,
    `verified_at: ${state.verifiedAt ?? 'null'}`,
    `executor_branches: ${JSON.stringify(state.executorBranches)}`,
    `worktree_branch: ${state.worktreeBranch ?? 'null'}`,
    `verification_passed: ${state.verificationPassed ?? 'null'}`,
    `retry_count: ${state.retryCount}`,
  ];
  return `<!-- maxsim:state\n${lines.join('\n')}\n-->`;
}

/** Generate a comment header with metadata. */
export function formatCommentHeader(meta: MaxsimCommentMeta): string {
  const entries = Object.entries(meta)
    .filter(([k]) => k !== 'type')
    .map(([k, v]) => /^\w+$/.test(String(v)) ? `${k}=${v}` : `${k}="${v}"`)
    .join(' ');
  return `<!-- maxsim:type=${meta.type}${entries ? ` ${entries}` : ''} -->`;
}

/** Build a complete issue body with meta, content, and state blocks. */
export function buildIssueBody(
  meta: MaxsimIssueMeta,
  content: string,
  state: MaxsimIssueState,
): string {
  return `${formatIssueMeta(meta)}\n\n${content}\n\n${formatIssueState(state)}`;
}
