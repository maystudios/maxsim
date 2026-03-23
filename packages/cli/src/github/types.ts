/**
 * GitHub-specific types for MaxsimCLI v6.
 * Covers Projects v2, Issues, Sub-Issues, Milestones, Labels, Comments.
 */

// ── ID Types ──────────────────────────────────────────────────────────

/**
 * GitHub uses TWO id systems:
 * - Node ID (Base64 string like "PVT_kwDO..."): used in ALL GraphQL operations
 * - Numeric ID (integer like 123456789): used in REST URL paths and some REST bodies
 * Issue `.number` (e.g., #42) is NEITHER — it's the human-readable reference.
 */
export interface IssueIds {
  number: number;    // Human-readable: #42
  id: number;        // Internal numeric ID (REST bodies)
  nodeId: string;    // Base64 node ID (GraphQL)
}

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
  type: 'plan' | 'research' | 'context' | 'progress' | 'verification' | 'summary' | 'error' | 'escalation' | 'handoff' | 'user-intent';
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

/** Complete label taxonomy for MaxsimCLI projects. */
export const MAXSIM_LABELS: LabelDef[] = [
  // Type labels
  { name: 'type:phase', description: 'Phase issue', color: '1f6feb' },
  { name: 'type:task', description: 'Task sub-issue', color: '0e8a16' },
  { name: 'type:bug', description: 'Bug report', color: 'd73a4a' },
  { name: 'type:quick', description: 'Quick task', color: 'e4e669' },
  { name: 'type:user-issue', description: 'User-created issue', color: 'c5def5' },
  // Priority labels
  { name: 'priority:p0-critical', description: 'P0 Critical', color: 'b60205' },
  { name: 'priority:p1-high', description: 'P1 High', color: 'd93f0b' },
  { name: 'priority:p2-medium', description: 'P2 Medium', color: 'fbca04' },
  { name: 'priority:p3-low', description: 'P3 Low', color: '0e8a16' },
  // Status labels
  { name: 'status:planned', description: 'Planned', color: 'e1d5f7' },
  { name: 'status:planning', description: 'In planning', color: 'bfd4f2' },
  { name: 'status:ready', description: 'Ready for execution', color: '0075ca' },
  { name: 'status:blocked', description: 'Blocked', color: 'b60205' },
  // MaxsimCLI labels
  { name: 'maxsim:managed', description: 'Managed by MaxsimCLI', color: '5319e7' },
  { name: 'maxsim:lesson', description: 'Project learning', color: 'f9d0c4' },
  { name: 'maxsim:decision', description: 'Architecture decision', color: 'd4c5f9' },
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

/** Custom fields to create on every MaxsimCLI project board. */
export const BOARD_FIELDS = [
  { name: 'Priority', dataType: 'SINGLE_SELECT', options: ['P0 Critical', 'P1 High', 'P2 Medium', 'P3 Low'] },
  { name: 'Phase', dataType: 'NUMBER' },
  { name: 'Wave', dataType: 'NUMBER' },
  { name: 'Estimate', dataType: 'NUMBER' },
  { name: 'Type', dataType: 'SINGLE_SELECT' },
  { name: 'Status', dataType: 'SINGLE_SELECT' },
  { name: 'Iteration', dataType: 'ITERATION' },
] as const;

// ── Repo Info ─────────────────────────────────────────────────────────

export interface RepoInfo {
  owner: string;
  repo: string;
  isOrg: boolean;
}

// ── Operation Results ─────────────────────────────────────────────────

export type GhResultCode = 'NOT_FOUND' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'FORBIDDEN' | 'VALIDATION' | 'UNKNOWN';

export type GhResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: GhResultCode };
