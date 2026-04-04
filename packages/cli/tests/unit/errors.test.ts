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
import { cmdErr } from '../../src/core/types.js';

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

// ── CLI entry point error format ─────────────────────────────────────────────
// These tests verify the structured error output format used by cli.ts
// without spawning a subprocess. They replicate the exact formatting logic
// from main().catch() and handleCmdErr() in cli.ts.

describe('CLI error output format — MaxsimError path', () => {
  /**
   * Replicate the cli.ts MaxsimError catch branch:
   *   [ERROR:TIER] message\nSuggestion: suggestedAction\n
   */
  function formatMaxsimError(err: MaxsimError): string {
    const tier = err.recovery.tier.toUpperCase();
    let output = `[ERROR:${tier}] ${err.message}\n`;
    if (err.recovery.suggestedAction) {
      output += `Suggestion: ${err.recovery.suggestedAction}\n`;
    }
    return output;
  }

  it('formats MaxsimError with DEBUG tier as [ERROR:DEBUG] + Suggestion', () => {
    const err = new GithubError('rate limit hit', {
      suggestedAction: 'Wait 60 seconds and retry.',
    });
    const output = formatMaxsimError(err);
    expect(output).toContain('[ERROR:DEBUG]');
    expect(output).toContain('rate limit hit');
    expect(output).toContain('Suggestion: Wait 60 seconds and retry.');
  });

  it('formats MaxsimError with ROLLBACK tier as [ERROR:ROLLBACK] + Suggestion', () => {
    const err = new GitError('merge conflict in main.ts', {
      suggestedAction: 'Run: git merge --abort',
    });
    const output = formatMaxsimError(err);
    expect(output).toContain('[ERROR:ROLLBACK]');
    expect(output).toContain('merge conflict in main.ts');
    expect(output).toContain('Suggestion: Run: git merge --abort');
  });

  it('formats MaxsimError with ESCALATE tier as [ERROR:ESCALATE] + Suggestion', () => {
    const err = new EscalationError('max retries exceeded', {
      suggestedAction: 'Manual intervention required.',
    });
    const output = formatMaxsimError(err);
    expect(output).toContain('[ERROR:ESCALATE]');
    expect(output).toContain('max retries exceeded');
    expect(output).toContain('Suggestion: Manual intervention required.');
  });
});

describe('CLI error output format — generic Error via classifyError', () => {
  /**
   * Replicate the cli.ts generic error catch branch:
   *   const recovery = classifyError(err);
   *   [ERROR:TIER] message\nSuggestion: suggestedAction\n
   */
  function formatGenericError(err: unknown): string {
    const recovery = classifyError(err);
    const tier = recovery.tier.toUpperCase();
    const message = err instanceof Error ? err.message : String(err);
    let output = `[ERROR:${tier}] ${message}\n`;
    if (recovery.suggestedAction) {
      output += `Suggestion: ${recovery.suggestedAction}\n`;
    }
    return output;
  }

  it('classifies a git error and formats as [ERROR:ROLLBACK]', () => {
    const output = formatGenericError(new Error('git push rejected'));
    expect(output).toContain('[ERROR:ROLLBACK]');
    expect(output).toContain('git push rejected');
    expect(output).toContain('Suggestion:');
  });

  it('classifies an API error and formats as [ERROR:DEBUG]', () => {
    const output = formatGenericError(new Error('GitHub API rate limit'));
    expect(output).toContain('[ERROR:DEBUG]');
    expect(output).toContain('GitHub API rate limit');
    expect(output).toContain('Suggestion:');
  });

  it('classifies a fatal error and formats as [ERROR:ESCALATE]', () => {
    const output = formatGenericError(new Error('fatal: unrecoverable state'));
    expect(output).toContain('[ERROR:ESCALATE]');
    expect(output).toContain('fatal: unrecoverable state');
    expect(output).toContain('Suggestion:');
  });
});

describe('CLI error output format — cmdErr with recovery', () => {
  /**
   * Replicate the handleCmdErr() logic from cli.ts:
   *   if (result.recovery) → [ERROR:TIER] error\nSuggestion: action\n
   *   else → classifyError(result.error) → same format
   */
  function formatCmdErr(result: { ok: false; error: string; recovery?: ErrorRecovery }): string {
    if (result.recovery) {
      const tier = result.recovery.tier.toUpperCase();
      let output = `[ERROR:${tier}] ${result.error}\n`;
      if (result.recovery.suggestedAction) {
        output += `Suggestion: ${result.recovery.suggestedAction}\n`;
      }
      return output;
    }
    const recovery = classifyError(result.error);
    const tier = recovery.tier.toUpperCase();
    let output = `[ERROR:${tier}] ${result.error}\n`;
    if (recovery.suggestedAction) {
      output += `Suggestion: ${recovery.suggestedAction}\n`;
    }
    return output;
  }

  it('cmdErr with explicit recovery produces structured [ERROR:TIER] + Suggestion', () => {
    const result = cmdErr('disk full', {
      tier: RecoveryTier.ESCALATE,
      reason: 'disk full',
      suggestedAction: 'Free disk space and retry.',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const output = formatCmdErr(result);
      expect(output).toContain('[ERROR:ESCALATE]');
      expect(output).toContain('disk full');
      expect(output).toContain('Suggestion: Free disk space and retry.');
    }
  });

  it('cmdErr without recovery falls back to classifyError for the tier', () => {
    const result = cmdErr('git merge failed unexpectedly');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.recovery).toBeUndefined();
      const output = formatCmdErr(result);
      // classifyError sees "git" → ROLLBACK
      expect(output).toContain('[ERROR:ROLLBACK]');
      expect(output).toContain('git merge failed unexpectedly');
      expect(output).toContain('Suggestion:');
    }
  });

  it('cmdErr with DEBUG recovery includes the action hint', () => {
    const result = cmdErr('token expired', {
      tier: RecoveryTier.DEBUG,
      reason: 'token expired',
      suggestedAction: 'Run: gh auth refresh',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const output = formatCmdErr(result);
      expect(output).toContain('[ERROR:DEBUG]');
      expect(output).toContain('Suggestion: Run: gh auth refresh');
    }
  });
});
