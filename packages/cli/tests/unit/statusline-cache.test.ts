/**
 * Unit tests for core/statusline-cache.ts.
 *
 * Tests cover the read/write API, TTL expiry, error resilience, and the
 * Smart-Hybrid TTL that shortens the cache lifetime for "In Progress" status.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { writeStatuslineCache, readStatuslineCache } from '../../src/core/statusline-cache.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-cache-test-'));
  // Ensure the .claude/maxsim directory exists
  fs.mkdirSync(path.join(tmpDir, '.claude', 'maxsim'), { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Write then read
// ---------------------------------------------------------------------------

describe('write then read', () => {
  it('returns correct data after writing', () => {
    writeStatuslineCache(tmpDir, { phase: 3, status: 'Testing' });

    const result = readStatuslineCache(tmpDir);

    expect(result).not.toBeNull();
    expect(result?.phase).toBe(3);
    expect(result?.status).toBe('Testing');
    expect(result?.updatedAt).toBeDefined();
  });

  it('handles write with only phase', () => {
    writeStatuslineCache(tmpDir, { phase: 1 });

    const result = readStatuslineCache(tmpDir);

    expect(result).not.toBeNull();
    expect(result?.phase).toBe(1);
    expect(result?.status).toBeUndefined();
  });

  it('handles write with only status', () => {
    writeStatuslineCache(tmpDir, { status: 'Planning' });

    const result = readStatuslineCache(tmpDir);

    expect(result).not.toBeNull();
    expect(result?.phase).toBeUndefined();
    expect(result?.status).toBe('Planning');
  });

  it('creates .claude/maxsim directory if it does not exist', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-cache-empty-'));
    try {
      writeStatuslineCache(emptyDir, { phase: 2, status: 'Building' });

      const result = readStatuslineCache(emptyDir);
      expect(result).not.toBeNull();
      expect(result?.phase).toBe(2);
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Stale cache
// ---------------------------------------------------------------------------

describe('stale cache (> 120s)', () => {
  it('returns null when cache is older than default TTL', () => {
    // Write a cache entry with a timestamp 130 seconds in the past
    const staleTimestamp = new Date(Date.now() - 130_000).toISOString();
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      phase: 1,
      status: 'Testing',
      updatedAt: staleTimestamp,
    }), 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).toBeNull();
  });

  it('returns data when cache is within default TTL', () => {
    // Write a cache entry with a timestamp 60 seconds in the past
    const freshTimestamp = new Date(Date.now() - 60_000).toISOString();
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      phase: 2,
      status: 'Done',
      updatedAt: freshTimestamp,
    }), 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).not.toBeNull();
    expect(result?.phase).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Missing cache file
// ---------------------------------------------------------------------------

describe('missing cache file', () => {
  it('returns null when no cache file exists', () => {
    const result = readStatuslineCache(tmpDir);

    expect(result).toBeNull();
  });

  it('returns null when .claude/maxsim directory does not exist', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'statusline-cache-nodir-'));
    try {
      const result = readStatuslineCache(emptyDir);
      expect(result).toBeNull();
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Invalid JSON
// ---------------------------------------------------------------------------

describe('invalid JSON', () => {
  it('returns null when cache file contains invalid JSON', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, 'not valid json{{{', 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).toBeNull();
  });

  it('returns null when cache file contains a JSON array', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, '[]', 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).toBeNull();
  });

  it('returns null when cache file is missing updatedAt', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({ phase: 1, status: 'Test' }), 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).toBeNull();
  });

  it('returns null when updatedAt is not a valid date', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      phase: 1,
      status: 'Test',
      updatedAt: 'not-a-date',
    }), 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Smart TTL: "In Progress" uses 60s TTL
// ---------------------------------------------------------------------------

describe('Smart-Hybrid TTL', () => {
  it('returns null for "In Progress" status when cache is > 60s old', () => {
    // Write a cache entry with "In Progress" status, 70 seconds old
    const staleTimestamp = new Date(Date.now() - 70_000).toISOString();
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      phase: 3,
      status: 'In Progress',
      updatedAt: staleTimestamp,
    }), 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).toBeNull();
  });

  it('returns data for "In Progress" status when cache is < 60s old', () => {
    // Write a cache entry with "In Progress" status, 30 seconds old
    const freshTimestamp = new Date(Date.now() - 30_000).toISOString();
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      phase: 3,
      status: 'In Progress',
      updatedAt: freshTimestamp,
    }), 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).not.toBeNull();
    expect(result?.phase).toBe(3);
    expect(result?.status).toBe('In Progress');
  });

  it('uses 120s TTL for non-"In Progress" status', () => {
    // Write a cache entry with "Done" status, 100 seconds old — still within 120s TTL
    const freshTimestamp = new Date(Date.now() - 100_000).toISOString();
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      phase: 2,
      status: 'Done',
      updatedAt: freshTimestamp,
    }), 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).not.toBeNull();
    expect(result?.status).toBe('Done');
  });

  it('applies shorter TTL when status contains "In Progress" as substring', () => {
    // "Phase 3 - In Progress" also triggers the shorter TTL
    const staleTimestamp = new Date(Date.now() - 70_000).toISOString();
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      phase: 3,
      status: 'Phase 3 - In Progress',
      updatedAt: staleTimestamp,
    }), 'utf8');

    const result = readStatuslineCache(tmpDir);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fire-and-forget: writeStatuslineCache never throws
// ---------------------------------------------------------------------------

describe('write resilience', () => {
  it('does not throw when projectDir is invalid', () => {
    // A path that cannot be created on any OS
    expect(() => {
      writeStatuslineCache('/\0/invalid/path', { phase: 1 });
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Cache fast-path: write then immediate read within TTL
// ---------------------------------------------------------------------------

describe('cache fast-path', () => {
  it('returns data immediately after write (within TTL)', () => {
    writeStatuslineCache(tmpDir, { phase: 5, status: 'Testing' });
    const result = readStatuslineCache(tmpDir);

    expect(result).not.toBeNull();
    expect(result?.phase).toBe(5);
    expect(result?.status).toBe('Testing');
  });

  it('overwrites previous cache entry on subsequent writes', () => {
    writeStatuslineCache(tmpDir, { phase: 1, status: 'Planning' });
    writeStatuslineCache(tmpDir, { phase: 2, status: 'Building' });

    const result = readStatuslineCache(tmpDir);
    expect(result).not.toBeNull();
    expect(result?.phase).toBe(2);
    expect(result?.status).toBe('Building');
  });
});

// ---------------------------------------------------------------------------
// Cache-miss-then-write cycle
// ---------------------------------------------------------------------------

describe('cache-miss-then-write cycle', () => {
  it('returns null on first read, then data after write', () => {
    // First read: no cache file
    const miss = readStatuslineCache(tmpDir);
    expect(miss).toBeNull();

    // Write cache
    writeStatuslineCache(tmpDir, { phase: 3, status: 'Done' });

    // Second read: should return data
    const hit = readStatuslineCache(tmpDir);
    expect(hit).not.toBeNull();
    expect(hit?.phase).toBe(3);
    expect(hit?.status).toBe('Done');
  });
});

// ---------------------------------------------------------------------------
// Corrupt cache JSON (additional edge cases)
// ---------------------------------------------------------------------------

describe('corrupt cache JSON (additional edge cases)', () => {
  it('returns null when cache file contains just whitespace', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, '   \n  \t  ', 'utf8');

    const result = readStatuslineCache(tmpDir);
    expect(result).toBeNull();
  });

  it('returns null when cache file contains a JSON number', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, '42', 'utf8');

    const result = readStatuslineCache(tmpDir);
    expect(result).toBeNull();
  });

  it('returns null when cache file contains a JSON string', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, '"hello"', 'utf8');

    const result = readStatuslineCache(tmpDir);
    expect(result).toBeNull();
  });

  it('returns null when cache file contains an empty object', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, '{}', 'utf8');

    // Missing updatedAt => should return null
    const result = readStatuslineCache(tmpDir);
    expect(result).toBeNull();
  });

  it('returns null when updatedAt is a number instead of string', () => {
    const cachePath = path.join(tmpDir, '.claude', 'maxsim', '.statusline-cache.json');
    fs.writeFileSync(cachePath, JSON.stringify({
      phase: 1,
      status: 'Test',
      updatedAt: Date.now(),
    }), 'utf8');

    const result = readStatuslineCache(tmpDir);
    expect(result).toBeNull();
  });
});
