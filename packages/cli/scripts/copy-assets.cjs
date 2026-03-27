#!/usr/bin/env node
'use strict';

/**
 * Post-build asset copy for @maxsim/cli
 *
 * Copies template markdown files into dist/assets/ so that the published
 * npm package is fully self-contained.
 *
 * dist/assets/templates/  <- templates/ (commands, agents, workflows, etc.)
 * dist/assets/hooks/      <- already built directly by tsdown into dist/assets/hooks/
 * dist/assets/CHANGELOG.md <- CHANGELOG.md from monorepo root (if present)
 */

const fs = require('node:fs');
const path = require('node:path');

const pkgCliRoot = path.resolve(__dirname, '..');          // packages/cli
const monorepoRoot = path.resolve(pkgCliRoot, '..', '..'); // repo root
const distAssetsDir = path.join(pkgCliRoot, 'dist', 'assets');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`  [warn] Source not found, skipping: ${src}`);
    return 0;
  }
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      count += copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

// 1. Copy templates from root templates/ into dist/assets/templates
const templatesSrc = path.join(monorepoRoot, 'templates');
const templatesDest = path.join(distAssetsDir, 'templates');
const templatesCount = copyDir(templatesSrc, templatesDest);
console.log(`  [assets] Copied ${templatesCount} files -> dist/assets/templates/`);

// 2. Hooks are now built directly into dist/assets/hooks/ by tsdown — no copy needed.
//    Clean up any .d.cts declaration files that tsdown may have emitted.
const hooksDest = path.join(distAssetsDir, 'hooks');
if (fs.existsSync(hooksDest)) {
  for (const entry of fs.readdirSync(hooksDest)) {
    if (entry.includes('.d.')) {
      fs.unlinkSync(path.join(hooksDest, entry));
    }
  }
}

// Copy bundled sounds
const soundsSrc = path.join(pkgCliRoot, 'sounds');
const soundsDest = path.join(distAssetsDir, 'hooks', 'sounds');
if (fs.existsSync(soundsSrc)) {
  fs.mkdirSync(soundsDest, { recursive: true });
  const soundFiles = fs.readdirSync(soundsSrc);
  let soundCount = 0;
  for (const file of soundFiles) {
    if (file.endsWith('.wav')) {
      fs.copyFileSync(path.join(soundsSrc, file), path.join(soundsDest, file));
      soundCount++;
    }
  }
  console.log(`  [assets] Copied ${soundCount} sound files -> dist/assets/hooks/sounds/`);
}

// 3. Copy CHANGELOG.md from monorepo root (optional)
const changelogSrc = path.join(monorepoRoot, 'CHANGELOG.md');
if (fs.existsSync(changelogSrc)) {
  fs.mkdirSync(distAssetsDir, { recursive: true });
  fs.copyFileSync(changelogSrc, path.join(distAssetsDir, 'CHANGELOG.md'));
  console.log(`  [assets] Copied CHANGELOG.md -> dist/assets/`);
}

// 4. Copy root README.md into packages/cli/ for npm tarball
const readmeSrc = path.join(monorepoRoot, 'README.md');
const readmeDest = path.join(pkgCliRoot, 'README.md');
if (fs.existsSync(readmeSrc)) {
  fs.copyFileSync(readmeSrc, readmeDest);
  console.log(`  [assets] Copied README.md -> packages/cli/README.md`);
}

console.log('  [assets] Done.');
