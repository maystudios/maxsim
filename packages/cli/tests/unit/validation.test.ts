/**
 * Unit tests for hooks/validation.ts
 *
 * Tests the pure validation functions used by the task-completed hook
 * for spec compliance verification.
 */

import { describe, it, expect } from 'vitest';
import {
  FORBIDDEN_PHRASES,
  REQUIRED_EVIDENCE_MARKERS,
  validateEvidenceBlocks,
  validateEvidenceBlocksMulti,
  detectForbiddenPhrases,
  detectForbiddenPhrasesMulti,
  validateCompletionClaim,
} from '../../src/hooks/validation.js';

// ── Constants ─────────────────────────────────────────────────────────────────

describe('FORBIDDEN_PHRASES', () => {
  it('contains exactly 10 phrases', () => {
    expect(FORBIDDEN_PHRASES).toHaveLength(10);
  });

  it('includes all expected phrases', () => {
    const expected = [
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
    ];
    expect([...FORBIDDEN_PHRASES]).toEqual(expected);
  });
});

describe('REQUIRED_EVIDENCE_MARKERS', () => {
  it('contains exactly 4 markers', () => {
    expect(REQUIRED_EVIDENCE_MARKERS).toHaveLength(4);
  });

  it('includes CLAIM, EVIDENCE, OUTPUT, VERDICT', () => {
    expect([...REQUIRED_EVIDENCE_MARKERS]).toEqual([
      'CLAIM:',
      'EVIDENCE:',
      'OUTPUT:',
      'VERDICT:',
    ]);
  });
});

// ── validateEvidenceBlocks ────────────────────────────────────────────────────

