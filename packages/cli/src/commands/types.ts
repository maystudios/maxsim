/**
 * Command handler types and argument parsing utilities.
 * Used by all command modules in packages/cli/src/commands/.
 */

import { type CmdResult, cmdErr } from '../core/types.js';

export type { CmdResult };
export { cmdErr };

// ── Handler Types ─────────────────────────────────────────────────────

/** A single registered CLI command. */
export interface CommandHandler {
  name: string;
  description: string;
  handler: (args: string[]) => Promise<CmdResult>;
}

/** Maps command name to handler. */
export type CommandRegistry = Record<string, CommandHandler>;

// ── Argument Parsing Utilities ────────────────────────────────────────

/**
 * Returns the positional argument at `index`, or undefined if absent.
 */
export function getPositionalArg(args: string[], index: number): string | undefined {
  return args[index];
}

/**
 * Returns the value of a named flag (`--flag value`), or undefined if absent.
 * Example: getFlag(['--file-count', '5'], '--file-count') → '5'
 */
export function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

/**
 * Returns true if `flag` is present in `args`.
 */
export function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

/**
 * Returns the positional argument at `index`.
 * Throws a TypeError if the argument is missing.
 */
export function getRequiredArg(args: string[], index: number, name: string): string {
  const value = args[index];
  if (value === undefined || value === '') {
    throw new TypeError(`Missing required argument: ${name}`);
  }
  return value;
}

/**
 * Returns the value of a named flag.
 * Throws a TypeError if the flag is absent or has no value.
 */
export function getRequiredFlag(args: string[], flag: string): string {
  const value = getFlag(args, flag);
  if (value === undefined) {
    throw new TypeError(`Missing required flag: ${flag}`);
  }
  return value;
}

/**
 * Returns the integer value of a named flag, or undefined if absent.
 * Returns NaN (not undefined) if the value cannot be parsed as an integer.
 */
export function getIntFlag(args: string[], flag: string): number | undefined {
  const raw = getFlag(args, flag);
  if (raw === undefined) return undefined;
  return parseInt(raw, 10);
}
