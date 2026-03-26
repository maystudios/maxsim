import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Hoist mock before imports so the factory runs before module resolution
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { copyDir, removeDir, processTemplate, isTextTemplate } from '../../src/install/copy.js';
import { generateClaudeMd, writeClaudeMd } from '../../src/install/claudemd.js';
import { uninstall } from '../../src/install/uninstall.js';
import { checkGhAuth } from '../../src/install/gh-auth.js';
import { checkNodeVersion, ensureGitignoreEntries, detectRepoInfo, gatherTemplateVars } from '../../src/install/index.js';

const mockExecFileSync = execFileSync as ReturnType<typeof vi.fn>;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxsim-install-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

/** Temporarily override `process.versions.node` for the duration of `fn`. */
function withNodeVersion<T>(version: string, fn: () => T): T {
  const original = process.versions;
  Object.defineProperty(process, 'versions', {
    value: { ...original, node: version },
    configurable: true,
  });
  try {
    return fn();
  } finally {
    Object.defineProperty(process, 'versions', { value: original, configurable: true });
  }
}

describe('checkNodeVersion', () => {
  it('does not exit when the current Node.js major version meets the minimum', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    checkNodeVersion(22);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('does not exit when minMajor is set lower than the current version', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    checkNodeVersion(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('calls process.exit(1) when the major version is below the minimum', () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    withNodeVersion('18.20.0', () => checkNodeVersion(22));

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('MaxsimCLI requires Node.js >= 22'),
    );
  });

  it('prints the current Node version in the error message', () => {
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    withNodeVersion('16.0.0', () => checkNodeVersion(22));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('16.0.0'));
  });

  it('returns 0 for non-existent source', () => {
    expect(copyDir('/nonexistent/path', path.join(tmpDir, 'dest'))).toBe(0);
  });
});


describe('removeDir', () => {
  it('removes a directory recursively', () => {
    const dir = path.join(tmpDir, 'removeme');
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'sub', 'file.txt'), 'x');

    removeDir(dir);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('does nothing for non-existent directory', () => {
    removeDir(path.join(tmpDir, 'nope'));
    // No error thrown
  });
});

describe('generateClaudeMd', () => {
  it('generates markdown with project name', () => {
    const md = generateClaudeMd('my-project');
    expect(md).toContain('# my-project');
    expect(md).toContain('MaxsimCLI');
    expect(md).toContain('/maxsim:go');
    expect(md).toContain('/maxsim:init');
    expect(md).toContain('/maxsim:plan');
    expect(md).toContain('/maxsim:execute');
  });

  it('includes all 14 commands', () => {
    const md = generateClaudeMd('test');
    const commands = [':go', ':init', ':plan', ':execute', ':debug', ':quick', ':improve', ':fix-loop', ':debug-loop', ':security', ':progress', ':settings', ':help'];
    for (const cmd of commands) {
      expect(md).toContain(cmd);
    }
  });
});

describe('writeClaudeMd', () => {
  it('creates CLAUDE.md in project root', () => {
    writeClaudeMd(tmpDir, 'test-project');
    const filePath = path.join(tmpDir, 'CLAUDE.md');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toContain('test-project');
  });

  it('appends to existing CLAUDE.md that is not ours', () => {
    const filePath = path.join(tmpDir, 'CLAUDE.md');
    fs.writeFileSync(filePath, '# Existing Content\n\nDo not remove.');

    writeClaudeMd(tmpDir, 'test-project');

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('Existing Content');
    expect(content).toContain('MaxsimCLI');
  });

  it('overwrites CLAUDE.md that is ours', () => {
    const filePath = path.join(tmpDir, 'CLAUDE.md');
    fs.writeFileSync(filePath, '# Old MaxsimCLI content\n\nOld stuff.');

    writeClaudeMd(tmpDir, 'new-project');

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('new-project');
    expect(content).not.toContain('Old stuff');
  });
});

describe('checkGhAuth', () => {
  it('returns ok:false with install message when gh is not found', () => {
    mockExecFileSync.mockImplementation(() => {
      const err = new Error('spawn gh ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    });
    const result = checkGhAuth();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not installed');
  });

  it('returns ok:false with auth message when gh auth fails', () => {
    mockExecFileSync.mockImplementation(() => {
      const err = new Error('Command failed') as Error & { status: number };
      err.status = 1;
      throw err;
    });
    const result = checkGhAuth();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('gh auth login');
  });

  it('returns ok:true when gh auth succeeds', () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));
    const result = checkGhAuth();
    expect(result.ok).toBe(true);
  });
});

