/**
 * MAXSIM Installer — entry point for `npx maxsimcli`.
 *
 * Installs MaxsimCLI project-locally into .claude/:
 * - Commands, agents, skills, workflows, references, rules, templates
 * - Hook scripts + settings.json registration
 * - CLAUDE.md in project root
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import minimist from 'minimist';
import { copyDir, getTemplatesDir } from './copy.js';
import { installHooks } from './hooks.js';
import { uninstall } from './uninstall.js';
import { writeClaudeMd } from './claudemd.js';
import { VERSION } from '../core/version.js';

export function checkNodeVersion(minMajor = 22): void {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < minMajor) {
    console.error(`MaxsimCLI requires Node.js >= ${minMajor}. Current: ${process.versions.node}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  checkNodeVersion();

  const args = minimist(process.argv.slice(2), {
    boolean: ['uninstall', 'help', 'version', 'quiet'],
    alias: { h: 'help', v: 'version', q: 'quiet' },
  });

  if (args.version) {
    console.log(VERSION);
    return;
  }

  if (args.help) {
    printHelp();
    return;
  }

  const projectDir = process.cwd();
  const quiet = args.quiet;

  if (args.uninstall) {
    return runUninstall(projectDir, quiet);
  }

  return runInstall(projectDir, quiet);
}

function printHelp(): void {
  console.log(`
  MaxsimCLI v${VERSION} — MAXimale SIMplicity

  Usage:
    npx maxsimcli              Install MaxsimCLI in current project
    npx maxsimcli --uninstall  Remove MaxsimCLI from current project
    npx maxsimcli --version    Show version
    npx maxsimcli --help       Show this help

  Learn more: https://maxsimcli.dev
`);
}

async function runInstall(projectDir: string, quiet: boolean): Promise<void> {
  if (!quiet) {
    console.log(`\n  MaxsimCLI v${VERSION}\n`);
    console.log('  Installing into .claude/ ...\n');
  }

  const claudeDir = path.join(projectDir, '.claude');
  const templatesDir = getTemplatesDir();

  if (!fs.existsSync(templatesDir)) {
    console.error('Error: Template assets not found. Package may be corrupted.');
    process.exit(1);
  }

  // 1. Copy templates to .claude/
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
  for (const { src, dest } of copies) {
    const count = copyDir(src, dest);
    totalFiles += count;
    if (!quiet && count > 0) {
      const label = path.relative(claudeDir, dest);
      console.log(`  ${label}: ${count} files`);
    }
  }

  // 1b. Create agent-memory directory
  fs.mkdirSync(path.join(projectDir, '.claude', 'agent-memory', 'maxsim-learner'), { recursive: true });

  // 2. Copy CLI binary
  const cliBinSrc = path.resolve(__dirname, 'cli.cjs');
  const cliBinDest = path.join(claudeDir, 'maxsim', 'bin', 'maxsim-tools.cjs');
  if (fs.existsSync(cliBinSrc)) {
    fs.mkdirSync(path.dirname(cliBinDest), { recursive: true });
    fs.copyFileSync(cliBinSrc, cliBinDest);
    totalFiles++;
    if (!quiet) console.log('  maxsim/bin/maxsim-tools.cjs: CLI binary');
  } else {
    console.warn('  Warning: cli.cjs binary not found — maxsim tool commands will be unavailable.');
  }

  // 3. Install hooks
  const hookResult = installHooks(projectDir);
  if (!quiet && hookResult.installed.length > 0) {
    console.log(`\n  Hooks: ${hookResult.installed.length} registered`);
    for (const hook of hookResult.installed) {
      console.log(`    - ${hook}`);
    }
  }

  // 4. Generate CLAUDE.md
  const projectName = detectProjectName(projectDir);
  writeClaudeMd(projectDir, projectName);
  if (!quiet) console.log('\n  CLAUDE.md: generated in project root');

  // 5. Summary
  if (!quiet) {
    console.log(`\n  Done! ${totalFiles} files installed.`);
    console.log('\n  Get started:');
    console.log('    /maxsim:go     — auto-detect and start');
    console.log('    /maxsim:init   — initialize project');
    console.log('    /maxsim:help   — show all commands\n');
  }
}

function runUninstall(projectDir: string, quiet: boolean): void {
  if (!quiet) {
    console.log('\n  MaxsimCLI — Uninstalling...\n');
  }

  const result = uninstall(projectDir);

  if (!quiet) {
    if (result.removedDirs.length > 0) {
      console.log(`  Removed ${result.removedDirs.length} directories`);
    }
    if (result.removedFiles.length > 0) {
      console.log(`  Removed ${result.removedFiles.length} files`);
    }
    if (result.cleanedSettings) {
      console.log('  Cleaned settings.json');
    }
    console.log('\n  MaxsimCLI has been removed.\n');
  }
}

/** Try to detect the project name from package.json or directory name. */
function detectProjectName(projectDir: string): string {
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name && typeof pkg.name === 'string') {
        return pkg.name;
      }
    } catch { /* ignore */ }
  }
  return path.basename(projectDir);
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(`\nUnexpected error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}
