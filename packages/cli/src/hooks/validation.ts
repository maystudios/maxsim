/**
 * Pure validation functions for task completion verification.
 *
 * Used by the task-completed hook to enforce spec compliance:
 * - Evidence block validation (CLAIM / EVIDENCE / OUTPUT / VERDICT markers)
 * - Forbidden phrase detection (hand-wavy assertions that bypass verification)
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
