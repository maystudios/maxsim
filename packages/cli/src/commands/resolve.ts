/**
 * Resolve command handlers: resolve-model, resolve-max-agents, resolve-wave-size.
 * Extracted from cli.ts to enable modular async dispatch.
 */

import {
  loadConfig,
  resolveModel,
  resolveMaxAgents,
  resolveEffectiveWaveSize,
  AgentType,
  TaskComplexity,
  cmdOk,
  cmdErr,
} from '../core/index.js';
import type { ModelProfile } from '../core/index.js';
import {
  getPositionalArg,
  getFlag,
  hasFlag,
  getIntFlag,
  type CommandRegistry,
} from './types.js';

export const RESOLVE_COMMANDS: CommandRegistry = {
  'resolve-model': {
    name: 'resolve-model',
    description: 'Resolve Claude model for a given agent type using the configured model profile.',
    async handler(args) {
      const agentType = getPositionalArg(args, 0)?.toLowerCase() as AgentType | undefined;
      if (!agentType || !Object.values(AgentType).includes(agentType)) {
        return cmdErr(`Invalid agent type: ${args[0]}`);
      }
      const projectDir = process.cwd();
      const config = loadConfig(projectDir);
      const model = resolveModel(
        config.execution.model_profile as ModelProfile,
        agentType,
        config.execution.model_overrides,
      );
      const displayValue = model;
      const rawValue = model.toLowerCase();
      if (hasFlag(args, '--raw')) {
        process.stdout.write(rawValue);
        return cmdOk(null, rawValue);
      }
      return cmdOk(displayValue, rawValue);
    },
  },

  'resolve-max-agents': {
    name: 'resolve-max-agents',
    description: 'Get the maximum number of parallel agents for a given model profile.',
    async handler(args) {
      const projectDir = process.cwd();
      const config = loadConfig(projectDir);
      const profile = (getPositionalArg(args, 0) as ModelProfile) || config.execution.model_profile as ModelProfile;

      const fileCount = getIntFlag(args, '--file-count') ?? 0;
      if (args.includes('--file-count') && (Number.isNaN(fileCount) || fileCount < 0)) {
        return cmdErr('--file-count must be a non-negative integer');
      }

      const complexityRaw = getFlag(args, '--complexity') ?? TaskComplexity.MEDIUM;
      if (!Object.values(TaskComplexity).includes(complexityRaw as TaskComplexity)) {
        return cmdErr(`Invalid complexity: ${complexityRaw}. Must be: simple, medium, complex`);
      }

      const result = resolveMaxAgents(profile, fileCount, complexityRaw as TaskComplexity);
      const rawValue = String(result);
      if (hasFlag(args, '--raw')) {
        process.stdout.write(rawValue);
        return cmdOk(null, rawValue);
      }
      return cmdOk(result, rawValue);
    },
  },

  'resolve-wave-size': {
    name: 'resolve-wave-size',
    description: 'Get the effective wave size considering max_agents_per_wave and task complexity.',
    async handler(args) {
      const projectDir = process.cwd();
      const config = loadConfig(projectDir);
      const profile = (getPositionalArg(args, 0) as ModelProfile) || config.execution.model_profile as ModelProfile;

      const fileCount = getIntFlag(args, '--file-count') ?? 0;
      if (args.includes('--file-count') && (Number.isNaN(fileCount) || fileCount < 0)) {
        return cmdErr('--file-count must be a non-negative integer');
      }

      const complexityRaw = getFlag(args, '--complexity') ?? TaskComplexity.MEDIUM;
      if (!Object.values(TaskComplexity).includes(complexityRaw as TaskComplexity)) {
        return cmdErr(`Invalid complexity: ${complexityRaw}. Must be: simple, medium, complex`);
      }

      const waveSize = resolveEffectiveWaveSize(
        profile,
        config.execution.parallelism.max_agents_per_wave,
        fileCount,
        complexityRaw as TaskComplexity,
      );
      const rawValue = String(waveSize);
      if (hasFlag(args, '--raw')) {
        process.stdout.write(rawValue);
        return cmdOk(null, rawValue);
      }
      return cmdOk(waveSize, rawValue);
    },
  },
};
