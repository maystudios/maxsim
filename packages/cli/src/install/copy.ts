/**
 * File copying utilities for MaxsimCLI installation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** File extensions treated as text for template variable substitution. */
const TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt']);

/**
 * Replace `{{KEY}}` placeholders in `content` with values from `vars`.
 * Unknown placeholders are left as-is so files never break if a variable
 * is not supplied.
 */
export function processTemplate(
  content: string,
  vars: Record<string, string>,
): string {
  return content.replace(/\{\{([A-Z_]+)\}\}/g, (match, key: string) => {
    const value = vars[key];
    // Leave placeholder untouched when the variable is missing or empty
    return value != null && value !== '' ? value : match;
  });
}

/** Return `true` when the file extension is one we process for template substitution. */
export function isTextTemplate(filePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Recursively copy a directory, creating targets as needed.
 *
 * When `templateVars` is provided, text files (determined by extension) are
 * read, processed through `processTemplate`, then written to the destination.
 * Non-text files are always copied as-is.
 */
export function copyDir(
  src: string,
  dest: string,
  templateVars?: Record<string, string>,
): number {
  if (!fs.existsSync(src)) return 0;

  fs.mkdirSync(dest, { recursive: true });
  let count = 0;

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDir(srcPath, destPath, templateVars);
    } else if (templateVars && isTextTemplate(srcPath)) {
      const content = fs.readFileSync(srcPath, 'utf8');
      fs.writeFileSync(destPath, processTemplate(content, templateVars), 'utf8');
      count++;
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
