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

const content = `/** MaxsimCLI version — auto-injected from package.json at build time. */\nexport const VERSION = '${version}';\n`;

const existing = fs.existsSync(versionTsPath)
  ? fs.readFileSync(versionTsPath, 'utf8')
  : '';

if (existing === content) {
  console.log(`  [version] version.ts already up-to-date (${version})`);
} else {
  fs.writeFileSync(versionTsPath, content, 'utf8');
  console.log(`  [version] Injected version ${version} -> src/core/version.ts`);
}
