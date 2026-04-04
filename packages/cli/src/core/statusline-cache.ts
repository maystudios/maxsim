/**
 * Statusline cache — local file-based cache for the statusline hook.
 *
 * The cache avoids re-reading maxsim config.json on every statusline
 * invocation. It stores the rendered status text in a small JSON file
 * and serves it until the TTL expires.
 *
 * Smart-Hybrid TTL:
 *   - Default: 120 seconds
 *   - "In Progress" status: 60 seconds (refresh faster during active work)
 *
 * Performance target: <100 ms, pure local file I/O, no network calls.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Shape of the on-disk cache file. */
export interface StatuslineCache {
  phase?: number;
  status?: string;
  updatedAt: string;
}

/** Data accepted by the write API (timestamp is auto-generated). */
export interface StatuslineCacheInput {
  phase?: number;
  status?: string;
}

/** Default TTL in seconds. */
const DEFAULT_TTL_SECONDS = 120;

/** Shorter TTL for "In Progress" status — refresh faster during active work. */
const ACTIVE_TTL_SECONDS = 60;

/** Resolve the cache file path inside the project's .claude/maxsim directory. */
function cachePath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'maxsim', '.statusline-cache.json');
}

/**
 * Write the statusline cache to disk.
 *
 * Fire-and-forget: this function never throws. If the write fails for
 * any reason (missing directory, permissions, disk full) it is silently
 * swallowed — the statusline hook will simply fall back to a fresh
 * config read on the next invocation.
 */
export function writeStatuslineCache(projectDir: string, data: StatuslineCacheInput): void {
  try {
    const filePath = cachePath(projectDir);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: StatuslineCache = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf8');
  } catch {
    // Fire-and-forget — never throw
  }
}

/**
 * Read the statusline cache from disk.
 *
 * Returns the cached data if the cache file exists and is still fresh
 * (within the applicable TTL). Returns `null` if the cache is missing,
 * stale, or unreadable.
 *
 * Smart-Hybrid TTL: when the cached status contains "In Progress", a
 * shorter 60-second TTL is applied so the statusline refreshes faster
 * during active work.
 *
 * Never throws — returns `null` on any error.
 */
export function readStatuslineCache(projectDir: string): StatuslineCache | null {
  try {
    const filePath = cachePath(projectDir);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const cache = parsed as StatuslineCache;

    // Validate updatedAt is present and parseable
    if (typeof cache.updatedAt !== 'string') return null;
    const updatedAt = new Date(cache.updatedAt).getTime();
    if (Number.isNaN(updatedAt)) return null;

    // Determine TTL based on status content
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
