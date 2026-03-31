/**
 * MAXSIM Tools — CLI async dispatcher.
 * Usage: node cli.cjs <command> [args]
 *        node cli.cjs <namespace> <subcommand> [args]
 */

import { MaxsimError, classifyError } from './core/errors.js';
import { ALL_COMMANDS, GITHUB_COMMANDS } from './commands/index.js';
import type { CommandRegistry } from './commands/index.js';

/**
 * Namespace command registries for two-level routing (e.g. `github push`).
 */
export const NAMESPACE_COMMANDS: Record<string, CommandRegistry> = {
  github: GITHUB_COMMANDS,
};

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  if (!command) {
    const flatNames = Object.keys(ALL_COMMANDS).join(', ') || '(none yet)';
    const nsNames = Object.keys(NAMESPACE_COMMANDS).join(', ');
    const nsInfo = nsNames ? `\nNamespaces: ${nsNames}` : '';
    process.stderr.write(`Usage: maxsim-tools <command> [args]\nCommands: ${flatNames}${nsInfo}\n`);
    process.exit(1);
  }

  // ── Namespace routing ───────────────────────────────────────────────
  if (NAMESPACE_COMMANDS[command]) {
    const subcommand = args[1];
    const registry = NAMESPACE_COMMANDS[command];
    if (!subcommand || !registry[subcommand]) {
      const available = Object.keys(registry).join(', ') || '(none)';
      process.stderr.write(`Usage: maxsim-tools ${command} <subcommand> [args]\nSubcommands: ${available}\n`);
      process.exit(1);
    }
    const result = await registry[subcommand].handler(args.slice(2));
    if (!result.ok) {
      process.stderr.write(`${result.error}\n`);
      process.exit(1);
    }
    if (result.ok && typeof result.result === 'string') {
      console.log(result.result);
    }
    return;
  }

  // ── Flat command routing ─────────────────────────────────────────────
  if (ALL_COMMANDS[command]) {
    const result = await ALL_COMMANDS[command].handler(args.slice(1));
    if (!result.ok) {
      process.stderr.write(`${result.error}\n`);
      process.exit(1);
    }
    if (result.ok && typeof result.result === 'string') {
      console.log(result.result);
    } else if (result.ok && typeof result.result === 'number') {
      console.log(result.result);
    }
    return;
  }

  process.stderr.write(`Unknown command: ${command}\n`);
  process.exit(1);
}

main().catch((err: unknown) => {
  if (err instanceof MaxsimError) {
    const tier = err.recovery.tier.toUpperCase();
    process.stderr.write(`[ERROR:${tier}] ${err.message}\n`);
    if (err.recovery.suggestedAction) {
      process.stderr.write(`Suggestion: ${err.recovery.suggestedAction}\n`);
    }
  } else {
    const recovery = classifyError(err);
    const tier = recovery.tier.toUpperCase();
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[ERROR:${tier}] ${message}\n`);
    if (recovery.suggestedAction) {
      process.stderr.write(`Suggestion: ${recovery.suggestedAction}\n`);
    }
  }
  process.exit(1);
});
