import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadConfig, saveConfig, resolveModel, resolveMaxAgents, getConfigPath } from '../../src/core/config.js';
import { AgentType, Model, ModelProfile, TaskComplexity, DEFAULT_CONFIG, PARALLELISM_LIMITS } from '../../src/core/types.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxsim-cli-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function getNestedValue(obj: unknown, key: string): unknown {
  let value = obj;
  for (const part of key.split('.')) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return value;
}

function setNestedValue(obj: Record<string, unknown>, key: string, rawVal: string): void {
  const parts = key.split('.');
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== 'object') {
      cursor[parts[i]] = {};
    }
    cursor = cursor[parts[i]] as Record<string, unknown>;
  }
  try {
    cursor[parts[parts.length - 1]] = JSON.parse(rawVal);
  } catch {
    cursor[parts[parts.length - 1]] = rawVal;
  }
}

describe('resolve-model command logic', () => {
  it('resolves model for balanced profile + executor agent', () => {
    expect(resolveModel(ModelProfile.BALANCED, AgentType.EXECUTOR)).toBe(Model.SONNET);
  });

  it('resolves model for balanced profile + planner agent', () => {
    expect(resolveModel(ModelProfile.BALANCED, AgentType.PLANNER)).toBe(Model.OPUS);
  });

  it('resolves model for quality profile + executor agent', () => {
    expect(resolveModel(ModelProfile.QUALITY, AgentType.EXECUTOR)).toBe(Model.OPUS);
  });

  it('resolves model for budget profile + researcher agent', () => {
    expect(resolveModel(ModelProfile.BUDGET, AgentType.RESEARCHER)).toBe(Model.HAIKU);
  });

  it('resolveModel returns lowercase model string', () => {
    const model = resolveModel(ModelProfile.BALANCED, AgentType.EXECUTOR);
    expect(model).toBe(model.toLowerCase());
  });

  it('accepts all AgentType values without throwing', () => {
    for (const agentType of Object.values(AgentType)) {
      expect(() => resolveModel(ModelProfile.BALANCED, agentType)).not.toThrow();
    }
  });
});

describe('config-get command logic', () => {
  beforeEach(() => {
    saveConfig(tmpDir, { ...DEFAULT_CONFIG });
  });

  it('retrieves a top-level scalar value by key path', () => {
    const config = loadConfig(tmpDir);
    const value = getNestedValue(config, 'version');
    expect(value).toBeDefined();
    expect(typeof value).toBe('string');
  });

  it('retrieves a nested value by dot-separated key path', () => {
    const config = loadConfig(tmpDir);
    expect(getNestedValue(config, 'execution.model_profile')).toBe(ModelProfile.BALANCED);
  });

  it('returns undefined for a non-existent key path', () => {
    const config = loadConfig(tmpDir);
    expect(getNestedValue(config, 'does.not.exist')).toBeUndefined();
  });

  it('retrieves an object value and formats it as JSON', () => {
    const config = loadConfig(tmpDir);
    const value = getNestedValue(config, 'execution');
    expect(typeof value).toBe('object');
    const output = JSON.stringify(value, null, 2);
    expect(output).toContain('model_profile');
  });
});

describe('config-set command logic', () => {
  beforeEach(() => {
    saveConfig(tmpDir, { ...DEFAULT_CONFIG });
  });

  it('sets a string value at a nested key path', () => {
    const config = loadConfig(tmpDir);
    setNestedValue(config as unknown as Record<string, unknown>, 'execution.model_profile', ModelProfile.QUALITY);
    saveConfig(tmpDir, config);
    expect(loadConfig(tmpDir).execution.model_profile).toBe(ModelProfile.QUALITY);
  });

  it('sets a boolean value parsed from JSON', () => {
    const config = loadConfig(tmpDir);
    setNestedValue(config as unknown as Record<string, unknown>, 'workflow.auto_advance', 'true');
    saveConfig(tmpDir, config);
    const updated = loadConfig(tmpDir) as unknown as Record<string, Record<string, unknown>>;
    expect(updated.workflow.auto_advance).toBe(true);
  });

  it('sets a numeric value parsed from JSON', () => {
    const config = loadConfig(tmpDir);
    setNestedValue(config as unknown as Record<string, unknown>, 'execution.parallelism.max_retries', '5');
    saveConfig(tmpDir, config);
    expect(loadConfig(tmpDir).execution.parallelism.max_retries).toBe(5);
  });

  it('creates intermediate objects for a new key path', () => {
    const config = loadConfig(tmpDir);
    setNestedValue(config as unknown as Record<string, unknown>, 'custom.section.key', 'hello');
    saveConfig(tmpDir, config);
    const raw = fs.readFileSync(getConfigPath(tmpDir), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, Record<string, Record<string, unknown>>>;
    expect(parsed.custom?.section?.key).toBe('hello');
  });
});

describe('config-ensure-section command logic', () => {
  beforeEach(() => {
    saveConfig(tmpDir, { ...DEFAULT_CONFIG });
  });

  it('creates a new section if it does not exist', () => {
    const config = loadConfig(tmpDir);
    const section = 'my_new_section';
    setNestedValue(config as unknown as Record<string, unknown>, section, '{}');
    saveConfig(tmpDir, config);
    const raw = fs.readFileSync(getConfigPath(tmpDir), 'utf8');
    expect(JSON.parse(raw)).toHaveProperty(section);
    expect((JSON.parse(raw) as Record<string, unknown>)[section]).toEqual({});
  });

  it('does not overwrite an existing section when already present', () => {
    const before = loadConfig(tmpDir).execution;
    const config = loadConfig(tmpDir);
    const obj = config as unknown as Record<string, unknown>;
    if (!obj.execution) {
      obj.execution = {};
      saveConfig(tmpDir, config);
    }
    expect(loadConfig(tmpDir).execution).toEqual(before);
  });

  it('saves new section to disk', () => {
    const config = loadConfig(tmpDir);
    setNestedValue(config as unknown as Record<string, unknown>, 'fresh_section', '{}');
    saveConfig(tmpDir, config);
    const raw = fs.readFileSync(getConfigPath(tmpDir), 'utf8');
    expect(JSON.parse(raw)).toHaveProperty('fresh_section');
  });
});

describe('resolve-max-agents command logic', () => {
  it('returns max agents for a large project when --file-count is provided', () => {
    expect(resolveMaxAgents(ModelProfile.BALANCED, 50)).toBe(PARALLELISM_LIMITS[ModelProfile.BALANCED].max_agents);
  });

  it('defaults to file count 0 when --file-count flag is absent (small project cap applies)', () => {
    expect(resolveMaxAgents(ModelProfile.BALANCED, 0)).toBe(Math.min(5, PARALLELISM_LIMITS[ModelProfile.BALANCED].max_agents));
  });

  it('invalid complexity value is not a member of TaskComplexity', () => {
    expect(Object.values(TaskComplexity).includes('bogus' as TaskComplexity)).toBe(false);
  });

  it('all TaskComplexity values are accepted by resolveMaxAgents without throwing', () => {
    for (const complexity of Object.values(TaskComplexity)) {
      expect(() => resolveMaxAgents(ModelProfile.BALANCED, 50, complexity)).not.toThrow();
    }
  });
});
