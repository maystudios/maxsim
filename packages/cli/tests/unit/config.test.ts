import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  loadConfig,
  saveConfig,
  resolveModel,
  getConfigPath,
} from '../../src/core/config.js';
import { Model, ModelProfile, AgentType, DEFAULT_CONFIG } from '../../src/core/types.js';

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
    expect(config.execution.modelProfile).toBe(ModelProfile.BALANCED);
    expect(config.execution.parallelism.maxRetries).toBe(3);
    expect(config.execution.verification.strictMode).toBe(true);
  });

  it('merges partial config with defaults', () => {
    const configDir = path.join(tmpDir, '.claude', 'maxsim');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({
        execution: { modelProfile: 'quality' },
      }),
    );

    const config = loadConfig(tmpDir);
    expect(config.execution.modelProfile).toBe('quality');
    // Defaults still applied for unset fields
    expect(config.execution.parallelism.maxRetries).toBe(3);
  });

  it('returns defaults for invalid JSON', () => {
    const configDir = path.join(tmpDir, '.claude', 'maxsim');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), 'not json{{{');

    const config = loadConfig(tmpDir);
    expect(config.execution.modelProfile).toBe(ModelProfile.BALANCED);
  });
});

describe('saveConfig', () => {
  it('writes config to disk as JSON', () => {
    const config = { ...DEFAULT_CONFIG };
    config.execution.modelProfile = ModelProfile.QUALITY;

    saveConfig(tmpDir, config);

    const configPath = getConfigPath(tmpDir);
    expect(fs.existsSync(configPath)).toBe(true);

    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.execution.modelProfile).toBe('quality');
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
});
