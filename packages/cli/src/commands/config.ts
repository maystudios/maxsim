/**
 * Config command handlers: config-get, config-set, config-ensure-section.
 * Extracted from cli.ts to enable modular async dispatch.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig, saveConfig, cmdOk, cmdErr } from '../core/index.js';
import { getPositionalArg, type CommandRegistry } from './types.js';

export const CONFIG_COMMANDS: CommandRegistry = {
  'config-get': {
    name: 'config-get',
    description: 'Get a config value by dot-notation key (e.g. execution.model_profile).',
    async handler(args) {
      const key = getPositionalArg(args, 0);
      if (!key) {
        return cmdErr('Usage: config-get <key>');
      }
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
        return cmdErr(`Key not found: ${key}`);
      }
      const display = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      return cmdOk(display);
    },
  },

  'config-set': {
    name: 'config-set',
    description: 'Set a config value by dot-notation key (e.g. config-set execution.model_profile quality).',
    async handler(args) {
      const key = getPositionalArg(args, 0);
      const val = getPositionalArg(args, 1);
      if (!key || val === undefined) {
        return cmdErr('Usage: config-set <key> <value>');
      }
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
      const message = `Set ${key} = ${val}`;
      return cmdOk(message);
    },
  },

  'config-save-defaults': {
    name: 'config-save-defaults',
    description: 'Save current config as a defaults snapshot. Usage: config-save-defaults <output-path>',
    async handler(args) {
      const dest = getPositionalArg(args, 0);
      if (!dest) {
        return cmdErr('Usage: config-save-defaults <output-path>');
      }
      const config = loadConfig(process.cwd());
      const destPath = path.resolve(dest);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, JSON.stringify(config, null, 2), 'utf8');
      return cmdOk(`Defaults saved to ${destPath}`);
    },
  },

  'validate-structure': {
    name: 'validate-structure',
    description: 'Validate the MaxsimCLI directory structure. Usage: validate-structure',
    async handler(_args) {
      const projectDir = process.cwd();
      const checks = [
        { path: '.claude', label: '.claude/ directory' },
        { path: path.join('.claude', 'maxsim'), label: '.claude/maxsim/ directory' },
        { path: path.join('.claude', 'maxsim', 'bin', 'maxsim-tools.cjs'), label: '.claude/maxsim/bin/maxsim-tools.cjs' },
        { path: path.join('.claude', 'maxsim', 'config.json'), label: '.claude/maxsim/config.json' },
      ];

      const results: string[] = [];
      let allPassed = true;
      for (const check of checks) {
        const fullPath = path.join(projectDir, check.path);
        const exists = fs.existsSync(fullPath);
        results.push(`${exists ? 'PASS' : 'FAIL'}: ${check.label}`);
        if (!exists) allPassed = false;
      }

      const summary = allPassed ? 'All checks passed.' : 'Some checks failed.';
      return cmdOk(`${results.join('\n')}\n${summary}`);
    },
  },

  'config-ensure-section': {
    name: 'config-ensure-section',
    description: 'Create a top-level config section if it does not already exist.',
    async handler(args) {
      const section = getPositionalArg(args, 0);
      if (!section) {
        return cmdErr('Usage: config-ensure-section <section>');
      }
      const projectDir = process.cwd();
      const config = loadConfig(projectDir);
      const obj = config as unknown as Record<string, unknown>;
      let message: string;
      if (!obj[section]) {
        obj[section] = {};
        saveConfig(projectDir, config);
        message = `Created section: ${section}`;
      } else {
        message = `Section exists: ${section}`;
      }
      return cmdOk(message);
    },
  },
};
