/**
 * Template sync — one-way sync from bundled templates to .claude/.
 *
 * Compares file hashes to avoid unnecessary writes. Skips user-modified
 * files like config.json. Used for updating an existing installation
 * without a full reinstall.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { getTemplatesDir, isTextTemplate, processTemplate } from './copy.js';

/** Files that should never be overwritten by sync (user-modified). */
const EXCLUDED_FILES = new Set([
  'config.json',
]);

/** Directories relative to the dest root that should be skipped entirely. */
const EXCLUDED_DIRS = new Set([
  'bin',
]);

export interface SyncResult {
  copied: string[];
  skipped: string[];
  unchanged: string[];
}

/** Compute SHA-256 hash of file content. */
function fileHash(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Recursively sync files from `src` to `dest`, only writing when content
 * differs. Returns lists of copied, skipped, and unchanged files.
 */
function syncDir(
  src: string,
  dest: string,
  templateVars: Record<string, string> | undefined,
  result: SyncResult,
  relativeBase = '',
): void {
  if (!fs.existsSync(src)) return;

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    const relativePath = path.join(relativeBase, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        result.skipped.push(relativePath);
        continue;
      }
      syncDir(srcPath, destPath, templateVars, result, relativePath);
      continue;
    }

    // Skip excluded files
    if (EXCLUDED_FILES.has(entry.name)) {
      result.skipped.push(relativePath);
      continue;
    }

    // Determine source content (with template substitution for text files)
    let srcContent: Buffer;
    if (templateVars && isTextTemplate(srcPath)) {
      const text = fs.readFileSync(srcPath, 'utf8');
      srcContent = Buffer.from(processTemplate(text, templateVars), 'utf8');
    } else {
      srcContent = fs.readFileSync(srcPath);
    }

    // Compare with existing destination
    if (fs.existsSync(destPath)) {
      const destHash = fileHash(destPath);
      const srcHash = crypto.createHash('sha256').update(srcContent).digest('hex');
      if (srcHash === destHash) {
        result.unchanged.push(relativePath);
        continue;
      }
    }

    // Write the updated file
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, srcContent);
    result.copied.push(relativePath);
  }
}

/**
 * Sync bundled templates to the project's .claude/ directory.
 *
 * One-way sync: templates → .claude/. Files that haven't changed
 * (by SHA-256 hash) are not touched. Excluded files (config.json,
 * bin/) are always skipped.
 */
export function syncTemplates(
  projectDir: string,
  templateVars?: Record<string, string>,
): SyncResult {
  const templatesDir = getTemplatesDir();
  const claudeDir = path.join(projectDir, '.claude');

  const result: SyncResult = { copied: [], skipped: [], unchanged: [] };

  const syncMappings = [
    { src: path.join(templatesDir, 'commands'), dest: path.join(claudeDir, 'commands') },
    { src: path.join(templatesDir, 'agents'), dest: path.join(claudeDir, 'agents') },
    { src: path.join(templatesDir, 'skills'), dest: path.join(claudeDir, 'skills') },
    { src: path.join(templatesDir, 'rules'), dest: path.join(claudeDir, 'rules') },
    { src: path.join(templatesDir, 'workflows'), dest: path.join(claudeDir, 'maxsim', 'workflows') },
    { src: path.join(templatesDir, 'references'), dest: path.join(claudeDir, 'maxsim', 'references') },
    { src: path.join(templatesDir, 'templates'), dest: path.join(claudeDir, 'maxsim', 'templates') },
  ];

  for (const { src, dest } of syncMappings) {
    syncDir(src, dest, templateVars, result);
  }

  return result;
}
