#!/usr/bin/env node
/**
 * Check for MAXSIM updates in background, write result to cache.
 * Called by SessionStart hook - runs once per session.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawn } from 'node:child_process';
import { CLAUDE_DIR } from './shared';

export interface UpdateCheckResult {
  update_available: boolean;
  installed: string;
  latest: string;
  checked: number;
}

export interface CheckForUpdateOptions {
  homeDir: string;
  cwd: string;
}

export function checkForUpdate(options: CheckForUpdateOptions): void {
  const { homeDir, cwd } = options;
  const cacheDir = path.join(homeDir, CLAUDE_DIR, 'cache');
  const cacheFile = path.join(cacheDir, 'maxsim-update-check.json');

  // VERSION file locations (check project first, then global)
  const projectVersionFile = path.join(cwd, CLAUDE_DIR, 'maxsim', 'VERSION');
  const globalVersionFile = path.join(homeDir, CLAUDE_DIR, 'maxsim', 'VERSION');

  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  // Run check in background (spawn background process, windowsHide prevents console flash)
  const isWindows = process.platform === 'win32';
  const child = spawn(process.execPath, ['-e', `
  const fs = require('fs');
  const { execSync } = require('child_process');

  const cacheFile = ${JSON.stringify(cacheFile)};
  const projectVersionFile = ${JSON.stringify(projectVersionFile)};
  const globalVersionFile = ${JSON.stringify(globalVersionFile)};

  // Check project directory first (local install), then global
  let installed = '0.0.0';
  try {
    if (fs.existsSync(projectVersionFile)) {
      installed = fs.readFileSync(projectVersionFile, 'utf8').trim();
    } else if (fs.existsSync(globalVersionFile)) {
      installed = fs.readFileSync(globalVersionFile, 'utf8').trim();
    }
  } catch (e) {}

  let latest = null;
  try {
    latest = execSync('npm view maxsimcli version', { encoding: 'utf8', timeout: 10000, windowsHide: true }).trim();
  } catch (e) {}

  const result = {
    update_available: latest && installed !== latest,
    installed,
    latest: latest || 'unknown',
    checked: Math.floor(Date.now() / 1000)
  };

  fs.writeFileSync(cacheFile, JSON.stringify(result));
`], {
    stdio: 'ignore',
    windowsHide: true,
    detached: !isWindows,
  });

  child.unref();
}

/**
 * Create a backup of the current MAXSIM installation before an update.
 * Called by the installer (not by the SessionStart hook).
 *
 * @param cwd - The project working directory containing .claude/
 * @returns The backup directory path on success, null on failure.
 */
export function createBackupBeforeUpdate(cwd: string): string | null {
  try {
    const sourceDir = path.join(cwd, CLAUDE_DIR);
    const backupDir = path.join(sourceDir, 'maxsim-backup');

    fs.mkdirSync(backupDir, { recursive: true });

    // Key directories to back up
    const dirsToBackup = [
      'commands/maxsim',
      'maxsim',
      'hooks',
      'agents',
      'skills',
    ];

    for (const relDir of dirsToBackup) {
      const src = path.join(sourceDir, relDir);
      if (!fs.existsSync(src)) continue;

      const dest = path.join(backupDir, relDir);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
    }

    // Write backup metadata
    let version = 'unknown';
    const versionFile = path.join(sourceDir, 'maxsim', 'VERSION');
    if (fs.existsSync(versionFile)) {
      version = fs.readFileSync(versionFile, 'utf8').trim();
    }

    fs.writeFileSync(
      path.join(backupDir, 'backup-meta.json'),
      JSON.stringify(
        { created: new Date().toISOString(), version },
        null,
        2,
      ),
    );

    return backupDir;
  } catch {
    // Backup failure should not block the update
    return null;
  }
}

// Standalone entry
if (require.main === module) {
  checkForUpdate({ homeDir: os.homedir(), cwd: process.cwd() });
}
