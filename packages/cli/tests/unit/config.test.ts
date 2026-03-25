import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadConfig,
  saveConfig,
  resolveModel,
  resolveMaxAgents,
  getConfigPath,
} from '../../src/core/config.js';
import { Model, ModelProfile, AgentType, TaskComplexity, DEFAULT_CONFIG, PARALLELISM_LIMITS } from '../../src/core/types.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxsim-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('getConfigPath', () => {
  it('returns path under .claude/maxsim/config.json', () => {
    const p = getConfigPath('/some/project');
    expect(p).toBe(path.join('/some/project', '.claude', 'maxsim', 'config.json'));
  });
});

describe('loadConfig', () => {
  it('returns defaults when no config file exists', () => {
    const config = loadConfig(tmpDir);
    expect(config.execution.model_profile).toBe(ModelProfile.BALANCED);
    expect(config.execution.parallelism.max_retries).toBe(3);
    expect(config.execution.verification.strict_mode).toBe(true);
  });

  it('merges partial config with defaults', () => {
    const configDir = path.join(tmpDir, '.claude', 'maxsim');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({
        execution: { model_profile: 'quality' },
      }),
    );

    const config = loadConfig(tmpDir);
    expect(config.execution.model_profile).toBe('quality');
    // Defaults still applied for unset fields
    expect(config.execution.parallelism.max_retries).toBe(3);
  });

  it('returns defaults for invalid JSON', () => {
    const configDir = path.join(tmpDir, '.claude', 'maxsim');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), 'not json{{{');

    const config = loadConfig(tmpDir);
    expect(config.execution.model_profile).toBe(ModelProfile.BALANCED);
  });
});

describe('saveConfig', () => {
  it('writes config to disk as JSON', () => {
    const config = { ...DEFAULT_CONFIG };
    config.execution.model_profile = ModelProfile.QUALITY;

    saveConfig(tmpDir, config);

    const configPath = getConfigPath(tmpDir);
    expect(fs.existsSync(configPath)).toBe(true);

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.execution.model_profile).toBe('quality');
  });

  it('creates directories if they do not exist', () => {
    saveConfig(tmpDir, DEFAULT_CONFIG);
    expect(fs.existsSync(getConfigPath(tmpDir))).toBe(true);
  });
});

describe('resolveModel', () => {
  it('returns correct model for balanced profile', () => {
    expect(resolveModel(ModelProfile.BALANCED, AgentType.PLANNER)).toBe(Model.OPUS);
    expect(resolveModel(ModelProfile.BALANCED, AgentType.EXECUTOR)).toBe(Model.SONNET);
    expect(resolveModel(ModelProfile.BALANCED, AgentType.RESEARCHER)).toBe(Model.SONNET);
    expect(resolveModel(ModelProfile.BALANCED, AgentType.VERIFIER)).toBe(Model.SONNET);
  });

  it('returns correct model for quality profile', () => {
    expect(resolveModel(ModelProfile.QUALITY, AgentType.EXECUTOR)).toBe(Model.OPUS);
  });

  it('returns correct model for budget profile', () => {
    expect(resolveModel(ModelProfile.BUDGET, AgentType.RESEARCHER)).toBe(Model.HAIKU);
  });

  it('override takes precedence over profile', () => {
    const overrides = { [AgentType.EXECUTOR]: Model.OPUS };
    expect(resolveModel(ModelProfile.BALANCED, AgentType.EXECUTOR, overrides)).toBe(Model.OPUS);
  });

  it('falls back to profile when agent not in overrides', () => {
    const overrides = { [AgentType.EXECUTOR]: Model.OPUS };
    expect(resolveModel(ModelProfile.BALANCED, AgentType.PLANNER, overrides)).toBe(Model.OPUS);
    expect(resolveModel(ModelProfile.BALANCED, AgentType.RESEARCHER, overrides)).toBe(Model.SONNET);
  });

  it('empty overrides object falls back to profile', () => {
    expect(resolveModel(ModelProfile.BALANCED, AgentType.EXECUTOR, {})).toBe(Model.SONNET);
  });
});