describe('uninstall', () => {
  it('removes MaxsimCLI directories', () => {
    const claudeDir = path.join(tmpDir, '.claude');
    fs.mkdirSync(path.join(claudeDir, 'maxsim', 'workflows'), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, 'commands', 'maxsim'), { recursive: true });
    fs.writeFileSync(path.join(claudeDir, 'maxsim', 'workflows', 'go.md'), 'test');
    fs.writeFileSync(path.join(claudeDir, 'commands', 'maxsim', 'go.md'), 'test');

    const result = uninstall(tmpDir);
    expect(result.removedDirs.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(claudeDir, 'maxsim'))).toBe(false);
  });

  it('removes CLAUDE.md if generated by MaxsimCLI', () => {
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# MaxsimCLI project');
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });

    const result = uninstall(tmpDir);
    expect(result.removedFiles).toContain(path.join(tmpDir, 'CLAUDE.md'));
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(false);
  });

  it('does not remove CLAUDE.md if not ours', () => {
    fs.writeFileSync(path.join(tmpDir, 'CLAUDE.md'), '# My custom instructions');
    fs.mkdirSync(path.join(tmpDir, '.claude'), { recursive: true });

    uninstall(tmpDir);
    expect(fs.existsSync(path.join(tmpDir, 'CLAUDE.md'))).toBe(true);
  });
});

describe('ensureGitignoreEntries', () => {
  it('adds entries to an empty .gitignore', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, '', 'utf8');

    ensureGitignoreEntries(tmpDir, ['.claude/agent-memory/', 'autoresearch-results.tsv']);

    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toContain('.claude/agent-memory/');
    expect(content).toContain('autoresearch-results.tsv');
    expect(content).toContain('# MaxsimCLI');
  });

  it('skips entries already present in .gitignore', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    fs.writeFileSync(gitignorePath, '.claude/agent-memory/\nautoresearch-results.tsv\n', 'utf8');

    ensureGitignoreEntries(tmpDir, ['.claude/agent-memory/', 'autoresearch-results.tsv']);

    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toBe('.claude/agent-memory/\nautoresearch-results.tsv\n');
  });

  it('creates .gitignore if it does not exist', () => {
    const gitignorePath = path.join(tmpDir, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(false);

    ensureGitignoreEntries(tmpDir, ['.claude/agent-memory/', 'autoresearch-results.tsv']);

    expect(fs.existsSync(gitignorePath)).toBe(true);
    const content = fs.readFileSync(gitignorePath, 'utf8');
    expect(content).toContain('.claude/agent-memory/');
    expect(content).toContain('autoresearch-results.tsv');
    expect(content).toContain('# MaxsimCLI');
  });
});

describe('processTemplate', () => {
  it('replaces known template variables', () => {
    const input = 'Project: {{PROJECT_NAME}}, Version: {{MAXSIM_VERSION}}';
    const result = processTemplate(input, {
      PROJECT_NAME: 'my-app',
      MAXSIM_VERSION: '1.0.0',
    });
    expect(result).toBe('Project: my-app, Version: 1.0.0');
  });

  it('leaves unknown placeholders untouched', () => {
    const input = 'Owner: {{REPO_OWNER}}, Unknown: {{UNKNOWN_VAR}}';
    const result = processTemplate(input, { REPO_OWNER: 'acme' });
    expect(result).toBe('Owner: acme, Unknown: {{UNKNOWN_VAR}}');
  });

  it('leaves placeholders untouched when variable is empty string', () => {
    const input = 'Name: {{PROJECT_NAME}}';
    const result = processTemplate(input, { PROJECT_NAME: '' });
    expect(result).toBe('Name: {{PROJECT_NAME}}');
  });

  it('handles content with no placeholders', () => {
    const input = 'No placeholders here.';
    const result = processTemplate(input, { PROJECT_NAME: 'test' });
    expect(result).toBe('No placeholders here.');
  });

  it('handles empty content', () => {
    const result = processTemplate('', { PROJECT_NAME: 'test' });
    expect(result).toBe('');
  });

  it('handles empty vars object', () => {
    const input = 'Keep {{PROJECT_NAME}} as-is';
    const result = processTemplate(input, {});
    expect(result).toBe('Keep {{PROJECT_NAME}} as-is');
  });

  it('replaces multiple occurrences of the same variable', () => {
    const input = '{{PROJECT_NAME}} is {{PROJECT_NAME}}';
    const result = processTemplate(input, { PROJECT_NAME: 'cool' });
    expect(result).toBe('cool is cool');
  });

  it('replaces all supported variable types', () => {
    const input = '{{PROJECT_NAME}} {{REPO_OWNER}} {{REPO_NAME}} {{MAXSIM_VERSION}}';
    const result = processTemplate(input, {
      PROJECT_NAME: 'app',
      REPO_OWNER: 'org',
      REPO_NAME: 'repo',
      MAXSIM_VERSION: '2.0.0',
    });
    expect(result).toBe('app org repo 2.0.0');
  });
});

