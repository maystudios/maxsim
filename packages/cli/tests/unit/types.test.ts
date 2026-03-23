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
  VerificationGate,
  VerificationResult,
  TaskState,
  WaveState,
  CompetitionStrategy,
  MODEL_PROFILES,
} from '../../src/core/types.js';
import { VERSION } from '../../src/core/version.js';

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
