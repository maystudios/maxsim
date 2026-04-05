/**
 * Pure validation functions for task completion verification.
 *
 * Used by the task-completed hook to enforce spec compliance:
 * - Evidence block validation (CLAIM / EVIDENCE / OUTPUT / VERDICT markers)
 * - Forbidden phrase detection (hand-wavy assertions that bypass verification)
 * - Combined completion claim validation across multiple text sources
 */

/** Phrases that indicate hand-wavy reasoning and bypass proper verification. */
export const FORBIDDEN_PHRASES: readonly string[] = [
  'should work',
  'I already checked',
  'tests were passing before',
  'this is obviously correct',
  "I think it's fine",
  'the logic is sound',
  'nothing changed in that area',
  'it worked in my local run',
  'we can verify later',
  'this is low risk',
] as const;

/** Required markers for structured evidence blocks. */
export const REQUIRED_EVIDENCE_MARKERS: readonly string[] = [
  'CLAIM:',
  'EVIDENCE:',
  'OUTPUT:',
  'VERDICT:',
] as const;

/** Result of a validation check. */
export interface ValidationResult {
  passed: boolean;
  issues: string[];
}

/** Result of a combined completion claim validation. */
export interface CompletionClaimResult {
  passed: boolean;
  evidenceCheck: ValidationResult;
  forbiddenPhraseCheck: ValidationResult;
  /** Which text sources were checked (for diagnostics). */
  sourcesChecked: string[];
  /** Combined issues from all checks. */
  issues: string[];
}

/**
 * Validate that all required evidence markers are present in the text.
 * Empty text is treated as a pass (no false positives on absent content).
 */
export function validateEvidenceBlocks(text: string): ValidationResult {
  if (!text.trim()) {
    return { passed: true, issues: [] };
  }

  const lower = text.toLowerCase();
  const missing = REQUIRED_EVIDENCE_MARKERS.filter(
    (marker) => !lower.includes(marker.toLowerCase()),
  );

  if (missing.length === 0) {
    return { passed: true, issues: [] };
  }

  return {
    passed: false,
    issues: [`Missing evidence markers: ${missing.join(', ')}`],
  };
}

/**
 * Validate evidence markers across multiple text sources.
 *
 * Combines all non-empty sources into a single text block before checking.
 * This ensures that evidence spread across different payload fields is still
 * detected, while also catching the case where NO field contains evidence.
 *
 * Returns a pass if:
 * - All sources are empty/blank (no false positives on absent content), OR
 * - The combined text contains all required evidence markers.
 */
export function validateEvidenceBlocksMulti(sources: string[]): ValidationResult {
  const combined = sources.filter((s) => s.trim()).join('\n');
  return validateEvidenceBlocks(combined);
}

/**
 * Detect forbidden phrases in the text.
 * Empty text is treated as a pass (no false positives on absent content).
 */
export function detectForbiddenPhrases(text: string): ValidationResult {
  if (!text.trim()) {
    return { passed: true, issues: [] };
  }

  const lower = text.toLowerCase();
  const found = FORBIDDEN_PHRASES.filter((phrase) =>
    lower.includes(phrase.toLowerCase()),
  );

  if (found.length === 0) {
    return { passed: true, issues: [] };
  }

  return {
    passed: false,
    issues: found.map((phrase) => `Forbidden phrase detected: "${phrase}"`),
  };
}

/**
 * Detect forbidden phrases across multiple text sources.
 *
 * Combines all non-empty sources before scanning. A forbidden phrase in
 * ANY source causes a failure.
 */
export function detectForbiddenPhrasesMulti(sources: string[]): ValidationResult {
  const combined = sources.filter((s) => s.trim()).join('\n');
  return detectForbiddenPhrases(combined);
}

/**
 * Combined validation: evidence block check + forbidden phrase check across
 * multiple named text sources.
 *
 * Used by the TaskCompleted hook for the spec_compliance gate.
 * Skipped when verification_profile is 'fast'.
 *
 * @param namedSources - Map of source name to text content.
 *   Example: { task_description: "...", task_context: "..." }
 *   Keys with empty/undefined values are silently skipped.
 *
 * @returns Structured result with individual check outcomes and combined issues.
 */
export function validateCompletionClaim(
  namedSources: Record<string, string | undefined | null>,
): CompletionClaimResult {
  const sourcesChecked: string[] = [];
  const textSources: string[] = [];

  for (const [name, text] of Object.entries(namedSources)) {
    if (text?.trim()) {
      sourcesChecked.push(name);
      textSources.push(text);
    }
  }

  const evidenceCheck = validateEvidenceBlocksMulti(textSources);
  const forbiddenPhraseCheck = detectForbiddenPhrasesMulti(textSources);

  const issues = [...evidenceCheck.issues, ...forbiddenPhraseCheck.issues];

  return {
    passed: evidenceCheck.passed && forbiddenPhraseCheck.passed,
    evidenceCheck,
    forbiddenPhraseCheck,
    sourcesChecked,
    issues,
  };
}
