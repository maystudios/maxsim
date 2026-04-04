/**
 * Core type definitions for MaxsimCLI v6.
 * Single source of truth — all modules import types from here.
 */

import { VERSION } from './version.js';
import type { ErrorRecovery } from './errors.js';

// ── Result Types ──────────────────────────────────────────────────────

interface CmdOk {
  ok: true;
  result: unknown;
  rawValue?: unknown;
}

interface CmdFail {
  ok: false;
  error: string;
  recovery?: ErrorRecovery;
}

/** Discriminated union for CLI command results. */
export type CmdResult = CmdOk | CmdFail;

export function cmdOk(result: unknown, rawValue?: unknown): CmdResult {
  return { ok: true, result, rawValue };
}

export function cmdErr(error: string, recovery?: ErrorRecovery): CmdResult {
  return recovery ? { ok: false, error, recovery } : { ok: false, error };
}

// ── Enums ─────────────────────────────────────────────────────────────

/**
 * GitHub Project Board columns (Kanban).
 * @internal — reserved for future use
 */
export const ProjectStatus = {
  BACKLOG: 'Backlog',
  TO_DO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

/**
 * Issue priority levels.
 * @internal — reserved for future use
 */
export const Priority = {
  P0_CRITICAL: 'P0 Critical',
  P1_HIGH: 'P1 High',
  P2_MEDIUM: 'P2 Medium',
  P3_LOW: 'P3 Low',
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

/** Agent types. */
export const AgentType = {
  EXECUTOR: 'executor',
  PLANNER: 'planner',
  RESEARCHER: 'researcher',
  VERIFIER: 'verifier',
} as const;
export type AgentType = (typeof AgentType)[keyof typeof AgentType];

/** Claude model tiers. */
export const Model = {
  HAIKU: 'haiku',
  SONNET: 'sonnet',
  OPUS: 'opus',
} as const;
export type Model = (typeof Model)[keyof typeof Model];

/** Model allocation profiles. */
export const ModelProfile = {
  QUALITY: 'quality',
  BALANCED: 'balanced',
  BUDGET: 'budget',
} as const;
export type ModelProfile = (typeof ModelProfile)[keyof typeof ModelProfile];

/** Task complexity levels for agent parallelism scaling. */
export const TaskComplexity = {
  SIMPLE: 'simple',
  MEDIUM: 'medium',
  COMPLEX: 'complex',
} as const;
export type TaskComplexity = (typeof TaskComplexity)[keyof typeof TaskComplexity];

/** Verification gate types. */
export const VerificationGate = {
  TESTS_PASS: 'tests_pass',
  BUILD_SUCCEEDS: 'build_succeeds',
  LINT_CLEAN: 'lint_clean',
  SPEC_COMPLIANCE: 'spec_compliance',
  CODE_REVIEW: 'code_review',
} as const;
export type VerificationGate =
  (typeof VerificationGate)[keyof typeof VerificationGate];

/** Verification result states. */
export const VerificationResult = {
  PASS: 'pass',
  FAIL: 'fail',
  SKIPPED: 'skipped',
} as const;
export type VerificationResult =
  (typeof VerificationResult)[keyof typeof VerificationResult];

/**
 * Task execution states.
 * @internal — reserved for future use
 */
export const TaskState = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BLOCKED: 'blocked',
} as const;
export type TaskState = (typeof TaskState)[keyof typeof TaskState];

/**
 * Wave scheduling states.
 * @internal — reserved for future use
 */
export const WaveState = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type WaveState = (typeof WaveState)[keyof typeof WaveState];

/** Competitive implementation strategy. */
export const CompetitionStrategy = {
  NONE: 'none',
  QUICK: 'quick',
  STANDARD: 'standard',
  DEEP: 'deep',
} as const;
export type CompetitionStrategy =
  (typeof CompetitionStrategy)[keyof typeof CompetitionStrategy];

// ── Model Profiles ────────────────────────────────────────────────────

export interface ModelAssignment {
  planner: Model;
  executor: Model;
  researcher: Model;
  verifier: Model;
}

/** Model assignments per profile (from PROJECT.md §7.4). */
export const MODEL_PROFILES: Record<ModelProfile, ModelAssignment> = {
  [ModelProfile.QUALITY]: {
    planner: Model.OPUS,
    executor: Model.OPUS,
    researcher: Model.SONNET,
    verifier: Model.OPUS,
  },
  [ModelProfile.BALANCED]: {
    planner: Model.OPUS,
    executor: Model.SONNET,
    researcher: Model.SONNET,
    verifier: Model.SONNET,
  },
  [ModelProfile.BUDGET]: {
    planner: Model.SONNET,
    executor: Model.SONNET,
    researcher: Model.HAIKU,
    verifier: Model.SONNET,
  },
};

/** Parallelism limits per model profile (from PROJECT.md §7.4). */
export const PARALLELISM_LIMITS: Record<
  ModelProfile,
  { max_agents: number; typical_range: [number, number] }
> = {
  [ModelProfile.QUALITY]: { max_agents: 40, typical_range: [20, 40] },
  [ModelProfile.BALANCED]: { max_agents: 20, typical_range: [10, 20] },
  [ModelProfile.BUDGET]: { max_agents: 10, typical_range: [5, 10] },
};

// ── Config Schema ─────────────────────────────────────────────────────

export interface MaxsimConfig {
  version: string;
  execution: {
    model_profile: ModelProfile;
    competitive_enabled: boolean;
    model_overrides?: Partial<Record<AgentType, Model>>;
    parallelism: {
      max_agents_per_wave: number;
      max_retries: number;
      competition_strategy: CompetitionStrategy;
    };
    verification: {
      strict_mode: boolean;
      gates: VerificationGate[];
      require_code_review: boolean;
      auto_resolve_conflicts: boolean;
    };
  };
  worktrees: {
    auto_cleanup: boolean;
    branch_prefix: string;
    path_template: string;
    branch_template: string;
  };
  automation: {
    auto_commit_on_success: boolean;
    conventional_commits: boolean;
    co_author: string;
  };
  github: {
    projectName: string;
    project_number?: number;
    milestone_number?: number;
    auto_push: boolean;
  };
  hooks: {
    enabled: boolean;
  };
  workflow: {
    research: boolean;
    plan_checker: boolean;
    verifier: boolean;
    auto_advance: boolean;
  };
  git: {
    branching_strategy: 'none' | 'phase' | 'milestone';
  };
}

export const DEFAULT_CONFIG: MaxsimConfig = {
  version: VERSION,
  execution: {
    model_profile: ModelProfile.BALANCED,
    competitive_enabled: false,
    parallelism: {
      max_agents_per_wave: 3,
      max_retries: 3,
      competition_strategy: CompetitionStrategy.STANDARD,
    },
    verification: {
      strict_mode: true,
      gates: [
        VerificationGate.TESTS_PASS,
        VerificationGate.BUILD_SUCCEEDS,
        VerificationGate.LINT_CLEAN,
        VerificationGate.SPEC_COMPLIANCE,
        VerificationGate.CODE_REVIEW,
      ],
      require_code_review: true,
      auto_resolve_conflicts: true,
    },
  },
  worktrees: {
    auto_cleanup: true,
    branch_prefix: 'maxsim/',
    path_template: '.claude/worktrees/agent-{id}/',
    branch_template: 'maxsim/phase-{N}-task-{id}',
  },
  automation: {
    auto_commit_on_success: true,
    conventional_commits: true,
    co_author: 'Co-Authored-By: Claude <noreply@anthropic.com>',
  },
  github: {
    projectName: '',
    auto_push: true,
  },
  hooks: {
    enabled: true,
  },
  workflow: {
    research: true,
    plan_checker: true,
    verifier: true,
    auto_advance: false,
  },
  git: {
    branching_strategy: 'phase',
  },
};
