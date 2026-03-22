import { describe, it, expect } from 'vitest';
import { cmdOk, cmdErr } from '../../src/core/types.js';
import { VERSION } from '../../src/core/version.js';

describe('Phase 0 Foundation', () => {
  it('cmdOk creates a successful result', () => {
    const result = cmdOk('hello');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result).toBe('hello');
    }
  });

  it('cmdOk supports rawValue', () => {
    const result = cmdOk({ data: 1 }, 'raw');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rawValue).toBe('raw');
    }
  });

  it('cmdErr creates an error result', () => {
    const result = cmdErr('something went wrong');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('something went wrong');
    }
  });

  it('VERSION is defined', () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
