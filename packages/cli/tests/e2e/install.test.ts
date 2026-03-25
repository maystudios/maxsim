/**
 * E2E: Full install / uninstall cycle on a real temp directory.
 *
 * These tests exercise the real file-system operations performed by
 * `runInstall` and `uninstall` without mocking. They do NOT require
 * a GitHub token because the install flow only checks `gh auth status`
 * (which we skip here by calling the underlying functions directly).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createTempDir, removeTempDir } from './setup.js';
import { copyDir, getTemplatesDir } from '../../src/install/copy.js';
import { writeClaudeMd } from '../../src/install/claudemd.js';
import { uninstall } from '../../src/install/uninstall.js';
import { ensureGitignoreEntries } from '../../src/install/index.js';
import { writeManifest, readManifest } from '../../src/install/manifest.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = createTempDir();
});

afterEach(() => {
  removeTempDir(tmpDir);
});

// ── Install Cycle ────────────────────────────────────────────────────

describe('install → uninstall cycle', () => {
  it('copies template directories into .claude/', () => {
    const templatesDir = getTemplatesDir();
    if (!fs.existsSync(templatesDir)) {
      // In a CI environment without built assets, skip gracefully.
      console.warn('Skipping: template assets not found (not built?)');
      return;
    }

    const claudeDir = path.join(tmpDir, '.claude');
    const copies = [
      { src: path.join(templatesDir, 'commands'), dest: path.join(claudeDir, 'commands') },
      { src: path.join(templatesDir, 'agents'), dest: path.join(claudeDir, 'agents') },
      { src: path.join(templatesDir, 'skills'), dest: path.join(claudeDir, 'skills') },
      { src: path.join(templatesDir, 'rules'), dest: path.join(claudeDir, 'rules') },
      { src: path.join(templatesDir, 'workflows'), dest: path.join(claudeDir, 'maxsim', 'workflows') },
      { src: path.join(templatesDir, 'references'), dest: path.join(claudeDir, 'maxsim', 'references') },
      { src: path.join(templatesDir, 'templates'), dest: path.join(claudeDir, 'maxsim', 'templates') },
    ];

    let totalFiles = 0;
    const installedFiles: string[] = [];

    for (const { src, dest } of copies) {
      const count = copyDir(src, dest);
      totalFiles += count;
      // Collect files for the manifest
      if (fs.existsSync(dest)) {
        collectFiles(tmpDir, dest, installedFiles);
      }
    }

    expect(totalFiles).toBeGreaterThan(0);
    expect(fs.existsSync(claudeDir)).toBe(true);

    // Verify at least one expected subdirectory exists
    const hasCommands = fs.existsSync(path.join(claudeDir, 'commands'));
    const hasWorkflows = fs.existsSync(path.join(claudeDir, 'maxsim', 'workflows'));
    expect(hasCommands || hasWorkflows).toBe(true);
  });

  it('writes CLAUDE.md in the project root', () => {
    writeClaudeMd(tmpDir, 'e2e-test-project');

    const claudeMdPath = path.join(tmpDir, 'CLAUDE.md');
    expect(fs.existsSync(claudeMdPath)).toBe(true);

    const content = fs.readFileSync(claudeMdPath, 'utf8');
    expect(content).toContain('e2e-test-project');
    expect(content).toContain('MaxsimCLI');
    expect(content).toContain('/maxsim:');
  });

  it('adds .gitignore entries', () => {
    ensureGitignoreEntries(tmpDir, ['.claude/agent-memory/', 'autoresearch-results.tsv']);

    const gitignorePath = path.join(tmpDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);

    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toContain('.claude/agent-memory/');
    expect(content).toContain('autoresearch-results.tsv');
    expect(content).toContain('# MaxsimCLI');
  });

  it('does not duplicate .gitignore entries on re-run', () => {
    ensureGitignoreEntries(tmpDir, ['.claude/agent-memory/']);
    ensureGitignoreEntries(tmpDir, ['.claude/agent-memory/']);

    const content = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8');
    const matches = content.match(/\.claude\/agent-memory\//g);
    expect(matches).toHaveLength(1);
  });

  it('writes and reads back the manifest correctly', () => {
    const files = ['commands/go.md', 'agents/planner.md', 'skills/debug.md'];
    writeManifest(tmpDir, files);

    const read = readManifest(tmpDir);
    expect(read).toEqual(files);
  });

  it('uninstall removes installed directories and CLAUDE.md', () => {
    const claudeDir = path.join(tmpDir, '.claude');

    // Simulate a minimal install
    fs.mkdirSync(path.join(claudeDir, 'maxsim', 'workflows'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'commands', 'maxsim'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'rules'), { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'maxsim', 'workflows', 'go.md'), 'test');
    fs.writeFileSync(path.join(claudeDir, 'commands', 'maxsim', 'go.md'), 'test');
    fs.writeFileSync(path.join(claudeDir, 'agents', 'planner.md'), 'test');
    fs.writeFileSync(path.join(claudeDir, 'skills', 'debug.md'), 'test');
    fs.writeFileSync(path.join(claudeDir, 'rules', 'rule1.md'), 'test');
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# MaxsimCLI Project\nInstalled.');

    const result = uninstall(tmpDir);

    expect(result.removedDirs.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(claudeDir, 'maxsim'))).toBe(false);
    expect(fs.existsSync(path.join(claudeDir, 'agents'))).toBe(false);
    expect(fs.existsSync(path.join(claudeDir, 'skills'))).toBe(false);
    expect(fs.existsSync(path.join(claudeDir, 'rules'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('uninstall preserves CLAUDE.md that was not generated by maxsim', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# My Custom Instructions\nDo not remove.');

    uninstall(tmpDir);

    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
    const content = fs.readFileSync(path.join(tmpDir, 'CLAUDE.md'), 'utf8');
    expect(content).toContain('My Custom Instructions');
  });

  it('uninstall on a clean directory does not throw', () => {
    const result = uninstall(tmpDir);
    expect(result.removedDirs).toHaveLength(0);
    expect(result.removedFiles).toHaveLength(0);
  });

  it('full round-trip: install then uninstall leaves no maxsim artifacts', () => {
    const claudeDir = path.join(tmpDir, '.claude');

    // Simulate install
    fs.mkdirSync(path.join(claudeDir, 'maxsim', 'workflows'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'maxsim', 'references'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'maxsim', 'templates'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'maxsim', 'bin'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'commands', 'maxsim'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'skills'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'rules'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'agent-memory', 'maxsim-learner'), { recursive: true });

    fs.writeFileSync(path.join(claudeDir, 'maxsim', 'workflows', 'go.md'), 'workflow');
    fs.writeFileSync(path.join(claudeDir, 'commands', 'maxsim', 'go.md'), 'cmd');
    fs.writeFileSync(path.join(claudeDir, 'agents', 'planner.md'), 'agent');
    fs.writeFileSync(path.join(claudeDir, 'skills', 'debug.md'), 'skill');
    fs.writeFileSync(path.join(claudeDir, 'rules', 'rule.md'), 'rule');

    writeClaudeMd(tmpDir, 'roundtrip-test');
    ensureGitignoreEntries(tmpDir, ['.claude/agent-memory/']);

    // Uninstall
    uninstall(tmpDir);

    // Verify maxsim-specific dirs are gone
    expect(fs.existsSync(path.join(claudeDir, 'maxsim'))).toBe(false);
    expect(fs.existsSync(path.join(claudeDir, 'agents'))).toBe(false);
    expect(fs.existsSync(path.join(claudeDir, 'skills'))).toBe(false);
    expect(fs.existsSync(path.join(claudeDir, 'rules'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);

    // The .claude dir itself may or may not remain (that's fine)
    // The .gitignore should remain (it's not maxsim-managed)
    expect(fs.existsSync(path.join(tmpDir, '.gitignore'))).toBe(true);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────

/** Recursively collect file paths under `dir`, relative to `root`. */
function collectFiles(root: string, dir: string, out: string[]): void {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(root, full, out);
    } else {
      out.push(path.relative(root, full));
    }
  }
}
