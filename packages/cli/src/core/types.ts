/**
 * Core type definitions for MaxsimCLI v6.
 * Single source of truth — all modules import from here.
 */

/** Successful command result. */
interface CmdOk {
  ok: true;
  result: unknown;
  rawValue?: unknown;
}

/** Failed command result. */
interface CmdFail {
  ok: false;
  error: string;
}

/** Discriminated union for all CLI command results. */
export type CmdResult = CmdOk | CmdFail;

/** Create a successful result. */
export function cmdOk(result: unknown, rawValue?: unknown): CmdResult {
  return { ok: true, result, rawValue };
}

/** Create an error result. */
export function cmdErr(error: string): CmdResult {
  return { ok: false, error };
}
