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
  DEFAULT_CONFIG,
} from './types.js';

// Config
export { loadConfig, saveConfig, resolveModel, getConfigPath } from './config.js';

// Utils
export { parseFrontmatter, padPhaseNumber, detectProjectRoot } from './utils.js';

// Version
export { VERSION } from './version.js';
