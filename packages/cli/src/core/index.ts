// Types & result helpers
export type { CmdResult, MaxsimConfig, ModelAssignment } from './types.js';
export { cmdOk, cmdErr } from './types.js';

// Enums (value + type exports)
export {
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
  PARALLELISM_LIMITS,
  DEFAULT_CONFIG,
} from './types.js';

// Config
export { loadConfig, saveConfig, resolveModel, resolveMaxAgents, getConfigPath } from './config.js';

// Version
export { VERSION, parseVersion, isVersionAtLeast, getVersion } from './version.js';

// Utils
export { claudeDir, maxsimDir, agentMemoryDir, configPath, parseFrontmatter } from './utils.js';
export type { FrontmatterResult } from './utils.js';
