/**
 * Manifest utilities for tracking files installed by MaxsimCLI.
 *
 * The manifest is stored at `.claude/maxsim/manifest.json` and contains
 * a JSON array of paths relative to the project directory.  It enables
 * a clean, targeted uninstall without guessing which files belong to us.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const MANIFEST_FILE = 'manifest.json';

/** Get the manifest file path for the given project directory. */
export function getManifestPath(projectDir: string): string {
  return path.join(projectDir, '.claude', 'maxsim', MANIFEST_FILE);
}

/**
 * Write the list of installed file paths (relative to projectDir) to the
 * manifest.  Creates the parent directory if it does not exist.
 */
export function writeManifest(projectDir: string, files: string[]): void {
  const manifestPath = getManifestPath(projectDir);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(files, null, 2)}\n`, 'utf8');
}

/**
 * Read the manifest and return the list of recorded file paths.
 * Returns an empty array when the manifest does not exist or contains
 * invalid JSON.
 */
export function readManifest(projectDir: string): string[] {
  const manifestPath = getManifestPath(projectDir);
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Remove every file listed in the manifest, then remove the manifest itself.
 * Files that have already been deleted are silently skipped.
 *
 * @returns The number of files that were actually deleted.
 */
export function removeManifested(projectDir: string): number {
  const files = readManifest(projectDir);
  let removed = 0;
  for (const rel of files) {
    try {
      fs.unlinkSync(path.join(projectDir, rel));
      removed++;
    } catch {
      // file already gone — skip
    }
  }
  try {
    fs.unlinkSync(getManifestPath(projectDir));
  } catch {
    // manifest already gone — skip
  }
  return removed;
}