describe('isTextTemplate', () => {
  it('returns true for .md files', () => {
    expect(isTextTemplate('readme.md')).toBe(true);
  });

  it('returns true for .json files', () => {
    expect(isTextTemplate('config.json')).toBe(true);
  });

  it('returns true for .yaml files', () => {
    expect(isTextTemplate('config.yaml')).toBe(true);
  });

  it('returns true for .yml files', () => {
    expect(isTextTemplate('config.yml')).toBe(true);
  });

  it('returns true for .txt files', () => {
    expect(isTextTemplate('notes.txt')).toBe(true);
  });

  it('returns false for .js files', () => {
    expect(isTextTemplate('script.js')).toBe(false);
  });

  it('returns false for .png files', () => {
    expect(isTextTemplate('image.png')).toBe(false);
  });

  it('returns false for .cjs files', () => {
    expect(isTextTemplate('bundle.cjs')).toBe(false);
  });

  it('is case-insensitive for extensions', () => {
    expect(isTextTemplate('README.MD')).toBe(true);
    expect(isTextTemplate('config.JSON')).toBe(true);
  });
});

describe('copyDir with template substitution', () => {
  it('substitutes template variables in text files', () => {
    const srcDir = path.join(tmpDir, 'src');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'readme.md'),
      '# {{PROJECT_NAME}}\n\nVersion: {{MAXSIM_VERSION}}',
    );

    copyDir(srcDir, destDir, { PROJECT_NAME: 'my-app', MAXSIM_VERSION: '1.0.0' });

    const content = fs.readFileSync(path.join(destDir, 'readme.md'), 'utf8');
    expect(content).toBe('# my-app\n\nVersion: 1.0.0');
  });

  it('substitutes variables in .json files', () => {
    const srcDir = path.join(tmpDir, 'src');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'config.json'),
      '{"name": "{{PROJECT_NAME}}"}',
    );

    copyDir(srcDir, destDir, { PROJECT_NAME: 'my-app' });

    const content = fs.readFileSync(path.join(destDir, 'config.json'), 'utf8');
    expect(content).toBe('{"name": "my-app"}');
  });

  it('does not process non-text files', () => {
    const srcDir = path.join(tmpDir, 'src');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });

    // Write a .cjs file with template placeholders — should be copied as-is
    fs.writeFileSync(
      path.join(srcDir, 'script.cjs'),
      'const name = "{{PROJECT_NAME}}";',
    );

    copyDir(srcDir, destDir, { PROJECT_NAME: 'my-app' });

    const content = fs.readFileSync(path.join(destDir, 'script.cjs'), 'utf8');
    expect(content).toBe('const name = "{{PROJECT_NAME}}";');
  });

  it('leaves missing variables as-is in text files', () => {
    const srcDir = path.join(tmpDir, 'src');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'readme.md'),
      '{{PROJECT_NAME}} by {{REPO_OWNER}}',
    );

    // Only provide PROJECT_NAME, not REPO_OWNER
    copyDir(srcDir, destDir, { PROJECT_NAME: 'my-app' });

    const content = fs.readFileSync(path.join(destDir, 'readme.md'), 'utf8');
    expect(content).toBe('my-app by {{REPO_OWNER}}');
  });

  it('copies files without substitution when no templateVars provided', () => {
    const srcDir = path.join(tmpDir, 'src');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'readme.md'),
      '# {{PROJECT_NAME}}',
    );

    copyDir(srcDir, destDir);

    const content = fs.readFileSync(path.join(destDir, 'readme.md'), 'utf8');
    expect(content).toBe('# {{PROJECT_NAME}}');
  });

  it('processes text files in nested directories', () => {
    const srcDir = path.join(tmpDir, 'src');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(path.join(srcDir, 'sub', 'deep'), { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, 'sub', 'deep', 'notes.txt'),
      'Repo: {{REPO_OWNER}}/{{REPO_NAME}}',
    );

    copyDir(srcDir, destDir, { REPO_OWNER: 'acme', REPO_NAME: 'widget' });

    const content = fs.readFileSync(path.join(destDir, 'sub', 'deep', 'notes.txt'), 'utf8');
    expect(content).toBe('Repo: acme/widget');
  });

  it('handles mixed text and binary files', () => {
    const srcDir = path.join(tmpDir, 'src');
    const destDir = path.join(tmpDir, 'dest');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'doc.md'), '# {{PROJECT_NAME}}');
    fs.writeFileSync(path.join(srcDir, 'bin.wasm'), Buffer.from([0x00, 0x61, 0x73, 0x6d]));

    const count = copyDir(srcDir, destDir, { PROJECT_NAME: 'test' });

    expect(count).toBe(2);
    expect(fs.readFileSync(path.join(destDir, 'doc.md'), 'utf8')).toBe('# test');
    // Binary file should be identical
    expect(Buffer.compare(
      fs.readFileSync(path.join(destDir, 'bin.wasm')),
      Buffer.from([0x00, 0x61, 0x73, 0x6d]),
    )).toBe(0);
  });
});

