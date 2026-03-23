#!/usr/bin/env node
'use strict';
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function log(msg, level) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const ts = `[${hh}:${mm}:${ss}]`;
  let prefix = '';
  let suffix = '\x1b[0m';
  if (level === 'pass')  prefix = '\x1b[32m';
  else if (level === 'fail')  prefix = '\x1b[31m';
  else if (level === 'info')  prefix = '\x1b[33m';
  else { prefix = ''; suffix = ''; }
  console.log(`${prefix}${ts} ${msg}${suffix}`);
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.warn(`  [warn] Could not clean up ${dir}: ${err.message}`);
  }
}

function checkNpmAuth() {
  try {
    execSync('npm whoami', { encoding: 'utf8', timeout: 10_000 });
    return true;
  } catch {
    log('Not authenticated to npm. Run `npm login` or set NODE_AUTH_TOKEN.', 'fail');
    return false;
  }
}

function runInstall() {
  const cmd = `npx --yes maxsimcli@latest`;
  try {
    const output = execSync(cmd, { stdio: ['inherit', 'pipe', 'pipe'], timeout: 120_000, encoding: 'utf8' });
    return { success: true, output: output || '' };
  } catch (err) {
    const out = (err.stdout || '') + (err.stderr || '');
    return { success: false, output: out };
  }
}

function checkFiles(configDir) {
  const checks = [];

  // commands/maxsim/ — directory with .md files, spot-check execute.md
  const commandsDir = path.join(configDir, 'commands', 'maxsim');
  const commandsExist = fs.existsSync(commandsDir);
  const mdFiles = commandsExist ? fs.readdirSync(commandsDir).filter(f => f.endsWith('.md')) : [];
  const spotCheck = commandsExist && fs.existsSync(path.join(commandsDir, 'execute.md'));
  checks.push({
    label: 'commands/maxsim/',
    passed: commandsExist && mdFiles.length > 0 && spotCheck,
    detail: !commandsExist ? 'directory missing'
      : mdFiles.length === 0 ? 'no .md files found'
      : !spotCheck ? 'execute.md not found'
      : `${mdFiles.length} .md files`,
  });

  // maxsim/workflows/ — install puts workflows at maxsim/workflows/ (not workflows/maxsim/)
  const workflowsDir = path.join(configDir, 'maxsim', 'workflows');
  const workflowsExist = fs.existsSync(workflowsDir);
  const workflowsCount = workflowsExist ? fs.readdirSync(workflowsDir).length : 0;
  checks.push({
    label: 'maxsim/workflows/',
    passed: workflowsExist && workflowsCount > 0,
    detail: !workflowsExist ? 'directory missing' : workflowsCount === 0 ? 'empty directory' : `${workflowsCount} files`,
  });

  // agents/ — directory, non-empty
  const agentsDir = path.join(configDir, 'agents');
  const agentsExist = fs.existsSync(agentsDir);
  const agentsCount = agentsExist ? fs.readdirSync(agentsDir).length : 0;
  checks.push({
    label: 'agents/',
    passed: agentsExist && agentsCount > 0,
    detail: !agentsExist ? 'directory missing' : agentsCount === 0 ? 'empty directory' : `${agentsCount} files`,
  });

  // maxsim/bin/maxsim-tools.cjs — CLI binary that workflows call via `node ~/.claude/maxsim/bin/maxsim-tools.cjs`
  const toolBin = path.join(configDir, 'maxsim', 'bin', 'maxsim-tools.cjs');
  checks.push({
    label: 'maxsim/bin/maxsim-tools.cjs',
    passed: fs.existsSync(toolBin),
    detail: fs.existsSync(toolBin) ? 'present' : 'file missing — workflows will fail with "Cannot find module"',
  });

  // maxsim/hooks/ — directory with at least 1 .cjs file
  const hooksDir = path.join(configDir, 'maxsim', 'hooks');
  const hooksExist = fs.existsSync(hooksDir);
  const cjsFiles = hooksExist ? fs.readdirSync(hooksDir).filter(f => f.endsWith('.cjs')) : [];
  checks.push({
    label: 'maxsim/hooks/*.cjs',
    passed: hooksExist && cjsFiles.length > 0,
    detail: !hooksExist ? 'directory missing' : cjsFiles.length === 0 ? 'no .cjs files found' : `${cjsFiles.length} .cjs files`,
  });

  // skills/ — directory, non-empty
  const skillsDir = path.join(configDir, 'skills');
  const skillsExist = fs.existsSync(skillsDir);
  const skillsCount = skillsExist ? fs.readdirSync(skillsDir).length : 0;
  checks.push({
    label: 'skills/',
    passed: skillsExist && skillsCount > 0,
    detail: !skillsExist ? 'directory missing' : skillsCount === 0 ? 'empty directory' : `${skillsCount} files`,
  });

  // rules/ — directory, non-empty
  const rulesDir = path.join(configDir, 'rules');
  const rulesExist = fs.existsSync(rulesDir);
  const rulesCount = rulesExist ? fs.readdirSync(rulesDir).length : 0;
  checks.push({
    label: 'rules/',
    passed: rulesExist && rulesCount > 0,
    detail: !rulesExist ? 'directory missing' : rulesCount === 0 ? 'empty directory' : `${rulesCount} files`,
  });

  // maxsim/references/ — directory, non-empty
  const referencesDir = path.join(configDir, 'maxsim', 'references');
  const referencesExist = fs.existsSync(referencesDir);
  const referencesCount = referencesExist ? fs.readdirSync(referencesDir).length : 0;
  checks.push({
    label: 'maxsim/references/',
    passed: referencesExist && referencesCount > 0,
    detail: !referencesExist ? 'directory missing' : referencesCount === 0 ? 'empty directory' : `${referencesCount} files`,
  });

  // CLAUDE.md — attribution file
  const claudeMd = path.join(configDir, 'CLAUDE.md');
  checks.push({
    label: 'CLAUDE.md',
    passed: fs.existsSync(claudeMd),
    detail: fs.existsSync(claudeMd) ? 'present' : 'file missing',
  });

  // settings.json — hook registrations
  const settingsJson = path.join(configDir, 'settings.json');
  checks.push({
    label: 'settings.json',
    passed: fs.existsSync(settingsJson),
    detail: fs.existsSync(settingsJson) ? 'present' : 'file missing',
  });

  return checks;
}