describe('validateEvidenceBlocks', () => {
  it('passes when all markers are present', () => {
    const text = 'CLAIM: something\nEVIDENCE: proof\nOUTPUT: result\nVERDICT: pass';
    const result = validateEvidenceBlocks(text);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes for empty text (no false positives)', () => {
    const result = validateEvidenceBlocks('');
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes for whitespace-only text', () => {
    const result = validateEvidenceBlocks('   \n\t  ');
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('fails when markers are missing', () => {
    const text = 'CLAIM: something\nEVIDENCE: proof';
    const result = validateEvidenceBlocks(text);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain('OUTPUT:');
    expect(result.issues[0]).toContain('VERDICT:');
  });

  it('fails when all markers are missing from non-empty text', () => {
    const text = 'This is just some random text without any markers.';
    const result = validateEvidenceBlocks(text);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain('CLAIM:');
    expect(result.issues[0]).toContain('EVIDENCE:');
    expect(result.issues[0]).toContain('OUTPUT:');
    expect(result.issues[0]).toContain('VERDICT:');
  });

  it('is case-insensitive for marker detection', () => {
    const text = 'claim: something\nevidence: proof\noutput: result\nverdict: pass';
    const result = validateEvidenceBlocks(text);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects markers in mixed case', () => {
    const text = 'Claim: x\nEvidence: y\nOutput: z\nVerdict: w';
    const result = validateEvidenceBlocks(text);
    expect(result.passed).toBe(true);
  });
});

// ── detectForbiddenPhrases ────────────────────────────────────────────────────

describe('detectForbiddenPhrases', () => {
  it('passes when no forbidden phrases are present', () => {
    const text = 'CLAIM: The tests pass.\nEVIDENCE: See output below.\nOUTPUT: All green.\nVERDICT: Pass.';
    const result = detectForbiddenPhrases(text);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes for empty text (no false positives)', () => {
    const result = detectForbiddenPhrases('');
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes for whitespace-only text', () => {
    const result = detectForbiddenPhrases('   \n\t  ');
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('detects a single forbidden phrase', () => {
    const text = 'I think this should work based on my analysis.';
    const result = detectForbiddenPhrases(text);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain('should work');
  });

  it('detects multiple forbidden phrases', () => {
    const text = 'I already checked and the logic is sound, so this is low risk.';
    const result = detectForbiddenPhrases(text);
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });

  it('is case-insensitive', () => {
    const text = 'I ALREADY CHECKED and nothing will fail.';
    const result = detectForbiddenPhrases(text);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.toLowerCase().includes('i already checked'))).toBe(true);
  });

  it('detects "we can verify later"', () => {
    const text = 'We can verify later after deployment.';
    const result = detectForbiddenPhrases(text);
    expect(result.passed).toBe(false);
    expect(result.issues[0]).toContain('we can verify later');
  });

  it('detects "it worked in my local run"', () => {
    const text = 'It worked in my local run so it should be fine.';
    const result = detectForbiddenPhrases(text);
    expect(result.passed).toBe(false);
    // Should detect both "it worked in my local run" and "should work" — but "should work" is not the same as just "should"
    // Actually "should be fine" != "should work", so only 1 detection
    expect(result.issues.some((i) => i.includes('it worked in my local run'))).toBe(true);
  });
});

// ── validateEvidenceBlocksMulti ─────────────────────────────────────────────

describe('validateEvidenceBlocksMulti', () => {
  it('passes when all markers are spread across multiple sources', () => {
    const sources = [
      'CLAIM: something\nEVIDENCE: proof',
      'OUTPUT: result\nVERDICT: pass',
    ];
    const result = validateEvidenceBlocksMulti(sources);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('passes when all markers are in a single source among many', () => {
    const sources = [
      'some unrelated text',
      'CLAIM: x\nEVIDENCE: y\nOUTPUT: z\nVERDICT: w',
      'more text',
    ];
    const result = validateEvidenceBlocksMulti(sources);
    expect(result.passed).toBe(true);
  });

  it('fails when markers are missing across all sources', () => {
    const sources = ['CLAIM: something', 'some other text'];
    const result = validateEvidenceBlocksMulti(sources);
    expect(result.passed).toBe(false);
    expect(result.issues[0]).toContain('EVIDENCE:');
    expect(result.issues[0]).toContain('OUTPUT:');
    expect(result.issues[0]).toContain('VERDICT:');
  });

  it('passes for empty sources array', () => {
    const result = validateEvidenceBlocksMulti([]);
    expect(result.passed).toBe(true);
  });

  it('passes when all sources are blank', () => {
    const result = validateEvidenceBlocksMulti(['', '  ', '\n']);
    expect(result.passed).toBe(true);
  });
});

// ── detectForbiddenPhrasesMulti ─────────────────────────────────────────────

describe('detectForbiddenPhrasesMulti', () => {
  it('detects forbidden phrase in second source', () => {
    const sources = ['clean text', 'this should work fine'];
    const result = detectForbiddenPhrasesMulti(sources);
    expect(result.passed).toBe(false);
    expect(result.issues[0]).toContain('should work');
  });

  it('passes when no sources contain forbidden phrases', () => {
    const sources = ['proper evidence', 'clean completion notes'];
    const result = detectForbiddenPhrasesMulti(sources);
    expect(result.passed).toBe(true);
  });

  it('passes for empty sources array', () => {
    const result = detectForbiddenPhrasesMulti([]);
    expect(result.passed).toBe(true);
  });

  it('detects phrases spread across sources', () => {
    const sources = ['I already checked the code', 'and the logic is sound'];
    const result = detectForbiddenPhrasesMulti(sources);
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });
});

// ── validateCompletionClaim ─────────────────────────────────────────────────

describe('validateCompletionClaim', () => {
  it('passes when evidence markers present and no forbidden phrases', () => {
    const result = validateCompletionClaim({
      task_description: 'CLAIM: Tests pass\nEVIDENCE: npm test\nOUTPUT: All green\nVERDICT: PASS',
    });
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.sourcesChecked).toEqual(['task_description']);
  });

  it('fails when evidence markers are missing', () => {
    const result = validateCompletionClaim({
      task_description: 'I completed the task successfully.',
    });
    expect(result.passed).toBe(false);
    expect(result.evidenceCheck.passed).toBe(false);
    expect(result.forbiddenPhraseCheck.passed).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('fails when forbidden phrases are present', () => {
    const result = validateCompletionClaim({
      task_description: 'CLAIM: x\nEVIDENCE: y\nOUTPUT: z\nVERDICT: w\nThis should work',
    });
    expect(result.passed).toBe(false);
    expect(result.evidenceCheck.passed).toBe(true);
    expect(result.forbiddenPhraseCheck.passed).toBe(false);
  });

  it('fails when both checks fail', () => {
    const result = validateCompletionClaim({
      task_description: 'This should work, I already checked.',
    });
    expect(result.passed).toBe(false);
    expect(result.evidenceCheck.passed).toBe(false);
    expect(result.forbiddenPhraseCheck.passed).toBe(false);
    // Should have both evidence issues and forbidden phrase issues
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('passes when all sources are empty/undefined (no false positives)', () => {
    const result = validateCompletionClaim({
      task_description: undefined,
      task_context: null,
      task_subject: '',
    });
    expect(result.passed).toBe(true);
    expect(result.sourcesChecked).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it('checks multiple named sources and reports which were checked', () => {
    const result = validateCompletionClaim({
      task_description: 'CLAIM: x\nEVIDENCE: y',
      task_context: 'OUTPUT: z\nVERDICT: w',
      task_subject: '',
    });
    expect(result.passed).toBe(true);
    expect(result.sourcesChecked).toEqual(['task_description', 'task_context']);
  });

  it('detects evidence spread across different named sources', () => {
    const result = validateCompletionClaim({
      task_description: 'CLAIM: Tests pass',
      task_context: 'EVIDENCE: ran npm test',
      completion_notes: 'OUTPUT: 42 tests passed\nVERDICT: PASS',
    });
    expect(result.passed).toBe(true);
    expect(result.sourcesChecked).toContain('completion_notes');
  });

  it('detects forbidden phrase in any named source', () => {
    const result = validateCompletionClaim({
      task_description: 'CLAIM: x\nEVIDENCE: y\nOUTPUT: z\nVERDICT: w',
      task_context: 'We can verify later',
    });
    expect(result.passed).toBe(false);
    expect(result.forbiddenPhraseCheck.passed).toBe(false);
  });

  it('skips null and undefined values gracefully', () => {
    const result = validateCompletionClaim({
      task_description: null,
      task_context: undefined,
      task_subject: 'CLAIM: x\nEVIDENCE: y\nOUTPUT: z\nVERDICT: w',
    });
    expect(result.passed).toBe(true);
    expect(result.sourcesChecked).toEqual(['task_subject']);
  });
});
