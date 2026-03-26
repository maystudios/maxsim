/**
 * Structured error handling with recovery tiers.
 *
 * Every MaxsimError carries a recovery plan so callers can decide
 * whether to debug, rollback, or escalate without ad-hoc string matching.
 */

export const RecoveryTier = {
  DEBUG: 'debug',
  ROLLBACK: 'rollback',
  ESCALATE: 'escalate',
} as const;

export type RecoveryTier = (typeof RecoveryTier)[keyof typeof RecoveryTier];

export interface ErrorRecovery {
  tier: RecoveryTier;
  reason: string;
  suggestedAction: string;
}

export class MaxsimError extends Error {
  constructor(
    message: string,
    public readonly recovery: ErrorRecovery,
  ) {
    super(message);
    this.name = 'MaxsimError';
  }
}

export class VerificationError extends MaxsimError {
  constructor(
    message: string,
    recovery?: Partial<ErrorRecovery>,
  ) {
    super(message, {
      tier: recovery?.tier ?? RecoveryTier.DEBUG,
      reason: recovery?.reason ?? message,
      suggestedAction: recovery?.suggestedAction ?? 'Review verification output and fix failing checks.',
    });
    this.name = 'VerificationError';
  }
}

export class GitError extends MaxsimError {
  constructor(
    message: string,
    recovery?: Partial<ErrorRecovery>,
  ) {
    super(message, {
      tier: recovery?.tier ?? RecoveryTier.ROLLBACK,
      reason: recovery?.reason ?? message,
      suggestedAction: recovery?.suggestedAction ?? 'Rollback the failed git operation and retry.',
    });
    this.name = 'GitError';
  }
}

export class GithubError extends MaxsimError {
  constructor(
    message: string,
    recovery?: Partial<ErrorRecovery>,
  ) {
    super(message, {
      tier: recovery?.tier ?? RecoveryTier.DEBUG,
      reason: recovery?.reason ?? message,
      suggestedAction: recovery?.suggestedAction ?? 'Check GitHub API credentials and rate limits.',
    });
    this.name = 'GithubError';
  }
}

export class EscalationError extends MaxsimError {
  constructor(
    message: string,
    recovery?: Partial<ErrorRecovery>,
  ) {
    super(message, {
      tier: recovery?.tier ?? RecoveryTier.ESCALATE,
      reason: recovery?.reason ?? message,
      suggestedAction: recovery?.suggestedAction ?? 'Escalate to a human for manual review.',
    });
    this.name = 'EscalationError';
  }
}

/**
 * Classify an unknown error into a recovery plan based on message keywords.
 * Falls back to DEBUG tier for unrecognised errors.
 */
export function classifyError(error: unknown): ErrorRecovery {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // GitHub API errors (check before git — "github" contains "git")
  if (lower.includes('rate limit') || lower.includes('api') || lower.includes('octokit') || lower.includes('github')) {
    return {
      tier: RecoveryTier.DEBUG,
      reason: message,
      suggestedAction: 'Check GitHub API credentials and rate limits.',
    };
  }

  // Git-related errors → rollback
  if (lower.includes('git') || lower.includes('merge conflict') || lower.includes('rebase')) {
    return {
      tier: RecoveryTier.ROLLBACK,
      reason: message,
      suggestedAction: 'Rollback the failed git operation and retry.',
    };
  }

  // Escalation keywords
  if (lower.includes('escalat') || lower.includes('max retries') || lower.includes('fatal')) {
    return {
      tier: RecoveryTier.ESCALATE,
      reason: message,
      suggestedAction: 'Escalate to a human for manual review.',
    };
  }

  // Default: debug
  return {
    tier: RecoveryTier.DEBUG,
    reason: message,
    suggestedAction: 'Inspect the error output and debug the root cause.',
  };
}
