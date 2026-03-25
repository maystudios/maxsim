/**
 * CLI entry-point tests.
 * Tests the actual CLI dispatcher (cli.ts) by spawning the built CLI
 * as a child process and verifying stdout, stderr, and exit codes.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { DEFAULT_CONFIG } from '../../src/core/types.js';
import { saveConfig } from '../../src/core/config.js';

const CLI_PATH = path.resolve(__dirname, '../../dist/cli.cjs');
const NODE = process.execPath;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxsim-cli-entry-'));
  // Write a default config so config-dependent commands work
  saveConfig(tmpDir, { ...DEFAULT_CONFIG });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Run the CLI with the given args. Returns { stdout, stderr, exitCode }. */
function runCli(
  args: string[],
  opts: { cwd?: string; env?: Record<string, string> } = {},
): { stdout: string; stderr: string; exitCode: number } {
  const execOpts: ExecFileSyncOptions = {
    cwd: opts.cwd ?? tmpDir,
    env: { ...process.env, ...opts.env },
    encoding: 'utf8' as const,
    timeout: 10_000,
  };

  try {
    const stdout = execFileSync(NODE, [CLI_PATH, ...args], execOpts) as unknown as string;
    return { stdout: stdout ?? '', stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (e.stdout as string) ?? '',
      stderr: (e.stderr as string) ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

// ── No arguments → usage message ──────────────────────────────────────

describe('CLI with no arguments', () => {
  it('prints usage message to stderr and exits with code 1', () => {
    const result = runCli([]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage:');
    expect(result.stderr).toContain('maxsim-tools');
  });

  it('lists available commands in usage output', () => {
    const result = runCli([]);
    expect(result.stderr).toContain('resolve-model');
    expect(result.stderr).toContain('resolve-max-agents');
    expect(result.stderr).toContain('config-get');
    expect(result.stderr).toContain('config-set');
    expect(result.stderr).toContain('config-ensure-section');
  });
});

// ── Unknown command ───────────────────────────────────────────────────

describe('CLI with unknown command', () => {
  it('prints "Unknown command" to stderr and exits with code 1', () => {
    const result = runCli(['nonexistent-command']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Unknown command');
    expect(result.stderr).toContain('nonexistent-command');
  });
});

// ── resolve-model command ─────────────────────────────────────────────

describe('CLI resolve-model command', () => {
  // NOTE: The CLI calls args[1]?.toUpperCase() before matching against AgentType
  // values which are lowercase ('executor', 'planner', etc.). This means the
  it('accepts lowercase agent type', () => {
    const result = runCli(['resolve-model', 'executor']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^(opus|sonnet|haiku)$/);
  });

  it('accepts uppercase agent type via case normalization', () => {
    const result = runCli(['resolve-model', 'PLANNER']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toMatch(/^(opus|sonnet|haiku)$/);
  });

  it('exits with error for missing agent type argument', () => {
    const result = runCli(['resolve-model']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid agent type');
  });

  it('exits with error for invalid agent type', () => {
    const result = runCli(['resolve-model', 'bogus']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid agent type');
    expect(result.stderr).toContain('bogus');
  });
});

// ── resolve-max-agents command ────────────────────────────────────────

describe('CLI resolve-max-agents command', () => {
  it('resolves max agents with default profile from config', () => {
    const result = runCli(['resolve-max-agents']);
    expect(result.exitCode).toBe(0);
    const num = parseInt(result.stdout.trim(), 10);
    expect(num).toBeGreaterThan(0);
  });

  it('resolves max agents with explicit profile argument', () => {
    const result = runCli(['resolve-max-agents', 'quality']);
    expect(result.exitCode).toBe(0);
    const num = parseInt(result.stdout.trim(), 10);
    expect(num).toBeGreaterThan(0);
  });

  it('resolves max agents with --file-count flag', () => {
    const result = runCli(['resolve-max-agents', 'balanced', '--file-count', '50']);
    expect(result.exitCode).toBe(0);
    const num = parseInt(result.stdout.trim(), 10);
    expect(num).toBeGreaterThan(0);
  });

  it('resolves max agents with --complexity flag', () => {
    const result = runCli(['resolve-max-agents', 'balanced', '--complexity', 'simple']);
    expect(result.exitCode).toBe(0);
    const num = parseInt(result.stdout.trim(), 10);
    expect(num).toBeGreaterThan(0);
  });

  it('outputs without trailing newline when --raw is used', () => {
    const result = runCli(['resolve-max-agents', 'balanced', '--raw']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.endsWith('\n')).toBe(false);
    const num = parseInt(result.stdout, 10);
    expect(num).toBeGreaterThan(0);
  });

  it('exits with error for invalid --file-count value', () => {
    const result = runCli(['resolve-max-agents', 'balanced', '--file-count', '-5']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--file-count');
  });

  it('exits with error for non-numeric --file-count', () => {
    const result = runCli(['resolve-max-agents', 'balanced', '--file-count', 'abc']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('--file-count');
  });

  it('exits with error for invalid complexity value', () => {
    const result = runCli(['resolve-max-agents', 'balanced', '--complexity', 'extreme']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Invalid complexity');
    expect(result.stderr).toContain('extreme');
  });
});

// ── config-get command ────────────────────────────────────────────────

describe('CLI config-get command', () => {
  it('gets a scalar config value', () => {
    const result = runCli(['config-get', 'execution.model_profile']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('balanced');
  });

  it('gets a nested object value as JSON', () => {
    const result = runCli(['config-get', 'execution.parallelism']);
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.stdout.trim());
    expect(parsed).toHaveProperty('max_agents_per_wave');
    expect(parsed).toHaveProperty('max_retries');
  });

  it('exits with error when key is missing', () => {
    const result = runCli(['config-get']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage');
    expect(result.stderr).toContain('config-get');
  });

  it('exits with error for nonexistent key path', () => {
    const result = runCli(['config-get', 'nonexistent.key.path']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Key not found');
  });
});

// ── config-set command ────────────────────────────────────────────────

describe('CLI config-set command', () => {
  it('sets a string value', () => {
    const setResult = runCli(['config-set', 'execution.model_profile', 'quality']);
    expect(setResult.exitCode).toBe(0);
    expect(setResult.stdout).toContain('Set');

    // Verify the value was persisted
    const getResult = runCli(['config-get', 'execution.model_profile']);
    expect(getResult.stdout.trim()).toBe('quality');
  });

  it('sets a numeric value (parsed as JSON)', () => {
    const setResult = runCli(['config-set', 'execution.parallelism.max_retries', '7']);
    expect(setResult.exitCode).toBe(0);

    const getResult = runCli(['config-get', 'execution.parallelism.max_retries']);
    expect(getResult.stdout.trim()).toBe('7');
  });

  it('sets a boolean value (parsed as JSON)', () => {
    const setResult = runCli(['config-set', 'workflow.auto_advance', 'true']);
    expect(setResult.exitCode).toBe(0);

    const getResult = runCli(['config-get', 'workflow.auto_advance']);
    expect(getResult.stdout.trim()).toBe('true');
  });

  it('exits with error when key is missing', () => {
    const result = runCli(['config-set']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage');
    expect(result.stderr).toContain('config-set');
  });

  it('exits with error when value is missing', () => {
    const result = runCli(['config-set', 'some.key']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage');
    expect(result.stderr).toContain('config-set');
  });
});

// ── config-ensure-section command ─────────────────────────────────────

describe('CLI config-ensure-section command', () => {
  it('creates a new section that does not exist', () => {
    const result = runCli(['config-ensure-section', 'new_custom_section']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Created section');
    expect(result.stdout).toContain('new_custom_section');
  });

  it('reports existing section without overwriting', () => {
    const result = runCli(['config-ensure-section', 'execution']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Section exists');
    expect(result.stdout).toContain('execution');
  });

  it('exits with error when section name is missing', () => {
    const result = runCli(['config-ensure-section']);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('Usage');
    expect(result.stderr).toContain('config-ensure-section');
  });
});

// ── --raw flag across commands ────────────────────────────────────────

describe('--raw flag behavior', () => {
  it('resolve-max-agents --raw outputs number without trailing newline', () => {
    const result = runCli(['resolve-max-agents', 'balanced', '--raw']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.endsWith('\n')).toBe(false);
    expect(parseInt(result.stdout, 10)).toBeGreaterThan(0);
  });

  it('resolve-max-agents without --raw outputs with trailing newline', () => {
    const result = runCli(['resolve-max-agents', 'balanced']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.endsWith('\n')).toBe(true);
  });
});

// ── All 5 commands are registered ─────────────────────────────────────

describe('command routing', () => {
  const commands = [
    'resolve-model',
    'resolve-max-agents',
    'config-get',
    'config-set',
    'config-ensure-section',
  ];

  for (const cmd of commands) {
    it(`"${cmd}" is listed in usage output`, () => {
      const result = runCli([]);
      expect(result.stderr).toContain(cmd);
    });
  }
});