describe('resolveMaxAgents', () => {
  it('small project (<10 files) caps at 5 for quality profile', () => {
    expect(resolveMaxAgents(ModelProfile.QUALITY, 5)).toBe(5);
  });

  it('small project (<10 files) caps at 5 for balanced profile', () => {
    expect(resolveMaxAgents(ModelProfile.BALANCED, 0)).toBe(5);
  });

  it('small project (<10 files) caps at 5 for budget profile', () => {
    expect(resolveMaxAgents(ModelProfile.BUDGET, 9)).toBe(5);
  });

  it('medium project (<25 files) caps at half of profile max for quality profile', () => {
    const limits = PARALLELISM_LIMITS[ModelProfile.QUALITY];
    const expected = Math.min(Math.floor(limits.max_agents / 2), limits.typical_range[1]);
    expect(resolveMaxAgents(ModelProfile.QUALITY, 10)).toBe(expected);
  });

  it('medium project (<25 files) caps at half of profile max for balanced profile', () => {
    const limits = PARALLELISM_LIMITS[ModelProfile.BALANCED];
    const expected = Math.min(Math.floor(limits.max_agents / 2), limits.typical_range[1]);
    expect(resolveMaxAgents(ModelProfile.BALANCED, 24)).toBe(expected);
  });

  it('medium project (<25 files) caps at half of profile max for budget profile', () => {
    const limits = PARALLELISM_LIMITS[ModelProfile.BUDGET];
    const expected = Math.min(Math.floor(limits.max_agents / 2), limits.typical_range[1]);
    expect(resolveMaxAgents(ModelProfile.BUDGET, 15)).toBe(expected);
  });

  it('large project (>=25 files) uses full profile max for quality profile', () => {
    expect(resolveMaxAgents(ModelProfile.QUALITY, 25)).toBe(PARALLELISM_LIMITS[ModelProfile.QUALITY].max_agents);
  });

  it('large project (>=25 files) uses full profile max for balanced profile', () => {
    expect(resolveMaxAgents(ModelProfile.BALANCED, 100)).toBe(PARALLELISM_LIMITS[ModelProfile.BALANCED].max_agents);
  });

  it('large project (>=25 files) uses full profile max for budget profile', () => {
    expect(resolveMaxAgents(ModelProfile.BUDGET, 50)).toBe(PARALLELISM_LIMITS[ModelProfile.BUDGET].max_agents);
  });

  it('backward compatibility: calling without complexity parameter defaults to medium', () => {
    const withDefault = resolveMaxAgents(ModelProfile.BALANCED, 50);
    const withMedium = resolveMaxAgents(ModelProfile.BALANCED, 50, TaskComplexity.MEDIUM);
    expect(withDefault).toBe(withMedium);
  });

  it('complexity=simple halves the cap (rounded down, min 1)', () => {
    const limits = PARALLELISM_LIMITS[ModelProfile.BALANCED];
    const cap = limits.max_agents;
    const expected = Math.max(1, Math.floor(cap / 2));
    expect(resolveMaxAgents(ModelProfile.BALANCED, 50, TaskComplexity.SIMPLE)).toBe(expected);
  });

  it('complexity=complex uses the full cap', () => {
    const limits = PARALLELISM_LIMITS[ModelProfile.BALANCED];
    expect(resolveMaxAgents(ModelProfile.BALANCED, 50, TaskComplexity.COMPLEX)).toBe(limits.max_agents);
  });

  it('complexity=medium uses the same result as no complexity argument', () => {
    expect(resolveMaxAgents(ModelProfile.QUALITY, 30, TaskComplexity.MEDIUM)).toBe(
      resolveMaxAgents(ModelProfile.QUALITY, 30),
    );
  });

  it('complexity=simple with small project caps at minimum 1', () => {
    expect(resolveMaxAgents(ModelProfile.BALANCED, 5, TaskComplexity.SIMPLE)).toBe(2);
  });

  it('complexity=simple with budget profile large project halves max_agents', () => {
    const limits = PARALLELISM_LIMITS[ModelProfile.BUDGET];
    const expected = Math.max(1, Math.floor(limits.max_agents / 2));
    expect(resolveMaxAgents(ModelProfile.BUDGET, 50, TaskComplexity.SIMPLE)).toBe(expected);
  });
});
