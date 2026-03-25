#!/usr/bin/env node
'use strict';

/**
 * Pre-build version injection for @maxsim/cli
 *
 * Reads the version from packages/cli/package.json and writes it into
 * src/core/version.ts so the built bundle always matches the npm version.
 *
 * This runs automatically as part of `npm run build` and ensures
 * semantic-release version bumps propagate to the compiled output.
 */

const fs = require('node:fs');
const path = require('node:path');

const pkgCliRoot = path.resolve(__dirname, '..');
const pkgJsonPath = path.join(pkgCliRoot, 'package.json');
const versionTsPath = path.join(pkgCliRoot, 'src', 'core', 'version.ts');

const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
const version = pkg.version;

const versionLine = `export const VERSION = '${version}';`;

const existing = fs.existsSync(versionTsPath)
  ? fs.readFileSync(versionTsPath, 'utf8')
  : '';

if (existing.includes(versionLine)) {
  console.log(`  [version] version.ts already up-to-date (${version})`);
} else if (existing && /export const VERSION = '.*';/.test(existing)) {
  // Replace the VERSION line in-place, preserving utility functions
  const updated = existing.replace(/export const VERSION = '.*';/, versionLine);
  fs.writeFileSync(versionTsPath, updated, 'utf8');
  console.log(`  [version] Injected version ${version} -> src/core/version.ts`);
} else {
  // File missing or doesn't contain VERSION — write the full template
  const content = `/** MaxsimCLI version — auto-injected from package.json at build time. */\n${versionLine}\n`;
  fs.writeFileSync(versionTsPath, content, 'utf8');
  console.log(`  [version] Injected version ${version} -> src/core/version.ts`);
}

// Also update templates/templates/config.json version
const configJsonPath = path.join(pkgCliRoot, '..', '..', 'templates', 'templates', 'config.json');
if (fs.existsSync(configJsonPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configJsonPath, 'utf8'));
    if (config.version !== version) {
      config.version = version;
      fs.writeFileSync(configJsonPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
      console.log(`  [version] Injected version ${version} -> templates/templates/config.json`);
    } else {
      console.log(`  [version] config.json already up-to-date (${version})`);
    }
  } catch (err) {
    console.warn(`  [version] Warning: Could not update config.json: ${err.message}`);
  }
} else {
  console.warn('  [version] Warning: templates/templates/config.json not found');
}
