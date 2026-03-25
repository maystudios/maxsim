/**
 * State/phase type and transition tests.
 * Validates enum completeness, state transition validity,
 * model profile data, parallelism limits, and default config structure.
 */
import { describe, it, expect } from 'vitest';
import {
  ProjectStatus,
  TaskState,
  WaveState,
  CompetitionStrategy,
  Model,
  ModelProfile,
  TaskComplexity,
  Priority,
  VerificationGate,
  VerificationResult,
  MODEL_PROFILES,
  PARALLELISM_LIMITS,
  DEFAULT_CONFIG,
} from '../../src/core/types.js';

// ── ProjectStatus enum ────────────────────────────────────────────────

describe('ProjectStatus enum values', () => {
  it('defines all 5 Kanban column values', () => {
    const values = Object.values(ProjectStatus);
    expect(values).toHaveLength(5);
    expect(values).toContain('Backlog');
    expect(values).toContain('To Do');
    expect(values).toContain('In Progress');
    expect(values).toContain('In Review');
    expect(values).toContain('Done');
  });

  it('has expected keys', () => {
    expect(ProjectStatus.BACKLOG).toBeDefined();
    expect(ProjectStatus.TO_DO).toBeDefined();
    expect(ProjectStatus.IN_PROGRESS).toBeDefined();
    expect(ProjectStatus.IN_REVIEW).toBeDefined();
    expect(ProjectStatus.DONE).toBeDefined();
  });

  it('all values are unique strings', () => {
    const values = Object.values(ProjectStatus);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
    for (const v of values) {
      expect(typeof v).toBe('string');
    }
  });
});

// ── TaskState enum ────────────────────────────────────────────────────

