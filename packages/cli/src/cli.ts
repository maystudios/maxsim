/**
 * MAXSIM Tools — CLI dispatcher.
 * Usage: node cli.cjs <command> [args]
 */

import { loadConfig, saveConfig, resolveModel, resolveMaxAgents, AgentType, TaskComplexity, type ModelProfile } from './core/index.js';

const args = process.argv.slice(2);
const command = args[0];

const COMMANDS: Record<string, () => void> = {
  'resolve-model': () => {
    const agentType = args[1]?.toUpperCase() as AgentType;
    if (!agentType || !Object.values(AgentType).includes(agentType)) {
      console.error(`Invalid agent type: ${args[1]}`);
      process.exit(1);
    }
    const projectDir = process.cwd();
    const config = loadConfig(projectDir);
    const model = resolveModel(config.execution.model_profile as ModelProfile, agentType, config.execution.model_overrides);
    if (args.includes('--raw')) {
      process.stdout.write(model.toLowerCase());
    } else {
      console.log(model);
    }
  },
  'resolve-max-agents': () => {
    const projectDir = process.cwd();
    const config = loadConfig(projectDir);
    const profile = (args[1] as ModelProfile) || config.execution.model_profile as ModelProfile;

    const fileCountIdx = args.indexOf('--file-count');
    const fileCount = fileCountIdx >= 0 ? parseInt(args[fileCountIdx + 1], 10) : 0;
    if (fileCountIdx >= 0 && (isNaN(fileCount) || fileCount < 0)) {
      console.error('--file-count must be a non-negative integer');
      process.exit(1);
    }

    const complexityIdx = args.indexOf('--complexity');
    const complexityArg = complexityIdx >= 0 ? args[complexityIdx + 1] : TaskComplexity.MEDIUM;
    if (!Object.values(TaskComplexity).includes(complexityArg as TaskComplexity)) {
      console.error(`Invalid complexity: ${complexityArg}. Must be: simple, medium, complex`);
      process.exit(1);
    }

    const result = resolveMaxAgents(profile, fileCount, complexityArg as TaskComplexity);
    if (args.includes('--raw')) {
      process.stdout.write(String(result));
    } else {
      console.log(result);
    }
  },
  'config-get': () => {
    const key = args[1];
    if (!key) { console.error('Usage: config-get <key>'); process.exit(1); }
    const config = loadConfig(process.cwd());
    const parts = key.split('.');
    let value: unknown = config;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }
    if (value === undefined) {
      console.error(`Key not found: ${key}`);
      process.exit(1);
    }
    console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
  },
  'config-set': () => {
    const key = args[1];
    const val = args[2];
    if (!key || val === undefined) { console.error('Usage: config-set <key> <value>'); process.exit(1); }
    const projectDir = process.cwd();
    const config = loadConfig(projectDir);
    const parts = key.split('.');
    let obj: Record<string, unknown> = config as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]] || typeof obj[parts[i]] !== 'object') {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]] as Record<string, unknown>;
    }
    // Try to parse as JSON, fall back to string
    try { obj[parts[parts.length - 1]] = JSON.parse(val); } catch { obj[parts[parts.length - 1]] = val; }
    saveConfig(projectDir, config);
    console.log(`Set ${key} = ${val}`);
  },
  'config-ensure-section': () => {
    const section = args[1];
    if (!section) { console.error('Usage: config-ensure-section <section>'); process.exit(1); }
    const projectDir = process.cwd();
    const config = loadConfig(projectDir);
    const obj = config as unknown as Record<string, unknown>;
    if (!obj[section]) {
      obj[section] = {};
      saveConfig(projectDir, config);
      console.log(`Created section: ${section}`);
    } else {
      console.log(`Section exists: ${section}`);
    }
  },
};

function main(): void {
  if (!command) {
    const available = Object.keys(COMMANDS).join(', ') || '(none yet)';
    process.stderr.write(
      `Usage: maxsim-tools <command> [args]\nCommands: ${available}\n`,
    );
    process.exit(1);
  }

  const handler = COMMANDS[command];
  if (!handler) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.exit(1);
  }

  handler();
}

try {
  main();
} catch (err: unknown) {
  process.stderr.write(
    `Fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
}
