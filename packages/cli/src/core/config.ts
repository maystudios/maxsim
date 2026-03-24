/**
 * Config loading and model resolution for MaxsimCLI.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type MaxsimConfig,
  type Model,
  type ModelProfile,
  type AgentType,
  DEFAULT_CONFIG,
  MODEL_PROFILES,
} from './types.js';

/** Returns the path to the MaxsimCLI config file. */
export function getConfigPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'maxsim', 'config.json');
}

/** Deep merge source into target (source wins on conflicts). */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

/** Load config from disk, merged with defaults. Returns defaults if no file exists. */
export function loadConfig(projectDir: string): MaxsimConfig {
  const configPath = getConfigPath(projectDir);

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.warn(`[maxsim] Invalid config at ${configPath}: expected an object. Using defaults.`);
      return { ...DEFAULT_CONFIG };
    }
    return deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      parsed as Record<string, unknown>,
    ) as unknown as MaxsimConfig;
  } catch (e) {
    console.warn('maxsim: failed to parse config:', (e as Error).message);
    return { ...DEFAULT_CONFIG };
  }
}

/** Write config to disk as formatted JSON. Creates directories if needed. */
export function saveConfig(projectDir: string, config: MaxsimConfig): void {
  const configPath = getConfigPath(projectDir);
  const configDir = path.dirname(configPath);

  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

/** Resolve the model for a given profile and agent type, with optional per-agent overrides. */
export function resolveModel(
  profile: ModelProfile,
  agentType: AgentType,
  overrides?: Partial<Record<AgentType, Model>>,
): Model {
  const override = overrides?.[agentType];
  if (override) return override;
  const assignment = MODEL_PROFILES[profile];
  return assignment[agentType as keyof typeof assignment];
}

