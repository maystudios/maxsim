// biome-ignore-all lint/suspicious/noExplicitAny: dynamic JSON parsing in integration tests
/**
 * Integration test — full install -> verify -> uninstall -> verify cycle.
 *
 * Uses real filesystem operations in an isolated temp directory.
 * Only mocks:
 *   - gh auth check (to avoid requiring gh CLI in CI)
 *   - getHooksDir / getTemplatesDir (vitest runs from source where
 *     __dirname != dist/, so we redirect to the built assets)
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

/**
 * Resolve the dist/assets directory that contains bundled templates and hooks.
 * During vitest, source files run from packages/cli/src/install/ but the
 * built assets live under packages/cli/dist/assets/.
 */
const DIST_ASSETS = path.resolve(__dirname, '..', '..', 'dist', 'assets');

// Mock gh auth to avoid requiring the gh CLI in test environments
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn().mockReturnValue(Buffer.from('')),
}));

// Mock asset path resolution so that hooks.ts and copy.ts find
// the built dist/assets instead of the non-existent src/install/assets
vi.mock('../../src/install/copy.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/install/copy.js')>();
  return {
    ...actual,
    getTemplatesDir: () => path.join(DIST_ASSETS, 'templates'),
    getHooksDir: () => path.join(DIST_ASSETS, 'hooks'),
  };
});

import { copyDir } from '../../src/install/copy.js';
import { installHooks } from '../../src/install/hooks.js';
import { writeClaudeMd } from '../../src/install/claudemd.js';
import { writeManifest, readManifest } from '../../src/install/manifest.js';
import { ensureGitignoreEntries } from '../../src/install/index.js';
import { uninstall } from '../../src/install/uninstall.js';

/** Recursively collect all file paths under `dir` (relative to `base`). */
function collectFiles(base: string, dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(base, full));
    } else {
      out.push(path.relative(base, full));
    }
  }
  return out;
}

