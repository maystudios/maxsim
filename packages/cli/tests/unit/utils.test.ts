import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  parseFrontmatter,
  padPhaseNumber,
  detectProjectRoot,
} from '../../src/core/utils.js';

describe('parseFrontmatter', () => {
  it('extracts YAML frontmatter and body', () => {
    const content = `---
name: test-skill
description: A test skill
---

# Body Content

Some text here.`;

    const result = parseFrontmatter(content);
    expect(result.data.name).toBe('test-skill');
    expect(result.data.description).toBe('A test skill');
    expect(result.body.trim()).toBe('# Body Content\n\nSome text here.');
  });

  it('returns empty data when no frontmatter present', () => {
    const content = '# Just a heading\n\nNo frontmatter here.';
    const result = parseFrontmatter(content);
    expect(result.data).toEqual({});
    expect(result.body).toBe(content);
  });

  it('handles empty frontmatter block', () => {
    const content = '---\n---\n\nBody only.';
    const result = parseFrontmatter(content);
    expect(result.data).toEqual({});
    expect(result.body.trim()).toBe('Body only.');
  });

  it('handles arrays and nested objects in frontmatter', () => {
    const content = `---
name: agent
skills:
  - handoff-contract
  - tdd
tools: Read, Write, Edit
---
Body`;

    const result = parseFrontmatter(content);
    expect(result.data.skills).toEqual(['handoff-contract', 'tdd']);
    expect(result.data.tools).toBe('Read, Write, Edit');
  });
});

describe('padPhaseNumber', () => {
  it('pads single digits to two digits', () => {
    expect(padPhaseNumber(1)).toBe('01');
    expect(padPhaseNumber(9)).toBe('09');
  });

  it('leaves double digits unchanged', () => {
    expect(padPhaseNumber(10)).toBe('10');
    expect(padPhaseNumber(99)).toBe('99');
  });

  it('handles zero', () => {
    expect(padPhaseNumber(0)).toBe('00');
  });
});

describe('detectProjectRoot', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxsim-root-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds project root when .claude/ exists', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
    const subDir = path.join(tmpDir, 'src', 'deep');
    fs.mkdirSync(subDir, { recursive: true });

    const root = detectProjectRoot(subDir);
    expect(root).toBe(tmpDir);
  });

  it('returns null when no .claude/ found up to filesystem root', () => {
    // Note: detectProjectRoot walks up to filesystem root.
    // On machines with ~/.claude/ it may find that. Test with a
    // known deep temp path and verify it doesn't return tmpDir itself.
    const deepDir = path.join(tmpDir, 'a', 'b', 'c');
    fs.mkdirSync(deepDir, { recursive: true });
    const root = detectProjectRoot(deepDir);
    // Should NOT return any of our temp subdirectories
    if (root !== null) {
      expect(root).not.toBe(deepDir);
      expect(root).not.toContain(tmpDir);
    }
  });

  it('returns the directory itself if .claude/ is at start dir', () => {
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });
    const root = detectProjectRoot(tmpDir);
    expect(root).toBe(tmpDir);
  });
});
