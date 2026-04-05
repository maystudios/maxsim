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
  type TaskType,
  TaskComplexity,
  DEFAULT_CONFIG,
  MODEL_PROFILES,
  PARALLELISM_LIMITS,
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

/**
 * Resolve the profile's total agent cap, applying the small-project scaling
 * rule from PROJECT.md §7.4.
 *
 * This returns the *profile-level ceiling* — the maximum number of agents that
 * may be active across **all** waves combined for the given profile and project
 * size.  It does NOT consider the per-wave limit (`max_agents_per_wave`); use
 * {@link resolveEffectiveWaveSize} for that.
 */
export function resolveMaxAgents(
  profile: ModelProfile,
  projectFileCount: number,
  complexity: TaskComplexity = TaskComplexity.MEDIUM,
): number {
  const limits = PARALLELISM_LIMITS[profile];
  let cap: number;
  if (projectFileCount < 10) cap = Math.min(5, limits.max_agents);
  else if (projectFileCount < 25) cap = Math.min(Math.floor(limits.max_agents / 2), limits.typical_range[1]);
  else cap = limits.max_agents;

  if (complexity === TaskComplexity.SIMPLE) return Math.max(1, Math.floor(cap / 2));
  return cap;
}

/**
 * Resolve the effective number of agents that may run in a single wave.
 *
 * Two constraints are combined:
 *
 *  1. **Per-wave cap** (`max_agents_per_wave` from config) — limits how many
 *     agents are spawned in each individual wave.
 *  2. **Profile total cap** — the ceiling returned by {@link resolveMaxAgents},
 *     derived from `PARALLELISM_LIMITS[profile].max_agents` and scaled by
 *     project size and task complexity.
 *
 * The effective wave size is:
 *   `min(max_agents_per_wave, profileTotalCap)`
 *
 * This guarantees that a user-configured per-wave limit is honoured while
 * ensuring it never exceeds the profile's total agent ceiling.
 */
export function resolveEffectiveWaveSize(
  profile: ModelProfile,
  maxAgentsPerWave: number,
  projectFileCount: number,
  complexity: TaskComplexity = TaskComplexity.MEDIUM,
): number {
  const profileCap = resolveMaxAgents(profile, projectFileCount, complexity);
  return Math.max(1, Math.min(maxAgentsPerWave, profileCap));
}

/** Resolve the model for a given profile and agent type, with optional per-agent and per-task-type overrides. */
export function resolveModel(
  profile: ModelProfile,
  agentType: AgentType,
  overrides?: Partial<Record<AgentType, Model>>,
  taskType?: TaskType,
  taskTypeOverrides?: Partial<Record<TaskType, Model>>,
): Model {
  // Task-type override takes highest priority
  if (taskType && taskTypeOverrides?.[taskType]) {
    return taskTypeOverrides[taskType]!;
  }
  // Then agent-type override
  const override = overrides?.[agentType];
  if (override) return override;
  // Then profile default
  const assignment = MODEL_PROFILES[profile];
  return assignment[agentType as keyof typeof assignment];
}

