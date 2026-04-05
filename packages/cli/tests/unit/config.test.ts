import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadConfig,
  saveConfig,
  resolveModel,
  resolveMaxAgents,
  resolveEffectiveWaveSize,
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

  it('ignores __doc keys and loads config with documentation fields', () => {
    const configDir = path.join(tmpDir, '.claude', 'maxsim');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({
        __doc_model_profiles: { _description: 'Reference table' },
        execution: {
          __doc_model_profile: 'Documentation string',
          model_profile: 'quality',
          model_overrides: { executor: 'opus' },
          parallelism: {
            __doc_parallelism: ['Documentation array'],
            max_agents_per_wave: 5,
          },
        },
      }),
    );

    const config = loadConfig(tmpDir);
    expect(config.execution.model_profile).toBe('quality');
    expect(config.execution.model_overrides).toEqual({ executor: 'opus' });
    expect(config.execution.parallelism.max_agents_per_wave).toBe(5);
    // Defaults still applied for unset fields
    expect(config.execution.parallelism.max_retries).toBe(3);
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

describe('resolveModel priority chain', () => {
  it('agent-type override takes priority over profile default', () => {
    // Budget profile maps executor -> sonnet, but override says opus
    const overrides = { [AgentType.EXECUTOR]: Model.OPUS };
    expect(resolveModel(ModelProfile.BUDGET, AgentType.EXECUTOR, overrides)).toBe(Model.OPUS);
  });

  it('profile default used when no overrides provided', () => {
    expect(resolveModel(ModelProfile.QUALITY, AgentType.RESEARCHER)).toBe(Model.SONNET);
    expect(resolveModel(ModelProfile.BUDGET, AgentType.PLANNER)).toBe(Model.SONNET);
    expect(resolveModel(ModelProfile.BALANCED, AgentType.VERIFIER)).toBe(Model.SONNET);
  });

  it('agent type with no matching override falls through to profile', () => {
    // Override only executor, verify researcher still uses profile default
    const overrides = { [AgentType.EXECUTOR]: Model.OPUS };
    expect(resolveModel(ModelProfile.BUDGET, AgentType.RESEARCHER, overrides)).toBe(Model.HAIKU);
  });

  it('multiple overrides each resolve independently', () => {
    const overrides = {
      [AgentType.EXECUTOR]: Model.OPUS,
      [AgentType.RESEARCHER]: Model.HAIKU,
    };
    expect(resolveModel(ModelProfile.BALANCED, AgentType.EXECUTOR, overrides)).toBe(Model.OPUS);
    expect(resolveModel(ModelProfile.BALANCED, AgentType.RESEARCHER, overrides)).toBe(Model.HAIKU);
    // Planner not in overrides, falls to profile
    expect(resolveModel(ModelProfile.BALANCED, AgentType.PLANNER, overrides)).toBe(Model.OPUS);
  });

  it('backward compatible: callers without overrides param still work', () => {
    // Calling with only 2 required params (no overrides)
    expect(resolveModel(ModelProfile.BALANCED, AgentType.EXECUTOR)).toBe(Model.SONNET);
    expect(resolveModel(ModelProfile.QUALITY, AgentType.PLANNER)).toBe(Model.OPUS);
    expect(resolveModel(ModelProfile.BUDGET, AgentType.VERIFIER)).toBe(Model.SONNET);
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

describe('resolveEffectiveWaveSize', () => {
  it('returns max_agents_per_wave when it is below the profile cap', () => {
    // balanced profile, large project => profile cap = 20
    // max_agents_per_wave = 3 => effective = 3
    expect(resolveEffectiveWaveSize(ModelProfile.BALANCED, 3, 50)).toBe(3);
  });

  it('clamps to profile cap when max_agents_per_wave exceeds it', () => {
    // balanced profile, large project => profile cap = 20
    // max_agents_per_wave = 25 => clamped to 20
    expect(resolveEffectiveWaveSize(ModelProfile.BALANCED, 25, 50)).toBe(20);
  });

  it('clamps to profile cap for budget profile', () => {
    // budget profile, large project => profile cap = 10
    // max_agents_per_wave = 15 => clamped to 10
    expect(resolveEffectiveWaveSize(ModelProfile.BUDGET, 15, 50)).toBe(10);
  });

  it('respects small project scaling when clamping', () => {
    // balanced profile, small project (<10 files) => profile cap = 5
    // max_agents_per_wave = 8 => clamped to 5
    expect(resolveEffectiveWaveSize(ModelProfile.BALANCED, 8, 5)).toBe(5);
  });

  it('respects complexity=simple scaling', () => {
    // balanced profile, large project, simple => profile cap = floor(20/2) = 10
    // max_agents_per_wave = 15 => clamped to 10
    expect(resolveEffectiveWaveSize(ModelProfile.BALANCED, 15, 50, TaskComplexity.SIMPLE)).toBe(10);
  });

  it('returns at least 1 even with extreme constraints', () => {
    // budget profile, small project, simple => profile cap = max(1, floor(5/2)) = 2
    // max_agents_per_wave = 1 => min(1, 2) = 1
    expect(resolveEffectiveWaveSize(ModelProfile.BUDGET, 1, 3, TaskComplexity.SIMPLE)).toBeGreaterThanOrEqual(1);
  });

  it('returns max_agents_per_wave when equal to profile cap', () => {
    // quality profile, large project => profile cap = 40
    // max_agents_per_wave = 40 => effective = 40
    expect(resolveEffectiveWaveSize(ModelProfile.QUALITY, 40, 100)).toBe(40);
  });

  it('defaults complexity to medium when not specified', () => {
    const withDefault = resolveEffectiveWaveSize(ModelProfile.BALANCED, 5, 50);
    const withMedium = resolveEffectiveWaveSize(ModelProfile.BALANCED, 5, 50, TaskComplexity.MEDIUM);
    expect(withDefault).toBe(withMedium);
  });

  it('medium project with per-wave cap below scaled profile cap', () => {
    // balanced profile, medium project (10-24 files) => cap = min(floor(20/2), 20) = 10
    // max_agents_per_wave = 5 => effective = 5
    expect(resolveEffectiveWaveSize(ModelProfile.BALANCED, 5, 15)).toBe(5);
  });

  it('medium project with per-wave cap above scaled profile cap', () => {
    // balanced profile, medium project (10-24 files) => cap = min(floor(20/2), 20) = 10
    // max_agents_per_wave = 12 => clamped to 10
    expect(resolveEffectiveWaveSize(ModelProfile.BALANCED, 12, 15)).toBe(10);
  });
});
