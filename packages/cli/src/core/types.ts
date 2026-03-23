/**
 * Core type definitions for MaxsimCLI v6.
 * Single source of truth — all modules import types from here.
 */

// ── Result Types ──────────────────────────────────────────────────────

interface CmdOk {
  ok: true;
  result: unknown;
  rawValue?: unknown;
}

interface CmdFail {
  ok: false;
  error: string;
}

/** Discriminated union for CLI command results. */
export type CmdResult = CmdOk | CmdFail;

export function cmdOk(result: unknown, rawValue?: unknown): CmdResult {
  return { ok: true, result, rawValue };
}

export function cmdErr(error: string): CmdResult {
  return { ok: false, error };
}

// ── Enums ─────────────────────────────────────────────────────────────

/**
 * GitHub Project Board columns (Kanban).
 * @internal — reserved for future use
 */
export const ProjectStatus = {
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

// ── Config Schema ─────────────────────────────────────────────────────

export interface MaxsimConfig {
  version: string;
  execution: {
    modelProfile: ModelProfile;
    parallelism: {
      maxAgentsPerWave: number;
      maxRetries: number;
      competitionStrategy: CompetitionStrategy;
    };
    verification: {
      strictMode: boolean;
      gates: VerificationGate[];
      requireCodeReview: boolean;
      autoResolveConflicts: boolean;
    };
  };
  worktrees: {
    basePath: string;
    autoCleanup: boolean;
    branchPrefix: string;
  };
  automation: {
    autoCommitOnSuccess: boolean;
    conventionalCommits: boolean;
  };
  github: {
    projectName: string;
    autoPush: boolean;
  };
  hooks: {
    enabled: boolean;
  };
}

export const DEFAULT_CONFIG: MaxsimConfig = {
  version: '6.0.0',
  execution: {
    modelProfile: ModelProfile.BALANCED,
    parallelism: {
      maxAgentsPerWave: 3,
      maxRetries: 3,
      competitionStrategy: CompetitionStrategy.STANDARD,
    },
    verification: {
      strictMode: true,
      gates: [
        VerificationGate.TESTS_PASS,
        VerificationGate.BUILD_SUCCEEDS,
        VerificationGate.LINT_CLEAN,
        VerificationGate.SPEC_COMPLIANCE,
        VerificationGate.CODE_REVIEW,
      ],
      requireCodeReview: true,
      autoResolveConflicts: true,
    },
  },
  worktrees: {
    basePath: '.maxsim-worktrees/',
    autoCleanup: true,
    branchPrefix: 'maxsim/',
  },
  automation: {
    autoCommitOnSuccess: true,
    conventionalCommits: true,
  },
  github: {
    projectName: '',
    autoPush: true,
  },
  hooks: {
    enabled: true,
  },
};