describe('Install -> Verify -> Uninstall -> Verify', () => {
  let projectDir: string;
  let claudeDir: string;
  const templatesDir = path.join(DIST_ASSETS, 'templates');

  beforeAll(() => {
    // Guard: built assets must exist (requires a prior `npm run build`)
    if (!fs.existsSync(templatesDir)) {
      throw new Error(
        `Built template assets not found at ${templatesDir}. Run "npm run build" in packages/cli first.`,
      );
    }

    // Create an isolated temp directory simulating a real project
    projectDir = path.join(os.tmpdir(), `maxsim-integration-${crypto.randomUUID()}`);
    claudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(projectDir, { recursive: true });

    // Write a package.json so the project name is detected
    fs.writeFileSync(
      path.join(projectDir, 'package.json'),
      JSON.stringify({ name: 'integration-test-project' }, null, 2),
      'utf8',
    );
  });

  afterAll(() => {
    // Clean up temp directory
    if (projectDir && fs.existsSync(projectDir)) {
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });

  // ---------------------------------------------------------------
  // PHASE 1: Install
  // ---------------------------------------------------------------

  describe('Phase 1: Install', () => {
    let installedFiles: string[];
    let hookResult: { installed: string[] };

    beforeAll(() => {
      installedFiles = [];

      // Step 1: Copy templates into .claude/ (mirrors runInstall logic)
      const copies = [
        { src: path.join(templatesDir, 'commands'), dest: path.join(claudeDir, 'commands') },
        { src: path.join(templatesDir, 'agents'), dest: path.join(claudeDir, 'agents') },
        { src: path.join(templatesDir, 'skills'), dest: path.join(claudeDir, 'skills') },
        { src: path.join(templatesDir, 'rules'), dest: path.join(claudeDir, 'rules') },
        { src: path.join(templatesDir, 'workflows'), dest: path.join(claudeDir, 'maxsim', 'workflows') },
        { src: path.join(templatesDir, 'references'), dest: path.join(claudeDir, 'maxsim', 'references') },
        { src: path.join(templatesDir, 'templates'), dest: path.join(claudeDir, 'maxsim', 'templates') },
      ];

      for (const { src, dest } of copies) {
        copyDir(src, dest);
        for (const f of collectFiles(projectDir, dest)) { installedFiles.push(f); }
      }

      // Step 1b: Create agent-memory directory
      fs.mkdirSync(path.join(claudeDir, 'agent-memory', 'maxsim-learner'), { recursive: true });
      ensureGitignoreEntries(projectDir, ['.claude/agent-memory/', 'autoresearch-results.tsv']);

      // Step 2: Simulate CLI binary copy (create a dummy file since the real
      // cli.cjs path is __dirname-relative and won't resolve in test)
      const cliBinDest = path.join(claudeDir, 'maxsim', 'bin', 'maxsim-tools.cjs');
      fs.mkdirSync(path.dirname(cliBinDest), { recursive: true });
      fs.writeFileSync(cliBinDest, '// dummy cli binary for testing', 'utf8');
      installedFiles.push(path.relative(projectDir, cliBinDest));

      // Step 3: Write manifest
      writeManifest(projectDir, installedFiles);

      // Step 4: Install hooks — copies hook scripts from dist/assets/hooks
      // (via mocked getHooksDir) and registers them in settings.json
      hookResult = installHooks(projectDir);

      // Step 5: Generate CLAUDE.md
      writeClaudeMd(projectDir, 'integration-test-project');
    });

    // -- Directory structure assertions --

    it('creates .claude/ directory', () => {
      expect(fs.existsSync(claudeDir)).toBe(true);
    });

    it('creates commands/ directory with files', () => {
      const dir = path.join(claudeDir, 'commands');
      expect(fs.existsSync(dir)).toBe(true);
      const files = fs.readdirSync(dir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it('creates agents/ directory with files', () => {
      const dir = path.join(claudeDir, 'agents');
      expect(fs.existsSync(dir)).toBe(true);
      const files = fs.readdirSync(dir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it('creates skills/ directory with files', () => {
      const dir = path.join(claudeDir, 'skills');
      expect(fs.existsSync(dir)).toBe(true);
      const files = fs.readdirSync(dir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it('creates rules/ directory with files', () => {
      const dir = path.join(claudeDir, 'rules');
      expect(fs.existsSync(dir)).toBe(true);
      const files = fs.readdirSync(dir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it('creates maxsim/workflows/ directory with files', () => {
      const dir = path.join(claudeDir, 'maxsim', 'workflows');
      expect(fs.existsSync(dir)).toBe(true);
      const files = fs.readdirSync(dir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it('creates maxsim/references/ directory with files', () => {
      const dir = path.join(claudeDir, 'maxsim', 'references');
      expect(fs.existsSync(dir)).toBe(true);
      const files = fs.readdirSync(dir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it('creates maxsim/templates/ directory with files', () => {
      const dir = path.join(claudeDir, 'maxsim', 'templates');
      expect(fs.existsSync(dir)).toBe(true);
      const files = fs.readdirSync(dir, { recursive: true });
      expect(files.length).toBeGreaterThan(0);
    });

    it('creates maxsim/bin/ with CLI binary', () => {
      const binFile = path.join(claudeDir, 'maxsim', 'bin', 'maxsim-tools.cjs');
      expect(fs.existsSync(binFile)).toBe(true);
    });

    it('creates maxsim/hooks/ with hook scripts', () => {
      const dir = path.join(claudeDir, 'maxsim', 'hooks');
      expect(fs.existsSync(dir)).toBe(true);
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.cjs'));
      expect(files.length).toBeGreaterThan(0);
    });

    it('creates agent-memory/maxsim-learner/ directory', () => {
      expect(fs.existsSync(path.join(claudeDir, 'agent-memory', 'maxsim-learner'))).toBe(true);
    });

    // -- settings.json assertions --

    it('creates settings.json with hooks object', () => {
      const settingsPath = path.join(claudeDir, 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      expect(settings.hooks).toBeDefined();
      expect(typeof settings.hooks).toBe('object');
    });

    it('registers SessionStart hooks in settings.json', () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'),
      );
      expect(settings.hooks.SessionStart).toBeDefined();
      expect(settings.hooks.SessionStart.length).toBeGreaterThan(0);

      const hasMaxsim = settings.hooks.SessionStart.some((m: any) =>
        m.hooks.some((h: any) => h.command.includes('maxsim')),
      );
      expect(hasMaxsim).toBe(true);
    });

    it('registers Notification hook in settings.json', () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'),
      );
      expect(settings.hooks.Notification).toBeDefined();
      expect(settings.hooks.Notification.length).toBeGreaterThan(0);
    });

    it('registers Stop hooks in settings.json', () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'),
      );
      expect(settings.hooks.Stop).toBeDefined();
      expect(settings.hooks.Stop.length).toBeGreaterThanOrEqual(1);
    });

    it('registers statusLine in settings.json', () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'),
      );
      expect(settings.statusLine).toBeDefined();
      expect(settings.statusLine.type).toBe('command');
      expect(settings.statusLine.command).toContain('maxsim-statusline');
    });

    it('sets CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS env var in settings.json', () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'),
      );
      expect(settings.env).toBeDefined();
      expect(settings.env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBe('1');
    });

    it('returns installed hook names from installHooks()', () => {
      expect(hookResult.installed.length).toBeGreaterThan(0);
      const names = hookResult.installed.join(', ');
      expect(names).toContain('maxsim-check-update');
      expect(names).toContain('maxsim-notification-sound');
    });

    // -- CLAUDE.md assertions --

    it('generates CLAUDE.md in project root', () => {
      expect(fs.existsSync(path.join(projectDir, 'CLAUDE.md'))).toBe(true);
    });

    it('CLAUDE.md contains project name heading', () => {
      const content = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('# integration-test-project');
    });

    it('CLAUDE.md contains MaxsimCLI section', () => {
      const content = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('## MaxsimCLI');
    });

    it('CLAUDE.md contains command reference table with all 14 commands', () => {
      const content = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8');
      // Table header
      expect(content).toContain('| Command | Purpose |');
      expect(content).toContain('|---------|---------|');
      // All slash commands
      const commands = [
        '/maxsim:go', '/maxsim:init', '/maxsim:plan', '/maxsim:execute',
        '/maxsim:debug', '/maxsim:quick', '/maxsim:improve', '/maxsim:fix-loop',
        '/maxsim:debug-loop', '/maxsim:security', '/maxsim:progress',
        '/maxsim:settings', '/maxsim:help',
      ];
      for (const cmd of commands) {
        expect(content).toContain(cmd);
      }
    });

    it('CLAUDE.md contains Quick Start section', () => {
      const content = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('### Quick Start');
    });

    it('CLAUDE.md contains GitHub Integration section', () => {
      const content = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('### GitHub Integration');
    });

    // -- .gitignore assertions --

    it('creates .gitignore with MaxsimCLI entries', () => {
      const gitignorePath = path.join(projectDir, '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);

      const content = fs.readFileSync(gitignorePath, 'utf8');
      expect(content).toContain('# MaxsimCLI');
      expect(content).toContain('.claude/agent-memory/');
      expect(content).toContain('autoresearch-results.tsv');
    });

    // -- Manifest assertions --

    it('creates manifest.json in .claude/maxsim/', () => {
      const manifestPath = path.join(claudeDir, 'maxsim', 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
    });

    it('manifest.json tracks files from all installed directories', () => {
      const manifest = readManifest(projectDir);
      expect(manifest.length).toBeGreaterThan(0);

      // Should contain paths from every copied directory
      expect(manifest.some((f) => f.includes('commands'))).toBe(true);
      expect(manifest.some((f) => f.includes('agents'))).toBe(true);
      expect(manifest.some((f) => f.includes('skills'))).toBe(true);
      expect(manifest.some((f) => f.includes('rules'))).toBe(true);
      expect(manifest.some((f) => f.includes('workflows'))).toBe(true);
      expect(manifest.some((f) => f.includes('references'))).toBe(true);
      expect(manifest.some((f) => f.includes('templates'))).toBe(true);
      expect(manifest.some((f) => f.includes('maxsim-tools.cjs'))).toBe(true);
    });

    it('manifest.json contains valid relative paths that exist on disk', () => {
      const manifest = readManifest(projectDir);
      for (const relPath of manifest) {
        expect(path.isAbsolute(relPath)).toBe(false);
        expect(fs.existsSync(path.join(projectDir, relPath))).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------
  // PHASE 2: Uninstall
  // ---------------------------------------------------------------

  describe('Phase 2: Uninstall', () => {
    let result: { removedDirs: string[]; removedFiles: string[]; cleanedSettings: boolean };

    beforeAll(() => {
      result = uninstall(projectDir);
    });

    it('returns removed directories', () => {
      expect(result.removedDirs.length).toBeGreaterThan(0);
    });

    it('returns removed files including CLAUDE.md', () => {
      expect(result.removedFiles.length).toBeGreaterThan(0);
      expect(result.removedFiles.some((f) => f.includes('CLAUDE.md'))).toBe(true);
    });

    it('reports that settings were cleaned', () => {
      expect(result.cleanedSettings).toBe(true);
    });

    // -- Verify MaxsimCLI directories are removed --

    it('removes maxsim/ directory (workflows, templates, references, bin, hooks)', () => {
      expect(fs.existsSync(path.join(claudeDir, 'maxsim'))).toBe(false);
    });

    it('removes commands/maxsim/ directory', () => {
      expect(fs.existsSync(path.join(claudeDir, 'commands', 'maxsim'))).toBe(false);
    });

    it('removes agents/ directory', () => {
      expect(fs.existsSync(path.join(claudeDir, 'agents'))).toBe(false);
    });

    it('removes skills/ directory', () => {
      expect(fs.existsSync(path.join(claudeDir, 'skills'))).toBe(false);
    });

    it('removes rules/ directory', () => {
      expect(fs.existsSync(path.join(claudeDir, 'rules'))).toBe(false);
    });

    it('removes agent-memory/maxsim-learner/ directory', () => {
      expect(fs.existsSync(path.join(claudeDir, 'agent-memory', 'maxsim-learner'))).toBe(false);
    });

    // -- Verify CLAUDE.md is removed --

    it('removes CLAUDE.md from project root', () => {
      expect(fs.existsSync(path.join(projectDir, 'CLAUDE.md'))).toBe(false);
    });

    // -- Verify settings.json is cleaned but still exists --

    it('settings.json still exists after uninstall', () => {
      expect(fs.existsSync(path.join(claudeDir, 'settings.json'))).toBe(true);
    });

    it('settings.json has no maxsim hooks after uninstall', () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'),
      );

      if (settings.hooks) {
        for (const event of Object.keys(settings.hooks)) {
          const matchers = settings.hooks[event];
          for (const matcher of matchers) {
            for (const hook of matcher.hooks) {
              expect(hook.command).not.toContain('maxsim');
            }
          }
        }
      }
    });

    it('settings.json has no maxsim statusLine after uninstall', () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'),
      );
      expect(settings.statusLine).toBeUndefined();
    });

    it('settings.json has no CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS env var after uninstall', () => {
      const settings = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'),
      );
      expect(settings.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS).toBeUndefined();
    });

    // -- Verify manifest is removed --

    it('manifest.json is removed', () => {
      expect(fs.existsSync(path.join(claudeDir, 'maxsim', 'manifest.json'))).toBe(false);
    });

    // -- Verify non-maxsim files survive --

    it('.gitignore still exists after uninstall', () => {
      expect(fs.existsSync(path.join(projectDir, '.gitignore'))).toBe(true);
    });

    it('package.json still exists after uninstall', () => {
      expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true);
    });
  });
});