describe('TaskState enum values', () => {
  it('defines all 5 task states', () => {
    const values = Object.values(TaskState);
    expect(values).toHaveLength(5);
    expect(values).toContain('pending');
    expect(values).toContain('in_progress');
    expect(values).toContain('completed');
    expect(values).toContain('failed');
    expect(values).toContain('blocked');
  });

  it('has expected keys', () => {
    expect(TaskState.PENDING).toBe('pending');
    expect(TaskState.IN_PROGRESS).toBe('in_progress');
    expect(TaskState.COMPLETED).toBe('completed');
    expect(TaskState.FAILED).toBe('failed');
    expect(TaskState.BLOCKED).toBe('blocked');
  });

  it('all values are unique strings', () => {
    const values = Object.values(TaskState);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

// ── WaveState enum ────────────────────────────────────────────────────

describe('WaveState enum values', () => {
  it('defines all 4 wave states', () => {
    const values = Object.values(WaveState);
    expect(values).toHaveLength(4);
    expect(values).toContain('scheduled');
    expect(values).toContain('in_progress');
    expect(values).toContain('completed');
    expect(values).toContain('failed');
  });

  it('has expected keys', () => {
    expect(WaveState.SCHEDULED).toBe('scheduled');
    expect(WaveState.IN_PROGRESS).toBe('in_progress');
    expect(WaveState.COMPLETED).toBe('completed');
    expect(WaveState.FAILED).toBe('failed');
  });

  it('all values are unique strings', () => {
    const values = Object.values(WaveState);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });
});

// ── CompetitionStrategy enum ──────────────────────────────────────────

describe('CompetitionStrategy enum values', () => {
  it('defines all 4 strategies', () => {
    const values = Object.values(CompetitionStrategy);
    expect(values).toHaveLength(4);
    expect(values).toContain('none');
    expect(values).toContain('quick');
    expect(values).toContain('standard');
    expect(values).toContain('deep');
  });

  it('has expected keys', () => {
    expect(CompetitionStrategy.NONE).toBe('none');
    expect(CompetitionStrategy.QUICK).toBe('quick');
    expect(CompetitionStrategy.STANDARD).toBe('standard');
    expect(CompetitionStrategy.DEEP).toBe('deep');
  });
});

// ── Valid state transitions ───────────────────────────────────────────

describe('TaskState valid transitions', () => {
  /**
   * Defines the allowed state transitions for tasks.
   * pending -> in_progress (task starts)
   * pending -> blocked (dependency not met)
   * in_progress -> completed (task succeeds)
   * in_progress -> failed (task errors)
   * in_progress -> blocked (dependency discovered)
   * blocked -> pending (dependency resolved)
   * failed -> pending (retry)
   */
  const VALID_TASK_TRANSITIONS: Record<string, string[]> = {
    [TaskState.PENDING]: [TaskState.IN_PROGRESS, TaskState.BLOCKED],
    [TaskState.IN_PROGRESS]: [TaskState.COMPLETED, TaskState.FAILED, TaskState.BLOCKED],
    [TaskState.BLOCKED]: [TaskState.PENDING],
    [TaskState.FAILED]: [TaskState.PENDING],
    [TaskState.COMPLETED]: [], // terminal state
  };

  function isValidTaskTransition(from: string, to: string): boolean {
    return VALID_TASK_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('pending -> in_progress is valid', () => {
    expect(isValidTaskTransition(TaskState.PENDING, TaskState.IN_PROGRESS)).toBe(true);
  });

  it('pending -> blocked is valid', () => {
    expect(isValidTaskTransition(TaskState.PENDING, TaskState.BLOCKED)).toBe(true);
  });

  it('in_progress -> completed is valid', () => {
    expect(isValidTaskTransition(TaskState.IN_PROGRESS, TaskState.COMPLETED)).toBe(true);
  });

  it('in_progress -> failed is valid', () => {
    expect(isValidTaskTransition(TaskState.IN_PROGRESS, TaskState.FAILED)).toBe(true);
  });

  it('in_progress -> blocked is valid', () => {
    expect(isValidTaskTransition(TaskState.IN_PROGRESS, TaskState.BLOCKED)).toBe(true);
  });

  it('blocked -> pending is valid (dependency resolved)', () => {
    expect(isValidTaskTransition(TaskState.BLOCKED, TaskState.PENDING)).toBe(true);
  });

  it('failed -> pending is valid (retry)', () => {
    expect(isValidTaskTransition(TaskState.FAILED, TaskState.PENDING)).toBe(true);
  });

  it('completed is a terminal state (no outgoing transitions)', () => {
    expect(VALID_TASK_TRANSITIONS[TaskState.COMPLETED]).toEqual([]);
  });

  it('completed -> pending is not valid', () => {
    expect(isValidTaskTransition(TaskState.COMPLETED, TaskState.PENDING)).toBe(false);
  });

  it('completed -> in_progress is not valid', () => {
    expect(isValidTaskTransition(TaskState.COMPLETED, TaskState.IN_PROGRESS)).toBe(false);
  });

  it('pending -> completed is not valid (must go through in_progress)', () => {
    expect(isValidTaskTransition(TaskState.PENDING, TaskState.COMPLETED)).toBe(false);
  });

  it('pending -> failed is not valid (must go through in_progress)', () => {
    expect(isValidTaskTransition(TaskState.PENDING, TaskState.FAILED)).toBe(false);
  });

  it('full lifecycle: pending -> in_progress -> completed', () => {
    let state: string = TaskState.PENDING;

    expect(isValidTaskTransition(state, TaskState.IN_PROGRESS)).toBe(true);
    state = TaskState.IN_PROGRESS;

    expect(isValidTaskTransition(state, TaskState.COMPLETED)).toBe(true);
    state = TaskState.COMPLETED;

    expect(state).toBe(TaskState.COMPLETED);
  });

  it('retry lifecycle: pending -> in_progress -> failed -> pending -> in_progress -> completed', () => {
    let state: string = TaskState.PENDING;

    expect(isValidTaskTransition(state, TaskState.IN_PROGRESS)).toBe(true);
    state = TaskState.IN_PROGRESS;

    expect(isValidTaskTransition(state, TaskState.FAILED)).toBe(true);
    state = TaskState.FAILED;

    expect(isValidTaskTransition(state, TaskState.PENDING)).toBe(true);
    state = TaskState.PENDING;

    expect(isValidTaskTransition(state, TaskState.IN_PROGRESS)).toBe(true);
    state = TaskState.IN_PROGRESS;

    expect(isValidTaskTransition(state, TaskState.COMPLETED)).toBe(true);
    state = TaskState.COMPLETED;

    expect(state).toBe(TaskState.COMPLETED);
  });

  it('blocked lifecycle: pending -> blocked -> pending -> in_progress -> completed', () => {
    let state: string = TaskState.PENDING;

    expect(isValidTaskTransition(state, TaskState.BLOCKED)).toBe(true);
    state = TaskState.BLOCKED;

    expect(isValidTaskTransition(state, TaskState.PENDING)).toBe(true);
    state = TaskState.PENDING;

    expect(isValidTaskTransition(state, TaskState.IN_PROGRESS)).toBe(true);
    state = TaskState.IN_PROGRESS;

    expect(isValidTaskTransition(state, TaskState.COMPLETED)).toBe(true);
    state = TaskState.COMPLETED;

    expect(state).toBe(TaskState.COMPLETED);
  });

  it('every defined state has an entry in the transition table', () => {
    for (const state of Object.values(TaskState)) {
      expect(VALID_TASK_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('all transition targets are valid TaskState values', () => {
    const validStates = Object.values(TaskState) as string[];
    for (const targets of Object.values(VALID_TASK_TRANSITIONS)) {
      for (const target of targets) {
        expect(validStates).toContain(target);
      }
    }
  });
});

describe('WaveState valid transitions', () => {
  /**
   * Defines the allowed state transitions for waves.
   * scheduled -> in_progress (wave starts)
   * in_progress -> completed (all tasks done)
   * in_progress -> failed (critical error)
   * failed -> scheduled (retry wave)
   */
  const VALID_WAVE_TRANSITIONS: Record<string, string[]> = {
    [WaveState.SCHEDULED]: [WaveState.IN_PROGRESS],
    [WaveState.IN_PROGRESS]: [WaveState.COMPLETED, WaveState.FAILED],
    [WaveState.FAILED]: [WaveState.SCHEDULED],
    [WaveState.COMPLETED]: [], // terminal state
  };

  function isValidWaveTransition(from: string, to: string): boolean {
    return VALID_WAVE_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('scheduled -> in_progress is valid', () => {
    expect(isValidWaveTransition(WaveState.SCHEDULED, WaveState.IN_PROGRESS)).toBe(true);
  });

  it('in_progress -> completed is valid', () => {
    expect(isValidWaveTransition(WaveState.IN_PROGRESS, WaveState.COMPLETED)).toBe(true);
  });

  it('in_progress -> failed is valid', () => {
    expect(isValidWaveTransition(WaveState.IN_PROGRESS, WaveState.FAILED)).toBe(true);
  });

  it('failed -> scheduled is valid (retry)', () => {
    expect(isValidWaveTransition(WaveState.FAILED, WaveState.SCHEDULED)).toBe(true);
  });

  it('completed is a terminal state', () => {
    expect(VALID_WAVE_TRANSITIONS[WaveState.COMPLETED]).toEqual([]);
  });

  it('scheduled -> completed is not valid (must go through in_progress)', () => {
    expect(isValidWaveTransition(WaveState.SCHEDULED, WaveState.COMPLETED)).toBe(false);
  });

  it('scheduled -> failed is not valid (must go through in_progress)', () => {
    expect(isValidWaveTransition(WaveState.SCHEDULED, WaveState.FAILED)).toBe(false);
  });

  it('completed -> scheduled is not valid', () => {
    expect(isValidWaveTransition(WaveState.COMPLETED, WaveState.SCHEDULED)).toBe(false);
  });

  it('full lifecycle: scheduled -> in_progress -> completed', () => {
    let state: string = WaveState.SCHEDULED;

    expect(isValidWaveTransition(state, WaveState.IN_PROGRESS)).toBe(true);
    state = WaveState.IN_PROGRESS;

    expect(isValidWaveTransition(state, WaveState.COMPLETED)).toBe(true);
    state = WaveState.COMPLETED;

    expect(state).toBe(WaveState.COMPLETED);
  });

  it('retry lifecycle: scheduled -> in_progress -> failed -> scheduled -> in_progress -> completed', () => {
    let state: string = WaveState.SCHEDULED;

    expect(isValidWaveTransition(state, WaveState.IN_PROGRESS)).toBe(true);
    state = WaveState.IN_PROGRESS;

    expect(isValidWaveTransition(state, WaveState.FAILED)).toBe(true);
    state = WaveState.FAILED;

    expect(isValidWaveTransition(state, WaveState.SCHEDULED)).toBe(true);
    state = WaveState.SCHEDULED;

    expect(isValidWaveTransition(state, WaveState.IN_PROGRESS)).toBe(true);
    state = WaveState.IN_PROGRESS;

    expect(isValidWaveTransition(state, WaveState.COMPLETED)).toBe(true);
    state = WaveState.COMPLETED;

    expect(state).toBe(WaveState.COMPLETED);
  });

  it('every defined state has an entry in the transition table', () => {
    for (const state of Object.values(WaveState)) {
      expect(VALID_WAVE_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('all transition targets are valid WaveState values', () => {
    const validStates = Object.values(WaveState) as string[];
    for (const targets of Object.values(VALID_WAVE_TRANSITIONS)) {
      for (const target of targets) {
        expect(validStates).toContain(target);
      }
    }
  });
});

describe('ProjectStatus valid transitions', () => {
  /**
   * Kanban board transition rules.
   * Backlog -> To Do (prioritized)
   * To Do -> In Progress (work started)
   * In Progress -> In Review (ready for review)
   * In Progress -> Backlog (deprioritized)
   * In Review -> Done (approved)
   * In Review -> In Progress (changes requested)
   */
  const VALID_PROJECT_TRANSITIONS: Record<string, string[]> = {
    [ProjectStatus.BACKLOG]: [ProjectStatus.TO_DO],
    [ProjectStatus.TO_DO]: [ProjectStatus.IN_PROGRESS],
    [ProjectStatus.IN_PROGRESS]: [ProjectStatus.IN_REVIEW, ProjectStatus.BACKLOG],
    [ProjectStatus.IN_REVIEW]: [ProjectStatus.DONE, ProjectStatus.IN_PROGRESS],
    [ProjectStatus.DONE]: [], // terminal state
  };

  function isValidProjectTransition(from: string, to: string): boolean {
    return VALID_PROJECT_TRANSITIONS[from]?.includes(to) ?? false;
  }

  it('Backlog -> To Do is valid', () => {
    expect(isValidProjectTransition(ProjectStatus.BACKLOG, ProjectStatus.TO_DO)).toBe(true);
  });

  it('To Do -> In Progress is valid', () => {
    expect(isValidProjectTransition(ProjectStatus.TO_DO, ProjectStatus.IN_PROGRESS)).toBe(true);
  });

  it('In Progress -> In Review is valid', () => {
    expect(isValidProjectTransition(ProjectStatus.IN_PROGRESS, ProjectStatus.IN_REVIEW)).toBe(true);
  });

  it('In Review -> Done is valid', () => {
    expect(isValidProjectTransition(ProjectStatus.IN_REVIEW, ProjectStatus.DONE)).toBe(true);
  });

  it('In Review -> In Progress is valid (changes requested)', () => {
    expect(isValidProjectTransition(ProjectStatus.IN_REVIEW, ProjectStatus.IN_PROGRESS)).toBe(true);
  });

  it('In Progress -> Backlog is valid (deprioritized)', () => {
    expect(isValidProjectTransition(ProjectStatus.IN_PROGRESS, ProjectStatus.BACKLOG)).toBe(true);
  });

  it('Done is a terminal state', () => {
    expect(VALID_PROJECT_TRANSITIONS[ProjectStatus.DONE]).toEqual([]);
  });

  it('Backlog -> Done is not valid (must progress through stages)', () => {
    expect(isValidProjectTransition(ProjectStatus.BACKLOG, ProjectStatus.DONE)).toBe(false);
  });

  it('full lifecycle: Backlog -> To Do -> In Progress -> In Review -> Done', () => {
    let state: string = ProjectStatus.BACKLOG;

    expect(isValidProjectTransition(state, ProjectStatus.TO_DO)).toBe(true);
    state = ProjectStatus.TO_DO;

    expect(isValidProjectTransition(state, ProjectStatus.IN_PROGRESS)).toBe(true);
    state = ProjectStatus.IN_PROGRESS;

    expect(isValidProjectTransition(state, ProjectStatus.IN_REVIEW)).toBe(true);
    state = ProjectStatus.IN_REVIEW;

    expect(isValidProjectTransition(state, ProjectStatus.DONE)).toBe(true);
    state = ProjectStatus.DONE;

    expect(state).toBe(ProjectStatus.DONE);
  });
});

// ── MODEL_PROFILES structure ──────────────────────────────────────────

describe('MODEL_PROFILES completeness', () => {
  const allProfiles = Object.values(ModelProfile);
  const allAgentKeys: Array<keyof typeof MODEL_PROFILES[ModelProfile]> = [
    'planner',
    'executor',
    'researcher',
    'verifier',
  ];

  it('has all 3 profiles defined', () => {
    expect(Object.keys(MODEL_PROFILES)).toHaveLength(3);
    for (const profile of allProfiles) {
      expect(MODEL_PROFILES[profile]).toBeDefined();
    }
  });

  it('every profile assigns all 4 agent types', () => {
    for (const profile of allProfiles) {
      const assignment = MODEL_PROFILES[profile];
      for (const key of allAgentKeys) {
        expect(assignment[key]).toBeDefined();
        expect(typeof assignment[key]).toBe('string');
      }
    }
  });

  it('every profile assigns only valid Model values', () => {
    const validModels = Object.values(Model) as string[];
    for (const profile of allProfiles) {
      const assignment = MODEL_PROFILES[profile];
      for (const key of allAgentKeys) {
        expect(validModels).toContain(assignment[key]);
      }
    }
  });

  it('quality profile uses the most powerful models', () => {
    const quality = MODEL_PROFILES[ModelProfile.QUALITY];
    expect(quality.planner).toBe(Model.OPUS);
    expect(quality.executor).toBe(Model.OPUS);
    expect(quality.verifier).toBe(Model.OPUS);
  });

  it('budget profile does not use opus for executor', () => {
    const budget = MODEL_PROFILES[ModelProfile.BUDGET];
    expect(budget.executor).not.toBe(Model.OPUS);
  });
});

// ── PARALLELISM_LIMITS structure ──────────────────────────────────────

describe('PARALLELISM_LIMITS completeness', () => {
  const allProfiles = Object.values(ModelProfile);

  it('has all 3 profiles defined', () => {
    expect(Object.keys(PARALLELISM_LIMITS)).toHaveLength(3);
    for (const profile of allProfiles) {
      expect(PARALLELISM_LIMITS[profile]).toBeDefined();
    }
  });

  it('every profile has max_agents as a positive integer', () => {
    for (const profile of allProfiles) {
      const limit = PARALLELISM_LIMITS[profile];
      expect(limit.max_agents).toBeGreaterThan(0);
      expect(Number.isInteger(limit.max_agents)).toBe(true);
    }
  });

  it('every profile has typical_range as a 2-element tuple', () => {
    for (const profile of allProfiles) {
      const limit = PARALLELISM_LIMITS[profile];
      expect(limit.typical_range).toHaveLength(2);
      expect(limit.typical_range[0]).toBeGreaterThan(0);
      expect(limit.typical_range[1]).toBeGreaterThanOrEqual(limit.typical_range[0]);
    }
  });

  it('typical_range upper bound does not exceed max_agents', () => {
    for (const profile of allProfiles) {
      const limit = PARALLELISM_LIMITS[profile];
      expect(limit.typical_range[1]).toBeLessThanOrEqual(limit.max_agents);
    }
  });

  it('quality has highest max_agents, budget has lowest', () => {
    expect(PARALLELISM_LIMITS[ModelProfile.QUALITY].max_agents).toBeGreaterThan(
      PARALLELISM_LIMITS[ModelProfile.BALANCED].max_agents,
    );
    expect(PARALLELISM_LIMITS[ModelProfile.BALANCED].max_agents).toBeGreaterThan(
      PARALLELISM_LIMITS[ModelProfile.BUDGET].max_agents,
    );
  });

  it('quality profile allows 40 agents with range [20, 40]', () => {
    const q = PARALLELISM_LIMITS[ModelProfile.QUALITY];
    expect(q.max_agents).toBe(40);
    expect(q.typical_range).toEqual([20, 40]);
  });

  it('balanced profile allows 20 agents with range [10, 20]', () => {
    const b = PARALLELISM_LIMITS[ModelProfile.BALANCED];
    expect(b.max_agents).toBe(20);
    expect(b.typical_range).toEqual([10, 20]);
  });

  it('budget profile allows 10 agents with range [5, 10]', () => {
    const b = PARALLELISM_LIMITS[ModelProfile.BUDGET];
    expect(b.max_agents).toBe(10);
    expect(b.typical_range).toEqual([5, 10]);
  });
});

// ── DEFAULT_CONFIG structure ──────────────────────────────────────────

describe('DEFAULT_CONFIG required sections', () => {
  it('has all required top-level sections', () => {
    expect(DEFAULT_CONFIG).toHaveProperty('version');
    expect(DEFAULT_CONFIG).toHaveProperty('execution');
    expect(DEFAULT_CONFIG).toHaveProperty('worktrees');
    expect(DEFAULT_CONFIG).toHaveProperty('automation');
    expect(DEFAULT_CONFIG).toHaveProperty('github');
    expect(DEFAULT_CONFIG).toHaveProperty('hooks');
    expect(DEFAULT_CONFIG).toHaveProperty('workflow');
    expect(DEFAULT_CONFIG).toHaveProperty('git');
  });

  it('execution section has required fields', () => {
    expect(DEFAULT_CONFIG.execution).toHaveProperty('model_profile');
    expect(DEFAULT_CONFIG.execution).toHaveProperty('competitive_enabled');
    expect(DEFAULT_CONFIG.execution).toHaveProperty('parallelism');
    expect(DEFAULT_CONFIG.execution).toHaveProperty('verification');
  });

  it('execution.parallelism has required fields', () => {
    expect(DEFAULT_CONFIG.execution.parallelism).toHaveProperty('max_agents_per_wave');
    expect(DEFAULT_CONFIG.execution.parallelism).toHaveProperty('max_retries');
    expect(DEFAULT_CONFIG.execution.parallelism).toHaveProperty('competition_strategy');
  });

  it('execution.verification has required fields', () => {
    expect(DEFAULT_CONFIG.execution.verification).toHaveProperty('strict_mode');
    expect(DEFAULT_CONFIG.execution.verification).toHaveProperty('gates');
    expect(DEFAULT_CONFIG.execution.verification).toHaveProperty('require_code_review');
    expect(DEFAULT_CONFIG.execution.verification).toHaveProperty('auto_resolve_conflicts');
  });

  it('execution.verification.gates includes all VerificationGate values', () => {
    const gates = DEFAULT_CONFIG.execution.verification.gates;
    const allGates = Object.values(VerificationGate);
    for (const gate of allGates) {
      expect(gates).toContain(gate);
    }
  });

  it('worktrees section has required fields', () => {
    expect(DEFAULT_CONFIG.worktrees).toHaveProperty('auto_cleanup');
    expect(DEFAULT_CONFIG.worktrees).toHaveProperty('branch_prefix');
    expect(DEFAULT_CONFIG.worktrees).toHaveProperty('path_template');
    expect(DEFAULT_CONFIG.worktrees).toHaveProperty('branch_template');
  });

  it('automation section has required fields', () => {
    expect(DEFAULT_CONFIG.automation).toHaveProperty('auto_commit_on_success');
    expect(DEFAULT_CONFIG.automation).toHaveProperty('conventional_commits');
    expect(DEFAULT_CONFIG.automation).toHaveProperty('co_author');
  });

  it('github section has required fields', () => {
    expect(DEFAULT_CONFIG.github).toHaveProperty('projectName');
    expect(DEFAULT_CONFIG.github).toHaveProperty('auto_push');
  });

  it('hooks section has required fields', () => {
    expect(DEFAULT_CONFIG.hooks).toHaveProperty('enabled');
  });

  it('workflow section has required fields', () => {
    expect(DEFAULT_CONFIG.workflow).toHaveProperty('research');
    expect(DEFAULT_CONFIG.workflow).toHaveProperty('plan_checker');
    expect(DEFAULT_CONFIG.workflow).toHaveProperty('verifier');
    expect(DEFAULT_CONFIG.workflow).toHaveProperty('auto_advance');
  });

  it('git section has required fields', () => {
    expect(DEFAULT_CONFIG.git).toHaveProperty('branching_strategy');
  });

  it('model_profile default is balanced', () => {
    expect(DEFAULT_CONFIG.execution.model_profile).toBe(ModelProfile.BALANCED);
  });

  it('competition_strategy default is standard', () => {
    expect(DEFAULT_CONFIG.execution.parallelism.competition_strategy).toBe(CompetitionStrategy.STANDARD);
  });

  it('version is a non-empty string', () => {
    expect(typeof DEFAULT_CONFIG.version).toBe('string');
    expect(DEFAULT_CONFIG.version.length).toBeGreaterThan(0);
  });
});

// ── Additional enum coverage ──────────────────────────────────────────

describe('TaskComplexity enum values', () => {
  it('defines all 3 complexity levels', () => {
    const values = Object.values(TaskComplexity);
    expect(values).toHaveLength(3);
    expect(values).toContain('simple');
    expect(values).toContain('medium');
    expect(values).toContain('complex');
  });
});

describe('Priority enum values', () => {
  it('defines all 4 priority levels', () => {
    const values = Object.values(Priority);
    expect(values).toHaveLength(4);
    expect(values).toContain('P0 Critical');
    expect(values).toContain('P1 High');
    expect(values).toContain('P2 Medium');
    expect(values).toContain('P3 Low');
  });
});

describe('VerificationGate enum values', () => {
  it('defines all 5 gates', () => {
    const values = Object.values(VerificationGate);
    expect(values).toHaveLength(5);
    expect(values).toContain('tests_pass');
    expect(values).toContain('build_succeeds');
    expect(values).toContain('lint_clean');
    expect(values).toContain('spec_compliance');
    expect(values).toContain('code_review');
  });
});

describe('VerificationResult enum values', () => {
  it('defines all 3 result states', () => {
    const values = Object.values(VerificationResult);
    expect(values).toHaveLength(3);
    expect(values).toContain('pass');
    expect(values).toContain('fail');
    expect(values).toContain('skipped');
  });
});
