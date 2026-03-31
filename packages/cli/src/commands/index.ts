/**
 * Central command registry.
 * Aggregates all command modules into a single flat registry.
 */

import { RESOLVE_COMMANDS } from './resolve.js';
import { CONFIG_COMMANDS } from './config.js';
import type { CommandRegistry } from './types.js';

export const ALL_COMMANDS: CommandRegistry = {
  ...RESOLVE_COMMANDS,
  ...CONFIG_COMMANDS,
};

export * from './types.js';
export { RESOLVE_COMMANDS } from './resolve.js';
export { CONFIG_COMMANDS } from './config.js';
export { GITHUB_COMMANDS } from './github.js';
