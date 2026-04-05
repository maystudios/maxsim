import { describe, it, expect } from 'vitest';
import {
  cmdOk,
  cmdErr,
  type CmdResult,
  ProjectStatus,
  Priority,
  AgentType,
  Model,
  ModelProfile,
  TaskComplexity,
  VerificationGate,
  VerificationResult,
  TaskState,
  WaveState,
  CompetitionStrategy,
  MODEL_PROFILES,
  PARALLELISM_LIMITS,
  DEFAULT_CONFIG,
} from '../../src/core/types.js';
import { VERSION, parseVersion, isVersionAtLeast, getVersion } from '../../src/core/version.js';

describe('CmdResult', () => {
  it('cmdOk creates a successful result with data', () => {
    const result = cmdOk({ count: 42 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toEqual({ count: 42 });
    }
  });

  it('cmdOk supports rawValue for --raw output', () => {
    const result = cmdOk('formatted', 'raw-json');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rawValue).toBe('raw-json');
    }
  });

  it('cmdErr creates a failed result', () => {
    const result = cmdErr('not found');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not found');
    }
  });

  it('CmdResult discriminates via ok field', () => {
    const ok: CmdResult = cmdOk('yes');
    const err: CmdResult = cmdErr('no');
    expect(ok.ok).toBe(true);
    expect(err.ok).toBe(false);
  });
});

describe('Enums', () => {
  it('ProjectStatus has 5 Kanban columns', () => {
    expect(Object.values(ProjectStatus)).toHaveLength(5);
    expect(ProjectStatus.BACKLOG).toBe('Backlog');
    expect(ProjectStatus.TO_DO).toBe('To Do');
    expect(ProjectStatus.IN_PROGRESS).toBe('In Progress');
    expect(ProjectStatus.IN_REVIEW).toBe('In Review');
    expect(ProjectStatus.DONE).toBe('Done');
  });

  it('Priority has 4 levels', () => {
    expect(Object.values(Priority)).toHaveLength(4);
    expect(Priority.P0_CRITICAL).toBeDefined();
    expect(Priority.P3_LOW).toBeDefined();
  });

  it('AgentType has 4 agent types', () => {
    expect(Object.values(AgentType)).toHaveLength(4);
    expect(AgentType.EXECUTOR).toBe('executor');
    expect(AgentType.PLANNER).toBe('planner');
    expect(AgentType.RESEARCHER).toBe('researcher');
    expect(AgentType.VERIFIER).toBe('verifier');
  });

  it('Model has 3 tiers', () => {
    expect(Object.values(Model)).toHaveLength(3);
    expect(Model.HAIKU).toBe('haiku');
    expect(Model.SONNET).toBe('sonnet');
    expect(Model.OPUS).toBe('opus');
  });

  it('ModelProfile has 3 profiles', () => {
    expect(Object.values(ModelProfile)).toHaveLength(3);
    expect(ModelProfile.BALANCED).toBe('balanced');
  });

  it('VerificationGate has 5 gates', () => {
    expect(Object.values(VerificationGate)).toHaveLength(5);
  });

  it('VerificationResult has 3 states', () => {
    expect(Object.values(VerificationResult)).toHaveLength(3);
    expect(VerificationResult.PASS).toBe('pass');
    expect(VerificationResult.FAIL).toBe('fail');
    expect(VerificationResult.SKIPPED).toBe('skipped');
  });

  it('TaskState has 5 states', () => {
    expect(Object.values(TaskState)).toHaveLength(5);
  });

  it('WaveState has 4 states', () => {
    expect(Object.values(WaveState)).toHaveLength(4);
  });

  it('CompetitionStrategy has 4 options', () => {
    expect(Object.values(CompetitionStrategy)).toHaveLength(4);
    expect(CompetitionStrategy.STANDARD).toBe('standard');
  });
});

describe('MODEL_PROFILES', () => {
  it('has 3 profiles', () => {
    expect(Object.keys(MODEL_PROFILES)).toHaveLength(3);
  });

  it('balanced profile uses opus for planner, sonnet for rest', () => {
    const balanced = MODEL_PROFILES[ModelProfile.BALANCED];
    expect(balanced.planner).toBe(Model.OPUS);
    expect(balanced.executor).toBe(Model.SONNET);
    expect(balanced.researcher).toBe(Model.SONNET);
    expect(balanced.verifier).toBe(Model.SONNET);
  });

  it('quality profile uses opus for planner+executor+verifier', () => {
    const quality = MODEL_PROFILES[ModelProfile.QUALITY];
    expect(quality.planner).toBe(Model.OPUS);
    expect(quality.executor).toBe(Model.OPUS);
    expect(quality.verifier).toBe(Model.OPUS);
  });

  it('budget profile uses sonnet for planner, haiku for researcher', () => {
    const budget = MODEL_PROFILES[ModelProfile.BUDGET];
    expect(budget.planner).toBe(Model.SONNET);
    expect(budget.researcher).toBe(Model.HAIKU);
  });
});

describe('VERSION', () => {
  it('is a non-empty string', () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);
  });
});

