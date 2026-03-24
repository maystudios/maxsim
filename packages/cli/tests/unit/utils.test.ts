import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
  claudeDir,
  maxsimDir,
  agentMemoryDir,
  configPath,
  parseFrontmatter,
} from '../../src/core/utils.js';

describe('path helpers', () => {
  const PROJECT = '/home/user/project';

  it('claudeDir returns <projectDir>/.claude', () => {
    expect(claudeDir(PROJECT)).toBe(path.join(PROJECT, '.claude'));
  });

  it('maxsimDir returns <projectDir>/.claude/maxsim', () => {
    expect(maxsimDir(PROJECT)).toBe(path.join(PROJECT, '.claude', 'maxsim'));
  });

  it('agentMemoryDir returns <projectDir>/.claude/agent-memory/maxsim-learner', () => {
    expect(agentMemoryDir(PROJECT)).toBe(
      path.join(PROJECT, '.claude', 'agent-memory', 'maxsim-learner'),
    );
  });

  it('configPath returns <projectDir>/.claude/maxsim/config.json', () => {
    expect(configPath(PROJECT)).toBe(
      path.join(PROJECT, '.claude', 'maxsim', 'config.json'),
    );
  });
});

describe('parseFrontmatter', () => {
  it('extracts key-value attributes and body from valid frontmatter', () => {
    const content = `---\ntitle: Hello World\nauthor: Alice\n---\nBody text here.`;
    const result = parseFrontmatter(content);
    expect(result.attributes).toEqual({ title: 'Hello World', author: 'Alice' });
    expect(result.body).toBe('Body text here.');
  });

  it('returns empty attributes and full content when no frontmatter is present', () => {
    const content = 'Just plain text, no frontmatter.';
    const result = parseFrontmatter(content);
    expect(result.attributes).toEqual({});
    expect(result.body).toBe(content);
  });

  it('returns empty attributes and full content for empty string', () => {
    const result = parseFrontmatter('');
    expect(result.attributes).toEqual({});
    expect(result.body).toBe('');
  });

  it('handles frontmatter with no body', () => {
    const content = `---\nkey: value\n---\n`;
    const result = parseFrontmatter(content);
    expect(result.attributes).toEqual({ key: 'value' });
    expect(result.body).toBe('');
  });

  it('handles frontmatter where value contains a colon', () => {
    const content = `---\nurl: https://example.com\n---\nbody`;
    const result = parseFrontmatter(content);
    expect(result.attributes.url).toBe('https://example.com');
    expect(result.body).toBe('body');
  });

  it('treats content starting with --- but missing closing delimiter as no frontmatter', () => {
    const content = `---\ntitle: Unterminated`;
    const result = parseFrontmatter(content);
    expect(result.attributes).toEqual({});
    expect(result.body).toBe(content);
  });
});
