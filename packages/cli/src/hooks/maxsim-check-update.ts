/**
 * SessionStart hook — check if a newer maxsimcli version is available on npm.
 *
 * Behaviour:
 *  - Reads session info from stdin (ignored; hook fires on every session start).
 *  - Uses a one-hour cache file so the npm registry is queried at most once/hour.
 *  - Spawns a detached background process when the cache is stale so the check
 *    never blocks the session from starting.
 *  - If a newer version is found (from the cache), emits an additionalContext
 *    JSON message to stdout.
 *  - Always exits 0 — never blocks the user's session.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { readStdinJson } from './shared.js';

const PACKAGE_NAME = 'maxsimcli';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_FILE = path.join(os.tmpdir(), '.maxsimcli-update-cache.json');

interface CacheEntry {
  checkedAt: number;
  latestVersion: string;
}

interface SessionStartInput {
  session_id?: string;
  [key: string]: unknown;
}

/** Read the currently installed version from package.json next to this script. */
function getInstalledVersion(): string {
  try {
    // Walk up from this file's location to find the package root
    let dir = path.dirname(process.argv[1] ?? __filename);
    for (let i = 0; i < 6; i++) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string };
        if (pkg.name === PACKAGE_NAME && pkg.version) {
          return pkg.version;
        }
      }
      dir = path.dirname(dir);
    }
  } catch {
    // Ignore
  }
  return '0.0.0';
}

/** Read the update cache from disk. Returns null if absent or expired. */
function readCache(): CacheEntry | null {
  try {
    if (!fs.existsSync(CACHE_FILE)) return null;
    const entry = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as CacheEntry;
    if (Date.now() - entry.checkedAt > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

/** Write a cache entry to disk (best-effort). */
function writeCache(latestVersion: string): void {
  try {
    const entry: CacheEntry = { checkedAt: Date.now(), latestVersion };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry), 'utf8');
  } catch {
    // Ignore write failures
  }
}

/** Compare semver strings. Returns true if b > a. */
function isNewer(installed: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^[^0-9]*/, '').split('.').map(Number);
  const [aMaj = 0, aMin = 0, aPat = 0] = parse(installed);
  const [bMaj = 0, bMin = 0, bPat = 0] = parse(latest);
  if (bMaj !== aMaj) return bMaj > aMaj;
  if (bMin !== aMin) return bMin > aMin;
  return bPat > aPat;
}

/** Spawn a background npm view query and write its result to the cache file. */
function spawnBackgroundCheck(): void {
  try {
    const child = spawn(
      'npm',
      ['view', PACKAGE_NAME, 'version', '--json'],
      {
        detached: true,
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      },
    );

    let stdout = '';
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString(); });
    child.on('close', (code: number) => {
      if (code === 0) {
        try {
          const version = JSON.parse(stdout.trim()) as string;
          writeCache(version);
        } catch {
          // Malformed output — ignore
        }
      }
    });

    child.unref();
  } catch {
    // Ignore spawn failures (npm not available, etc.)
  }
}

function emitUpdateNotice(installed: string, latest: string): void {
  process.stdout.write(
    JSON.stringify({
      additionalContext: `MaxsimCLI update available: v${installed} → v${latest}. Run: npx maxsimcli@latest`,
    }) + '\n',
  );
}

readStdinJson<SessionStartInput>(() => {
  const installed = getInstalledVersion();
  const cache = readCache();

  if (cache === null) {
    // Cache is stale or absent — kick off a background refresh.
    // We do a quick synchronous check first so we don't miss the very first run.
    try {
      const result = spawnSync('npm', ['view', PACKAGE_NAME, 'version', '--json'], {
        encoding: 'utf8',
        timeout: 4000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (result.status === 0 && result.stdout) {
        const latest = JSON.parse(result.stdout.trim()) as string;
        writeCache(latest);
        if (isNewer(installed, latest)) {
          emitUpdateNotice(installed, latest);
        }
      } else {
        // npm timed out or failed — schedule a detached background check for next time
        spawnBackgroundCheck();
      }
    } catch {
      spawnBackgroundCheck();
    }
  } else if (isNewer(installed, cache.latestVersion)) {
    emitUpdateNotice(installed, cache.latestVersion);
  }

  process.exit(0);
});
