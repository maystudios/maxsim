/**
 * statusLine hook — display a brief MaxsimCLI status string in the terminal
 * status bar.
 *
 * Output contract (Claude Code statusLine):
 *   Process must write a single line of plain text (or JSON with a "text" key)
 *   to stdout and exit 0.  The output should be short (<80 chars).
 *
 * Performance target: <100 ms — local file reads only, no network calls.
 *
 * Cache layer: on every invocation the hook first checks the local statusline
 * cache (.claude/maxsim/.statusline-cache.json). If fresh, the cached status
 * text is used directly — skipping the config read entirely. When the cache
 * is stale or missing the hook falls back to reading config.json and writes
 * the result to cache for the next invocation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { readStdinJson, CLAUDE_DIR } from './shared.js';

interface StatusLineInput {
  cwd?: string;
  session_id?: string;
  [key: string]: unknown;
}

interface MaxsimConfig {
  currentPhase?: number;
  projectStatus?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Inline cache helpers — the hook is compiled as a standalone CJS bundle so
// we cannot import from ../core. The logic mirrors statusline-cache.ts.
// ---------------------------------------------------------------------------

interface StatuslineCacheData {
  phase?: number;
  status?: string;
  updatedAt: string;
}

const DEFAULT_TTL_SECONDS = 120;
const ACTIVE_TTL_SECONDS = 60;

function cachePath(projectDir: string): string {
  return path.join(projectDir, CLAUDE_DIR, 'maxsim', '.statusline-cache.json');
}

function readCache(projectDir: string): StatuslineCacheData | null {
  try {
    const filePath = cachePath(projectDir);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    const cache = parsed as StatuslineCacheData;
    if (typeof cache.updatedAt !== 'string') return null;
    const updatedAt = new Date(cache.updatedAt).getTime();
    if (Number.isNaN(updatedAt)) return null;
    const ttlSeconds =
      typeof cache.status === 'string' && cache.status.includes('In Progress')
        ? ACTIVE_TTL_SECONDS
        : DEFAULT_TTL_SECONDS;
    const ageSeconds = (Date.now() - updatedAt) / 1000;
    if (ageSeconds > ttlSeconds) return null;
    return cache;
  } catch {
    return null;
  }
}

function writeCache(projectDir: string, data: { phase?: number; status?: string }): void {
  try {
    const filePath = cachePath(projectDir);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: StatuslineCacheData = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
  } catch {
    // Fire-and-forget
  }
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** Resolve the project directory from the hook input or fall back to cwd. */
function resolveProjectDir(input: StatusLineInput): string {
  return input.cwd ?? process.cwd();
}

/** Read the maxsim config.json; returns null if absent or unreadable. */
function readMaxsimConfig(projectDir: string): MaxsimConfig | null {
  const configPath = path.join(projectDir, CLAUDE_DIR, 'maxsim', 'config.json');
  try {
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, 'utf8')) as MaxsimConfig;
  } catch {
    return null;
  }
}

/** Build the status text string from phase and status values. */
function buildStatusText(phase: number | null, status: string): string {
  if (phase !== null) {
    return `MAXSIM \u25ba Phase ${phase} | ${status}`;
  }
  return `MAXSIM \u25ba ${status}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

readStdinJson<StatusLineInput>((input) => {
  const projectDir = resolveProjectDir(input);

  // Fast path: serve from cache if fresh
  const cached = readCache(projectDir);
  if (cached !== null) {
    const phase = typeof cached.phase === 'number' ? cached.phase : null;
    const status = typeof cached.status === 'string' ? cached.status : 'In Progress';
    const statusText = buildStatusText(phase, status);
    process.stdout.write(`${statusText}\n`);
    process.exit(0);
    return; // unreachable but clarifies intent
  }

  // Slow path: read config, build status, write cache for next time
  const config = readMaxsimConfig(projectDir);

  let statusText: string;

  if (config !== null) {
    const phase = typeof config.currentPhase === 'number' ? config.currentPhase : null;
    const status = typeof config.projectStatus === 'string' ? config.projectStatus : 'In Progress';

    statusText = buildStatusText(phase, status);

    // Populate cache for next invocation
    writeCache(projectDir, {
      phase: phase ?? undefined,
      status,
    });
  } else {
    statusText = 'MAXSIM \u25ba Ready';
  }

  process.stdout.write(`${statusText}\n`);
  process.exit(0);
});
