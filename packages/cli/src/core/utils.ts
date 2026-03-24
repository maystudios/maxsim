/**
 * Shared path helpers and frontmatter utilities for MaxsimCLI.
 */

import * as path from 'node:path';

/** Returns the path to the `.claude` directory within the given project. */
export function claudeDir(projectDir: string): string {
  return path.join(projectDir, '.claude');
}

/** Returns the path to the `.claude/maxsim` directory within the given project. */
export function maxsimDir(projectDir: string): string {
  return path.join(claudeDir(projectDir), 'maxsim');
}

/** Returns the path to the agent-memory learner directory within the given project. */
export function agentMemoryDir(projectDir: string): string {
  return path.join(claudeDir(projectDir), 'agent-memory', 'maxsim-learner');
}

/** Returns the path to the MaxsimCLI config file within the given project. */
export function configPath(projectDir: string): string {
  return path.join(maxsimDir(projectDir), 'config.json');
}

/** Result of parsing YAML frontmatter from a content string. */
export interface FrontmatterResult {
  attributes: Record<string, string>;
  body: string;
}

/**
 * Parses YAML frontmatter delimited by `---` from the beginning of a string.
 * Only flat `key: value` lines are supported — no nested YAML.
 * Returns `{ attributes: {}, body: content }` if no frontmatter is found.
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  const DELIMITER = '---';

  if (!content.startsWith(DELIMITER)) {
    return { attributes: {}, body: content };
  }

  const afterOpening = content.slice(DELIMITER.length);
  // The opening delimiter must be followed by a newline (or end-of-string).
  if (afterOpening.length > 0 && afterOpening[0] !== '\n' && afterOpening[0] !== '\r') {
    return { attributes: {}, body: content };
  }

  const closingIndex = afterOpening.indexOf(`\n${DELIMITER}`);
  if (closingIndex === -1) {
    return { attributes: {}, body: content };
  }

  const frontmatterText = afterOpening.slice(0, closingIndex);
  const afterClosing = afterOpening.slice(closingIndex + 1 + DELIMITER.length);
  // Body starts after an optional newline following the closing delimiter.
  const body = afterClosing.startsWith('\n') ? afterClosing.slice(1) : afterClosing;

  const attributes: Record<string, string> = {};
  for (const line of frontmatterText.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();
    if (key.length > 0) {
      attributes[key] = value;
    }
  }

  return { attributes, body };
}
