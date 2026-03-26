import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter } from '../../src/core/utils.js';

const TEMPLATES_DIR = path.resolve(__dirname, '../../dist/assets/templates');

const PLANNING_WRITE_PATTERNS = [
  /create\s+\.planning/i,
  /write\s+to\s+\.planning/i,
  /mkdir\s+\.planning/i,
];

describe('command templates', () => {
  const commandsDir = path.join(TEMPLATES_DIR, 'commands', 'maxsim');
  const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));

  it('exactly 14 .md files exist', () => {
    expect(commandFiles).toHaveLength(14);
  });

  it('each file has frontmatter with name, description, and argument-hint', () => {
    for (const file of commandFiles) {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
      const { attributes } = parseFrontmatter(content);
      expect(attributes.name, `${file}: missing name`).toBeDefined();
      expect(attributes.description, `${file}: missing description`).toBeDefined();
      expect(attributes['argument-hint'], `${file}: missing argument-hint`).toBeDefined();
    }
  });

  it('each name starts with maxsim:', () => {
    for (const file of commandFiles) {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
      const { attributes } = parseFrontmatter(content);
      expect(attributes.name, `${file}: name should start with maxsim:`).toMatch(/^maxsim:/);
    }
  });

  it('no command file uses Task( as a tool invocation pattern', () => {
    for (const file of commandFiles) {
      const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
      expect(content, `${file}: should not use Task( — use Agent instead`).not.toContain('Task(');
    }
  });
});

describe('agent templates', () => {
  const agentsDir = path.join(TEMPLATES_DIR, 'agents');
  const allAgentMd = fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md'));
  const agentFiles = allAgentMd.filter((f) => f !== 'AGENTS.md');

  it('exactly 4 agent .md files exist plus AGENTS.md', () => {
    expect(agentFiles).toHaveLength(4);
    expect(allAgentMd).toContain('AGENTS.md');
  });

  it('each agent .md has frontmatter with name and tools', () => {
    for (const file of agentFiles) {
      const content = fs.readFileSync(path.join(agentsDir, file), 'utf-8');
      const { attributes } = parseFrontmatter(content);
      expect(attributes.name, `${file}: missing name`).toBeDefined();
      expect(attributes.tools, `${file}: missing tools`).toBeDefined();
    }
  });
});

describe('skill templates', () => {
  const skillsDir = path.join(TEMPLATES_DIR, 'skills');
  const skillDirs = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory());

  it('exactly 15 subdirectories exist', () => {
    expect(skillDirs).toHaveLength(15);
  });

  it('each subdirectory contains an index.md file', () => {
    for (const dir of skillDirs) {
      const skillMd = path.join(skillsDir, dir.name, 'index.md');
      expect(fs.existsSync(skillMd), `${dir.name}: missing index.md`).toBe(true);
    }
  });

  it('each index.md has frontmatter with name and description', () => {
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(skillsDir, dir.name, 'index.md'), 'utf-8');
      const { attributes } = parseFrontmatter(content);
      expect(attributes.name, `${dir.name}/index.md: missing name`).toBeDefined();
      expect(attributes.description, `${dir.name}/index.md: missing description`).toBeDefined();
    }
  });
});

describe('workflow templates', () => {
  const workflowsDir = path.join(TEMPLATES_DIR, 'workflows');
  const workflowFiles = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.md'));

  it('at least 10 .md files exist', () => {
    expect(workflowFiles.length).toBeGreaterThanOrEqual(10);
  });

  it('no workflow uses .planning/ as a write or create target', () => {
    for (const file of workflowFiles) {
      const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');
      for (const pattern of PLANNING_WRITE_PATTERNS) {
        expect(
          pattern.test(content),
          `${file}: contains a write/create reference to .planning/ (use GitHub Issues instead)`,
        ).toBe(false);
      }
    }
  });
});