describe('detectRepoInfo', () => {
  it('parses HTTPS GitHub remote URL', () => {
    mockExecFileSync.mockReturnValue('https://github.com/acme/widget.git\n');
    const result = detectRepoInfo(tmpDir);
    expect(result).toEqual({ owner: 'acme', repo: 'widget' });
  });

  it('parses SSH GitHub remote URL', () => {
    mockExecFileSync.mockReturnValue('git@github.com:acme/widget.git\n');
    const result = detectRepoInfo(tmpDir);
    expect(result).toEqual({ owner: 'acme', repo: 'widget' });
  });

  it('parses HTTPS URL without .git suffix', () => {
    mockExecFileSync.mockReturnValue('https://github.com/acme/widget\n');
    const result = detectRepoInfo(tmpDir);
    expect(result).toEqual({ owner: 'acme', repo: 'widget' });
  });

  it('returns null when git command fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('not a git repo');
    });
    const result = detectRepoInfo(tmpDir);
    expect(result).toBeNull();
  });

  it('returns null for non-GitHub remotes', () => {
    mockExecFileSync.mockReturnValue('https://gitlab.com/acme/widget.git\n');
    const result = detectRepoInfo(tmpDir);
    expect(result).toBeNull();
  });
});

describe('gatherTemplateVars', () => {
  it('includes project name from package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-app' }),
    );
    // Mock git remote to fail (no repo info)
    mockExecFileSync.mockImplementation(() => { throw new Error('no git'); });

    const vars = gatherTemplateVars(tmpDir);
    expect(vars.PROJECT_NAME).toBe('my-app');
    expect(vars.MAXSIM_VERSION).toBeDefined();
    expect(vars.REPO_OWNER).toBeUndefined();
    expect(vars.REPO_NAME).toBeUndefined();
  });

  it('includes repo info when git remote is available', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-app' }),
    );
    mockExecFileSync.mockReturnValue('https://github.com/acme/widget.git\n');

    const vars = gatherTemplateVars(tmpDir);
    expect(vars.PROJECT_NAME).toBe('my-app');
    expect(vars.REPO_OWNER).toBe('acme');
    expect(vars.REPO_NAME).toBe('widget');
    expect(vars.MAXSIM_VERSION).toBeDefined();
  });

  it('falls back to directory name when no package.json', () => {
    mockExecFileSync.mockImplementation(() => { throw new Error('no git'); });

    const vars = gatherTemplateVars(tmpDir);
    expect(vars.PROJECT_NAME).toBe(path.basename(tmpDir));
  });
});
