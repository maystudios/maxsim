import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter } from '../../src/core/utils.js';

const TEMPLATES_DIR = path.resolve(__dirname, '../../dist/assets/templates');

/**
 * Parse a YAML-style inline array string like "[Read, Write, Edit]" into an
 * array of trimmed strings.
 */
function parseToolList(raw: string | undefined): string[] {
  if (!raw) return [];
  const inner = raw.replace(/^\[/, '').replace(/]$/, '');
  return inner
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const PLANNING_WRITE_PATTERNS = [
  /write\s+.*\.planning/i,
  /echo\s+.*\.planning/i,
  /mkdir\s+.*\.planning/i,
  /create\s+\.planning/i,
  /write\s+to\s+\.planning/i,
];

describe('workflow validation', () => {
  const commandsDir = path.join(TEMPLATES_DIR, 'commands', 'maxsim');
  const workflowsDir = path.join(TEMPLATES_DIR, 'workflows');
  const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.md'));
  const workflowFiles = fs.readdirSync(workflowsDir).filter((f) => f.endsWith('.md'));

  describe('command frontmatter completeness', () => {
    it('every command file has name, description, argument-hint, and allowed-tools', () => {
      for (const file of commandFiles) {
        const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
        const { attributes } = parseFrontmatter(content);
        expect(attributes.name, `${file}: missing name`).toBeDefined();
        expect(attributes.description, `${file}: missing description`).toBeDefined();
        expect(attributes['argument-hint'], `${file}: missing argument-hint`).toBeDefined();
        expect(attributes['allowed-tools'], `${file}: missing allowed-tools`).toBeDefined();
      }
    });
  });

  describe('no .planning/ writes in workflows', () => {
    it('no workflow file contains write operations to .planning/', () => {
      for (const file of workflowFiles) {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');
        for (const pattern of PLANNING_WRITE_PATTERNS) {
          expect(
            pattern.test(content),
            `${file}: contains a write/create reference to .planning/ — use GitHub Issues instead`,
          ).toBe(false);
        }
      }
    });
  });

  describe('Agent tool not Task', () => {
    it('no command or workflow file contains Task( as a tool invocation', () => {
      const allFiles = [
        ...commandFiles.map((f) => ({ dir: commandsDir, file: f })),
        ...workflowFiles.map((f) => ({ dir: workflowsDir, file: f })),
      ];
      for (const { dir, file } of allFiles) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        expect(
          content,
          `${file}: should not use Task( — use Agent instead`,
        ).not.toContain('Task(');
      }
    });
  });

  describe('EnterPlanMode in modifying commands', () => {
    const exemptCommands = ['help.md', 'progress.md', 'security.md'];

    it('all commands except help, progress, security include EnterPlanMode', () => {
      for (const file of commandFiles) {
        if (exemptCommands.includes(file)) continue;
        const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
        const { attributes } = parseFrontmatter(content);
        const tools = parseToolList(attributes['allowed-tools']);
        expect(
          tools,
          `${file}: should include EnterPlanMode in allowed-tools`,
        ).toContain('EnterPlanMode');
      }
    });
  });

  describe('CLI command references in workflows', () => {
    // Regex to match CLI invocations: node ... maxsim-tools.cjs <command> [subcommand]
    // Requires 'node' before maxsim-tools.cjs to avoid matching prose like "maxsim-tools.cjs present"
    const CLI_INVOCATION_REGEX = /node\s+\S*maxsim-tools\.cjs\s+([\w-]+)(?:\s+([\w-]+))?/g;

    // Known CLI commands (flat)
    const FLAT_COMMANDS = new Set([
      'resolve-model', 'resolve-max-agents', 'resolve-wave-size',
      'config-get', 'config-set', 'config-ensure-section',
      'config-save-defaults', 'validate-structure',
    ]);

    // Known namespaced commands
    const NAMESPACE_COMMANDS: Record<string, Set<string>> = {
      github: new Set([
        'get-issue', 'list-issues', 'list-sub-issues',
        'post-comment', 'close-issue', 'reopen-issue', 'create-issue',
        'ensure-labels', 'add-label', 'remove-label', 'delete-comments',
        'move-issue', 'set-project', 'status', 'create-phase', 'create-milestone',
        'post-plan-comment', 'batch-create-tasks', 'all-progress',
        'detect-external-edits', 'handle-verification-failure', 'handle-verification-success',
      ]),
      init: new Set([
        'plan-phase', 'execute-phase', 'phase-op',
      ]),
    };

    it('all CLI command references in workflow files point to real commands', () => {
      const errors: string[] = [];

      for (const file of workflowFiles) {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');
        const regex = new RegExp(CLI_INVOCATION_REGEX.source, 'g');

        for (const m of content.matchAll(regex)) {
          const first = m[1];
          const second = m[2];

          if (NAMESPACE_COMMANDS[first]) {
            if (second && !NAMESPACE_COMMANDS[first].has(second)) {
              errors.push(`${file}: unknown ${first} subcommand "${second}"`);
            }
          } else if (!FLAT_COMMANDS.has(first)) {
            const label = second ? `${first} ${second}` : first;
            errors.push(`${file}: unknown command "${label}"`);
          }
        }
      }

      expect(errors, `Broken CLI references:\n${errors.join('\n')}`).toHaveLength(0);
    });
  });

  describe('workflow file references', () => {
    it('all .claude/maxsim/workflows/ references point to existing workflow files', () => {
      const errors: string[] = [];
      const workflowRefRegex = /\.claude\/maxsim\/workflows\/([\w-]+\.md)/g;

      for (const file of workflowFiles) {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');

        for (const m of content.matchAll(workflowRefRegex)) {
          const referenced = m[1];
          if (!workflowFiles.includes(referenced)) {
            errors.push(`${file}: references non-existent workflow "${referenced}"`);
          }
        }
      }

      expect(errors, `Broken workflow references:\n${errors.join('\n')}`).toHaveLength(0);
    });
  });

  describe('LS, TodoRead, TodoWrite in Plan Mode commands', () => {
    const planModeCommands = [
      'go.md',
      'init.md',
      'plan.md',
      'execute.md',
      'execute-phase.md',
      'quick.md',
      'improve.md',
      'fix-loop.md',
      'debug-loop.md',
      'debug.md',
      'settings.md',
    ];

    const requiredTools = ['LS', 'TodoRead', 'TodoWrite'];

    for (const tool of requiredTools) {
      it(`all 11 Plan Mode commands include ${tool}`, () => {
        for (const file of planModeCommands) {
          const content = fs.readFileSync(path.join(commandsDir, file), 'utf-8');
          const { attributes } = parseFrontmatter(content);
          const tools = parseToolList(attributes['allowed-tools']);
          expect(tools, `${file}: should include ${tool} in allowed-tools`).toContain(tool);
        }
      });
    }
  });
});
