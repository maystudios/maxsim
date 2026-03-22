/**
 * MAXSIM Tools — CLI dispatcher.
 * Usage: node maxsim-tools.cjs <command> [args] [--raw]
 */

const COMMANDS: Record<string, () => void> = {};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    const available = Object.keys(COMMANDS).join(', ') || '(none yet)';
    process.stderr.write(
      `Usage: maxsim-tools <command> [args] [--raw]\nCommands: ${available}\n`,
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

main().catch((err: unknown) => {
  process.stderr.write(
    `Fatal: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
});