function pollUntilVersion(expectedVersion, intervalMs = 10_000, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const published = execSync('npm view maxsimcli version', {
        encoding: 'utf8', timeout: 15_000,
      }).trim();
      if (published === expectedVersion) return true;
    } catch {
      // Registry temporarily unreachable — keep polling
    }
    const sleepMs = Math.min(intervalMs, deadline - Date.now());
    if (sleepMs <= 0) break;
    sleep(sleepMs);
  }
  return false;
}

function bumpBuildPublish(monorepoRoot) {
  // 1. Bump patch version directly in packages/cli/package.json (no git ops)
  const pkgPath = path.join(monorepoRoot, 'packages', 'cli', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const parts = pkg.version.split('.');
  parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
  pkg.version = parts.join('.');
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  const newVersion = pkg.version;

  log(`Bumped version to ${newVersion}`, 'info');

  // 2. Rebuild all packages
  execSync('pnpm run build', { cwd: monorepoRoot, stdio: 'inherit' });

  // 3. Publish (pnpm, no git checks, public access)
  execSync('pnpm publish --filter maxsimcli --no-git-checks --access public', {
    cwd: monorepoRoot, stdio: 'inherit',
    env: { ...process.env },
  });

  return newVersion;
}

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

const monorepoRoot = path.resolve(__dirname, '..');
const mode = process.argv[2];

if (mode === '--bump-and-publish') {
  if (!checkNpmAuth()) process.exit(1);
  const newVersion = bumpBuildPublish(monorepoRoot);
  log(`Polling registry for version ${newVersion} (timeout: 2 min)...`, 'info');
  const propagated = pollUntilVersion(newVersion);
  if (propagated) {
    log(`VERSION PROPAGATED: ${newVersion}`, 'pass');
    process.exit(0);
  } else {
    log(`TIMEOUT: registry did not show ${newVersion} within 2 minutes`, 'fail');
    process.exit(1);
  }
} else {
  // Default: e2e install check
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maxsim-e2e-'));
  try {
    log('Clearing npm cache to prevent stale version hits...', 'info');
    try { execSync('npm cache clean --force', { stdio: 'pipe' }); } catch {}

    log(`Running install into ${tmpDir}`, 'info');
    const installResult = runInstall();
    const fileChecks = checkFiles(tmpDir);
    const filesOk = fileChecks.every(c => c.passed);

    log(`Install: ${installResult.success ? 'PASS' : 'FAIL'}`, installResult.success ? 'pass' : 'fail');
    for (const c of fileChecks) {
      const detail = c.detail ? ` — ${c.detail}` : '';
      log(`  ${c.label}: ${c.passed ? 'PASS' : 'FAIL' + detail}`, c.passed ? 'pass' : 'fail');
    }

    if (installResult.success && filesOk) {
      log('\nRESULT: PASS — all checks green.', 'pass');
      process.exit(0);
    } else {
      log('\nRESULT: FAIL — see above for details.', 'fail');
      if (!installResult.success) log('Install output:\n' + installResult.output);
      log('\nTo fix and retry: apply fixes, then run:');
      log('  node scripts/e2e-test.cjs --bump-and-publish  # bump patch + publish + wait for registry');
      log('  node scripts/e2e-test.cjs                     # re-verify');
      process.exit(1);
    }
  } finally {
    cleanup(tmpDir);
  }
}
