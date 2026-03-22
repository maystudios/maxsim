/**
 * Shared utilities for MaxsimCLI.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';

/** Parse YAML frontmatter from a markdown string. */
export function parseFrontmatter(content: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const lines = content.split(/\r?\n/);

  if (lines[0]?.trim() !== '---') {
    return { data: {}, body: content };
  }

  const endIndex = lines.findIndex((line, i) => i > 0 && line.trim() === '---');
  if (endIndex === -1) {
    return { data: {}, body: content };
  }

  const yamlBlock = lines.slice(1, endIndex).join('\n').trim();
  const body = lines.slice(endIndex + 1).join('\n');

  if (!yamlBlock) {
    return { data: {}, body };
  }

  try {
    const data = (parseYaml(yamlBlock) as Record<string, unknown>) ?? {};
    return { data, body };
  } catch {
    return { data: {}, body };
  }
}

/** Pad a phase number to 2 digits: 1 → "01", 10 → "10". */
export function padPhaseNumber(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Walk up from startDir to find a directory containing `.claude/`.
 * Returns the project root path, or null if not found.
 */
export function detectProjectRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const claudeDir = path.join(current, '.claude');
    if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null; // reached filesystem root
    }
    current = parent;
  }
}
