/**
 * GitHub-specific types for MaxsimCLI v6.
 * Covers Projects v2, Issues, Sub-Issues, Milestones, Labels, Comments.
 */

// ── GitHub API Response Types ─────────────────────────────────────────

export interface GhUser {
  login: string;
  id: number;
  nodeId: string;
  type: 'User' | 'Organization';
}

export interface GhLabel {
  id: number;
  nodeId: string;
  name: string;
  description: string;
  color: string;
}

export interface GhMilestone {
  number: number;
  id: number;
  nodeId: string;
  title: string;
  description: string;
  state: 'open' | 'closed';
  openIssues: number;
  closedIssues: number;
  dueOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GhIssue {
  number: number;
  id: number;
  nodeId: string;
  title: string;
  body: string;
  state: 'open' | 'closed';
  stateReason: 'completed' | 'not_planned' | null;
  labels: GhLabel[];
  milestone: GhMilestone | null;
  assignees: GhUser[];
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface GhComment {
  id: number;
  nodeId: string;
  body: string;
  user: GhUser;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
}

export interface GhDiscussion {
  number: number;
  nodeId: string;
  title: string;
  body: string;
  categoryName: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

// ── Projects v2 Types ─────────────────────────────────────────────────

export interface GhProject {
  id: string;          // Node ID (PVT_*)
  number: number;
  title: string;
  description: string;
  url: string;
  closed: boolean;
}

export interface GhProjectField {
  id: string;          // Node ID (PVTF_* or PVTSSF_*)
  name: string;
  dataType: string;    // TEXT, NUMBER, DATE, SINGLE_SELECT, ITERATION, etc.
  options?: GhFieldOption[];
}

export interface GhFieldOption {
  id: string;          // Option UUID (not a node ID)
  name: string;
  color?: string;
}

export interface GhProjectItem {
  id: string;          // Node ID (PVTI_*)
  contentNodeId: string;
  contentType: 'Issue' | 'PullRequest' | 'DraftIssue';
  issueNumber?: number;
  title: string;
  isArchived: boolean;
}

// ── Maxsim Issue Metadata ─────────────────────────────────────────────

/** Machine-readable metadata embedded in issue body as HTML comments. */
export interface MaxsimIssueMeta {
  type: 'phase' | 'task' | 'bug' | 'quick' | 'user' | 'milestone';
  phase: number | null;
  task: number | null;
  parentIssue: number | null;
  status: string;
  estimate: number | null;
  wave: number | null;
  createdAt: string;
  createdBy: string;
}

/** Mutable state block embedded in issue body as HTML comment. */
export interface MaxsimIssueState {
  taskIds: number[];
  plannedAt: string | null;
  executedAt: string | null;
  verifiedAt: string | null;
  executorBranches: string[];
  worktreeBranch: string | null;
  verificationPassed: boolean | null;
  retryCount: number;
}

/** Structured comment metadata from HTML comment markers. */
export interface MaxsimCommentMeta {
  type: 'plan' | 'research' | 'context' | 'progress' | 'verification' | 'summary' | 'error' | 'escalation' | 'handoff' | 'user-intent' | 'phase-complete' | 'checkpoint';
  phase?: number;
  task?: number;
  [key: string]: unknown;
}

// ── Label Taxonomy ────────────────────────────────────────────────────

export interface LabelDef {
  name: string;
  description: string;
  color: string;
}

/** Complete label taxonomy for MaxsimCLI projects — 6 labels in 2 namespaces (§5.3). */
export const MAXSIM_LABELS: LabelDef[] = [
  // Type labels (4)
  { name: 'type:phase', description: 'A Phase Issue representing a major deliverable', color: '0075ca' },
  { name: 'type:task', description: 'A Task sub-issue within a phase', color: '1d76db' },
  { name: 'type:bug', description: 'Something is broken', color: 'd73a4a' },
  { name: 'type:quick', description: 'A quick, self-contained task', color: '5319e7' },
  // MaxsimCLI meta labels (2)
  { name: 'maxsim:auto', description: 'Created by MaxsimCLI automation', color: 'ededed' },
  { name: 'maxsim:user', description: 'Created by the user, not by MaxsimCLI', color: '0e8a16' },
];

// ── Board Configuration ───────────────────────────────────────────────

/** Status column definitions for the Kanban board. */
export const BOARD_COLUMNS = [
  { name: 'Backlog', color: 'GRAY' },
  { name: 'To Do', color: 'BLUE' },
  { name: 'In Progress', color: 'YELLOW' },
  { name: 'In Review', color: 'ORANGE' },
  { name: 'Done', color: 'GREEN' },
] as const;

// ── Wiki Types ────────────────────────────────────────────────────────

export interface GhWikiPage {
  slug: string;
  title: string;
  content: string;
}

// ── Repo Info ─────────────────────────────────────────────────────────

export interface RepoInfo {
  owner: string;
  repo: string;
  isOrg: boolean;
}

// ── Issue Relations ───────────────────────────────────────────────────

/** Represents a directional relation between two GitHub issues. */
export interface GhIssueRelation {
  issueNumber: number;
  relatedIssueNumber: number;
  type: 'blocked_by' | 'blocking' | 'duplicate' | 'related';
}

// ── Operation Results ─────────────────────────────────────────────────

export type GhResultCode = 'NOT_FOUND' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'FORBIDDEN' | 'VALIDATION' | 'UNKNOWN';

export type GhResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: GhResultCode };
