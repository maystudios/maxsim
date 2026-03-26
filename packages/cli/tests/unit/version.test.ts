/**
 * Dedicated unit tests for core/version.ts.
 *
 * Tests cover:
 *  - VERSION constant (non-empty string)
 *  - parseVersion (valid semver, invalid strings, pre-release suffix)
 *  - isVersionAtLeast (various comparison scenarios)
 *  - getVersion (returns VERSION)
 */

import { describe, it, expect } from 'vitest';
import { VERSION, parseVersion, isVersionAtLeast, getVersion } from '../../src/core/version.js';

// ---------------------------------------------------------------------------
// VERSION constant
// ---------------------------------------------------------------------------

describe('VERSION', () => {
  it('is a non-empty string', () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);
  });

  it('looks like a semver string (digits.digits.digits)', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('can be parsed by parseVersion', () => {
    const parsed = parseVersion(VERSION);
    expect(parsed).not.toBeNull();
    expect(parsed?.major).toBeGreaterThanOrEqual(0);
    expect(parsed?.minor).toBeGreaterThanOrEqual(0);
    expect(parsed?.patch).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// parseVersion
// ---------------------------------------------------------------------------

describe('parseVersion', () => {
  it('parses a valid semver string', () => {
    expect(parseVersion('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parses zero-based versions', () => {
    expect(parseVersion('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
  });

  it('parses large version numbers', () => {
    expect(parseVersion('100.200.300')).toEqual({ major: 100, minor: 200, patch: 300 });
  });

  it('parses semver with pre-release suffix', () => {
    expect(parseVersion('2.0.1-beta.1')).toEqual({ major: 2, minor: 0, patch: 1 });
  });

  it('parses semver with build metadata suffix', () => {
    expect(parseVersion('1.0.0+build.123')).toEqual({ major: 1, minor: 0, patch: 0 });
  });

  it('parses semver with both pre-release and build metadata', () => {
    expect(parseVersion('3.5.7-alpha.2+sha.abc123')).toEqual({ major: 3, minor: 5, patch: 7 });
  });

  it('returns null for empty string', () => {
    expect(parseVersion('')).toBeNull();
  });

  it('returns null for non-semver strings', () => {
    expect(parseVersion('invalid')).toBeNull();
    expect(parseVersion('abc')).toBeNull();
    expect(parseVersion('not-a-version')).toBeNull();
  });

  it('returns null for partial version strings', () => {
    expect(parseVersion('1')).toBeNull();
    expect(parseVersion('1.2')).toBeNull();
  });

  it('returns null for strings with only dots', () => {
    expect(parseVersion('...')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isVersionAtLeast
// ---------------------------------------------------------------------------

describe('isVersionAtLeast', () => {
  it('returns true when current version meets the minimum', () => {
    expect(isVersionAtLeast('1.0.0')).toBe(true);
  });

  it('returns true when current version equals the minimum', () => {
    expect(isVersionAtLeast(VERSION)).toBe(true);
  });

  it('returns false when minimum is higher than current (major)', () => {
    expect(isVersionAtLeast('999.0.0')).toBe(false);
  });

  it('returns false when minimum is higher than current (minor)', () => {
    expect(isVersionAtLeast(`${parseVersion(VERSION)?.major}.999.0`)).toBe(false);
  });

  it('returns false when minimum is higher than current (patch)', () => {
    const v = parseVersion(VERSION);
    expect(v).not.toBeNull();
    if (!v) throw new Error('parseVersion returned null');
    expect(isVersionAtLeast(`${v.major}.${v.minor}.999`)).toBe(false);
  });

  it('returns true when current major is greater than minimum major', () => {
    expect(isVersionAtLeast('0.999.999')).toBe(true);
  });

  it('returns true when same major but current minor is greater', () => {
    const v = parseVersion(VERSION);
    expect(v).not.toBeNull();
    if (!v) throw new Error('parseVersion returned null');
    if (v.minor > 0) {
      expect(isVersionAtLeast(`${v.major}.${v.minor - 1}.999`)).toBe(true);
    }
  });

  it('returns true when same major.minor but current patch is equal', () => {
    expect(isVersionAtLeast(VERSION)).toBe(true);
  });

  it('returns false for invalid version strings', () => {
    expect(isVersionAtLeast('invalid')).toBe(false);
    expect(isVersionAtLeast('')).toBe(false);
    expect(isVersionAtLeast('abc.def.ghi')).toBe(false);
  });

  it('handles version 0.0.0 as minimum', () => {
    expect(isVersionAtLeast('0.0.0')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getVersion
// ---------------------------------------------------------------------------

describe('getVersion', () => {
  it('returns a non-empty string', () => {
    const v = getVersion();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(0);
  });

  it('returns the same value as the VERSION constant', () => {
    expect(getVersion()).toBe(VERSION);
  });

  it('returns a parseable semver string', () => {
    const v = getVersion();
    expect(parseVersion(v)).not.toBeNull();
  });

  it('is stable across multiple calls', () => {
    expect(getVersion()).toBe(getVersion());
  });
});
