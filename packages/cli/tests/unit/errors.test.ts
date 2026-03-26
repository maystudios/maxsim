/**
 * Unit tests for core/errors.ts
 *
 * Tests the structured error hierarchy, RecoveryTier enum,
 * and the classifyError() heuristic function.
 */

import { describe, it, expect } from 'vitest';
import {
  RecoveryTier,
  MaxsimError,
  VerificationError,
  GitError,
  GithubError,
  EscalationError,
  classifyError,
  type ErrorRecovery,
} from '../../src/core/errors.js';

// ── RecoveryTier ──────────────────────────────────────────────────────────────

describe('RecoveryTier', () => {
  it('has exactly three tiers', () => {
    const values = Object.values(RecoveryTier);
    expect(values).toHaveLength(3);
    expect(values).toContain('debug');
    expect(values).toContain('rollback');
    expect(values).toContain('escalate');
  });

  it('DEBUG is "debug"', () => {
    expect(RecoveryTier.DEBUG).toBe('debug');
  });

  it('ROLLBACK is "rollback"', () => {
    expect(RecoveryTier.ROLLBACK).toBe('rollback');
  });

  it('ESCALATE is "escalate"', () => {
    expect(RecoveryTier.ESCALATE).toBe('escalate');
  });
});

// ── MaxsimError ───────────────────────────────────────────────────────────────

describe('MaxsimError', () => {
  it('creates an error with recovery info', () => {
    const recovery: ErrorRecovery = {
      tier: RecoveryTier.DEBUG,
      reason: 'something broke',
      suggestedAction: 'fix it',
    };
    const err = new MaxsimError('test error', recovery);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(MaxsimError);
    expect(err.message).toBe('test error');
    expect(err.name).toBe('MaxsimError');
    expect(err.recovery).toEqual(recovery);
  });
});

// ── VerificationError ─────────────────────────────────────────────────────────

describe('VerificationError', () => {
  it('defaults to DEBUG tier', () => {
    const err = new VerificationError('test failed');
    expect(err).toBeInstanceOf(MaxsimError);
    expect(err.name).toBe('VerificationError');
    expect(err.recovery.tier).toBe(RecoveryTier.DEBUG);
  });

  it('allows overriding recovery fields', () => {
    const err = new VerificationError('critical', {
      tier: RecoveryTier.ESCALATE,
      suggestedAction: 'call the police',
    });
    expect(err.recovery.tier).toBe(RecoveryTier.ESCALATE);
    expect(err.recovery.suggestedAction).toBe('call the police');
  });

  it('uses message as reason when reason is not provided', () => {
    const err = new VerificationError('lint failed');
    expect(err.recovery.reason).toBe('lint failed');
  });
});

// ── GitError ──────────────────────────────────────────────────────────────────

describe('GitError', () => {
  it('defaults to ROLLBACK tier', () => {
    const err = new GitError('merge conflict');
    expect(err).toBeInstanceOf(MaxsimError);
    expect(err.name).toBe('GitError');
    expect(err.recovery.tier).toBe(RecoveryTier.ROLLBACK);
  });

  it('allows overriding recovery fields', () => {
    const err = new GitError('conflict', { tier: RecoveryTier.DEBUG });
    expect(err.recovery.tier).toBe(RecoveryTier.DEBUG);
  });
});

// ── GithubError ───────────────────────────────────────────────────────────────

describe('GithubError', () => {
  it('defaults to DEBUG tier', () => {
    const err = new GithubError('rate limited');
    expect(err).toBeInstanceOf(MaxsimError);
    expect(err.name).toBe('GithubError');
    expect(err.recovery.tier).toBe(RecoveryTier.DEBUG);
  });

  it('allows overriding recovery fields', () => {
    const err = new GithubError('unauthorized', {
      suggestedAction: 'refresh token',
    });
    expect(err.recovery.suggestedAction).toBe('refresh token');
  });
});

// ── EscalationError ───────────────────────────────────────────────────────────

describe('EscalationError', () => {
  it('defaults to ESCALATE tier', () => {
    const err = new EscalationError('max retries exceeded');
    expect(err).toBeInstanceOf(MaxsimError);
    expect(err.name).toBe('EscalationError');
    expect(err.recovery.tier).toBe(RecoveryTier.ESCALATE);
  });

  it('allows overriding recovery fields', () => {
    const err = new EscalationError('stuck', { tier: RecoveryTier.DEBUG });
    expect(err.recovery.tier).toBe(RecoveryTier.DEBUG);
  });
});

// ── classifyError ─────────────────────────────────────────────────────────────

describe('classifyError', () => {
  it('classifies git errors as ROLLBACK', () => {
    const result = classifyError(new Error('git push failed'));
    expect(result.tier).toBe(RecoveryTier.ROLLBACK);
  });

  it('classifies merge conflict errors as ROLLBACK', () => {
    const result = classifyError(new Error('merge conflict in file.ts'));
    expect(result.tier).toBe(RecoveryTier.ROLLBACK);
  });

  it('classifies rebase errors as ROLLBACK', () => {
    const result = classifyError(new Error('rebase aborted'));
    expect(result.tier).toBe(RecoveryTier.ROLLBACK);
  });

  it('classifies escalation keywords as ESCALATE', () => {
    const result = classifyError(new Error('escalation required'));
    expect(result.tier).toBe(RecoveryTier.ESCALATE);
  });

  it('classifies max retries as ESCALATE', () => {
    const result = classifyError(new Error('max retries exceeded'));
    expect(result.tier).toBe(RecoveryTier.ESCALATE);
  });

  it('classifies fatal errors as ESCALATE', () => {
    const result = classifyError(new Error('fatal: cannot proceed'));
    expect(result.tier).toBe(RecoveryTier.ESCALATE);
  });

  it('classifies rate limit errors as DEBUG', () => {
    const result = classifyError(new Error('rate limit exceeded'));
    expect(result.tier).toBe(RecoveryTier.DEBUG);
  });

  it('classifies GitHub API errors as DEBUG', () => {
    const result = classifyError(new Error('GitHub API returned 500'));
    expect(result.tier).toBe(RecoveryTier.DEBUG);
  });

  it('classifies unknown errors as DEBUG', () => {
    const result = classifyError(new Error('something went wrong'));
    expect(result.tier).toBe(RecoveryTier.DEBUG);
  });

  it('handles non-Error values', () => {
    const result = classifyError('string error');
    expect(result.tier).toBe(RecoveryTier.DEBUG);
    expect(result.reason).toBe('string error');
  });

  it('handles null/undefined', () => {
    const result = classifyError(null);
    expect(result.tier).toBe(RecoveryTier.DEBUG);
  });

  it('preserves the error message in the reason field', () => {
    const result = classifyError(new Error('git rebase failed'));
    expect(result.reason).toBe('git rebase failed');
  });
});
