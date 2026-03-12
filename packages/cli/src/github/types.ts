/**
 * GitHub Integration -- Type definitions
 *
 * All types for the GitHub Issues/Projects v2 integration layer.
 * Used by client.ts, mapping.ts, issues.ts, projects.ts, and downstream modules.
 */

// ---- Error codes for gh CLI wrapper ----------------------------------------

export type GhErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'NOT_INSTALLED'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'SCOPE_MISSING'
  | 'UNKNOWN';

// ---- GhResult discriminated union ------------------------------------------

export type GhResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code: GhErrorCode };

// ---- Auth status -----------------------------------------------------------

export interface AuthStatus {
  installed: boolean;
  authenticated: boolean;
  scopes: string[];
  hasProjectScope: boolean;
  username: string | null;
}

// ---- Auth error (thrown by requireAuth) ------------------------------------

export class AuthError extends Error {
  constructor(
    public readonly code: 'NOT_INSTALLED' | 'NOT_AUTHENTICATED' | 'SCOPE_MISSING',
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ---- Close state reason ----------------------------------------------------

export type StateReason = 'completed' | 'not_planned';

// ---- Issue status ----------------------------------------------------------

export type IssueStatus = 'To Do' | 'In Progress' | 'In Review' | 'Done';

// ---- Task-to-issue mapping -------------------------------------------------

export interface TaskIssueMapping {
  number: number;
  /** Internal numeric ID used for sub-issue linking (NOT the human-readable number). */
  id: number;
  node_id: string;
  item_id: string;
  status: IssueStatus;
}

// ---- Phase mapping ---------------------------------------------------------

export interface PhaseMapping {
  tracking_issue: TaskIssueMapping;
  plan: string;
  tasks: Record<string, TaskIssueMapping>;
  body_hash?: string;
}

// ---- Root mapping file (.planning/github-issues.json) ----------------------

export interface IssueMappingFile {
  project_number: number;
  project_id: string;
  repo: string;
  status_field_id: string;
  status_options: Record<string, string>;
  estimate_field_id: string;
  milestone_id: number;
  milestone_title: string;
  labels: Record<string, string>;
  phases: Record<string, PhaseMapping>;
  /** @deprecated Todo functionality has been removed. Kept for backwards compatibility with existing mapping files. */
  todos?: Record<string, TaskIssueMapping>;
}

// ---- Label definitions -----------------------------------------------------

export const MAXSIM_LABELS = [
  { name: 'phase', color: '6f42c1', description: 'MAXSIM phase issue' },
  { name: 'task', color: '0075ca', description: 'MAXSIM task issue' },
  { name: 'blocker', color: 'd73a4a', description: 'Blocker issue' },
] as const;

// ---- Fibonacci story points ------------------------------------------------

export const FIBONACCI_POINTS = [1, 2, 3, 5, 8, 13, 21, 34] as const;

// ---- Default project board status columns ----------------------------------

export const DEFAULT_STATUS_OPTIONS = ['To Do', 'In Progress', 'In Review', 'Done'] as const;