describe('parseVersion', () => {
  it('parses a valid semver string', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parses semver with pre-release suffix', () => {
    expect(parseVersion('2.0.1-beta.1')).toEqual({ major: 2, minor: 0, patch: 1 });
  });

  it('returns null for invalid strings', () => {
    expect(parseVersion('invalid')).toBeNull();
    expect(parseVersion('')).toBeNull();
  });
});

describe('getVersion', () => {
  it('returns a non-empty string matching VERSION', () => {
    const v = getVersion();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
    expect(v).toBe(VERSION);
  });
});

describe('isVersionAtLeast', () => {
  it('returns true when current version meets the minimum', () => {
    // Current VERSION should be at least 1.0.0
    expect(isVersionAtLeast('1.0.0')).toBe(true);
  });

  it('returns true when current version equals the minimum', () => {
    expect(isVersionAtLeast(VERSION)).toBe(true);
  });

  it('returns false when minimum is higher than current', () => {
    expect(isVersionAtLeast('999.0.0')).toBe(false);
  });

  it('returns false for invalid version strings', () => {
    expect(isVersionAtLeast('invalid')).toBe(false);
  });
});

describe('PARALLELISM_LIMITS', () => {
  it('has entries for all 3 profiles', () => {
    expect(Object.keys(PARALLELISM_LIMITS)).toHaveLength(3);
    expect(PARALLELISM_LIMITS[ModelProfile.QUALITY]).toBeDefined();
    expect(PARALLELISM_LIMITS[ModelProfile.BALANCED]).toBeDefined();
    expect(PARALLELISM_LIMITS[ModelProfile.BUDGET]).toBeDefined();
  });

  it('quality profile allows up to 40 agents with range [20, 40]', () => {
    const q = PARALLELISM_LIMITS[ModelProfile.QUALITY];
    expect(q.max_agents).toBe(40);
    expect(q.typical_range).toEqual([20, 40]);
  });

  it('balanced profile allows up to 20 agents with range [10, 20]', () => {
    const b = PARALLELISM_LIMITS[ModelProfile.BALANCED];
    expect(b.max_agents).toBe(20);
    expect(b.typical_range).toEqual([10, 20]);
  });

  it('budget profile allows up to 10 agents with range [5, 10]', () => {
    const b = PARALLELISM_LIMITS[ModelProfile.BUDGET];
    expect(b.max_agents).toBe(10);
    expect(b.typical_range).toEqual([5, 10]);
  });
});

describe('DEFAULT_CONFIG', () => {
  it('version matches VERSION constant', () => {
    expect(DEFAULT_CONFIG.version).toBe(VERSION);
  });

  it('includes workflow section with correct defaults', () => {
    expect(DEFAULT_CONFIG.workflow).toBeDefined();
    expect(DEFAULT_CONFIG.workflow.research).toBe(true);
    expect(DEFAULT_CONFIG.workflow.plan_checker).toBe(true);
    expect(DEFAULT_CONFIG.workflow.verifier).toBe(true);
    expect(DEFAULT_CONFIG.workflow.auto_advance).toBe(false);
  });

  it('includes git section with branching_strategy phase', () => {
    expect(DEFAULT_CONFIG.git).toBeDefined();
    expect(DEFAULT_CONFIG.git.branching_strategy).toBe('phase');
  });

  it('includes competitive_enabled default as false', () => {
    expect(DEFAULT_CONFIG.execution.competitive_enabled).toBe(false);
  });

  it('includes worktree path and branch templates', () => {
    expect(DEFAULT_CONFIG.worktrees.path_template).toBe('.claude/worktrees/agent-{id}/');
    expect(DEFAULT_CONFIG.worktrees.branch_template).toBe('maxsim/phase-{N}-task-{id}');
  });

  it('includes all verification gates in default config', () => {
    const gates = DEFAULT_CONFIG.execution.verification.gates;
    expect(gates).toContain(VerificationGate.TESTS_PASS);
    expect(gates).toContain(VerificationGate.BUILD_SUCCEEDS);
    expect(gates).toContain(VerificationGate.LINT_CLEAN);
    expect(gates).toContain(VerificationGate.SPEC_COMPLIANCE);
    expect(gates).toContain(VerificationGate.CODE_REVIEW);
    expect(gates).toHaveLength(5);
  });

  it('includes automation section with conventional commit defaults', () => {
    expect(DEFAULT_CONFIG.automation.auto_commit_on_success).toBe(true);
    expect(DEFAULT_CONFIG.automation.conventional_commits).toBe(true);
    expect(DEFAULT_CONFIG.automation.co_author).toContain('Co-Authored-By:');
  });
});

describe('TaskComplexity', () => {
  it('has all 3 complexity levels', () => {
    expect(Object.values(TaskComplexity)).toHaveLength(3);
    expect(TaskComplexity.SIMPLE).toBe('simple');
    expect(TaskComplexity.MEDIUM).toBe('medium');
    expect(TaskComplexity.COMPLEX).toBe('complex');
  });
});
