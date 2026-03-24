import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Hoist mock before imports so the factory runs before module resolution
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from 'node:child_process';
import { copyDir, removeDir } from '../../src/install/copy.js';
import { generateClaudeMd, writeClaudeMd } from '../../src/install/claudemd.js';
import { uninstall } from '../../src/install/uninstall.js';
import { checkGhAuth } from '../../src/install/gh-auth.js';
import { checkNodeVersion } from '../../src/install/index.js';

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

  it('includes all 13 commands', () => {
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
      const err: any = new Error('spawn gh ENOENT');
      err.code = 'ENOENT';
      throw err;
    });
    const result = checkGhAuth();
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not installed');
  });

  it('returns ok:false with auth message when gh auth fails', () => {
    mockExecFileSync.mockImplementation(() => {
      const err: any = new Error('Command failed');
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
