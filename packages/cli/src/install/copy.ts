/**
 * File copying utilities for MaxsimCLI installation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Recursively copy a directory, creating targets as needed. */
export function copyDir(src: string, dest: string): number {
  if (!fs.existsSync(src)) return 0;

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

/** Remove a directory recursively if it exists. */
export function removeDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Get the path to the bundled assets directory. */
function getAssetsDir(): string {
  return path.resolve(__dirname, 'assets');
}

/** Get the path to the bundled templates directory. */
export function getTemplatesDir(): string {
  return path.join(getAssetsDir(), 'templates');
}

/** Get the path to the bundled hooks directory. */
export function getHooksDir(): string {
  return path.join(getAssetsDir(), 'hooks');
}
