/**
 * CLAUDE.md generator — creates the project-root CLAUDE.md file.
 * Kept short (<200 lines as per Anthropic best practices).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Generate CLAUDE.md content for a project.
 * @param projectName - The project name used as the H1 heading (fresh installs only).
 * @param appendMode - When true, omits the H1 heading and starts directly with ## MaxsimCLI.
 */
export function generateClaudeMd(projectName: string, appendMode = false): string {
  const heading = appendMode ? '## MaxsimCLI' : `# ${projectName}\n\n## MaxsimCLI`;
  return `${heading}

This project uses [MaxsimCLI](https://maxsimcli.dev) for structured development.

### Available Commands

| Command | Purpose |
|---------|---------|
| \`/maxsim:go\` | **Auto-dispatch** — detects state and does the right thing |
| \`/maxsim:init\` | Initialize MaxsimCLI in this project |
| \`/maxsim:plan [N]\` | Plan a specific phase |
| \`/maxsim:execute [N]\` | Execute a planned phase |
| \`/maxsim:debug [desc]\` | Debug a specific issue |
| \`/maxsim:quick [desc]\` | Quick task (simplified flow) |
| \`/maxsim:improve [metric]\` | Autonomous optimization loop |
| \`/maxsim:fix-loop [cmd]\` | Autonomous error repair |
| \`/maxsim:debug-loop [symptom]\` | Autonomous bug hunting |
| \`/maxsim:security [scope]\` | Security audit (read-only) |
| \`/maxsim:progress\` | Show project status + recommendation |
| \`/maxsim:settings\` | Configure MaxsimCLI |
| \`/maxsim:help\` | Show help |

### Quick Start

Start with \`/maxsim:go\` — it will detect the project state and guide you.

### GitHub Integration

All project planning lives on GitHub:
- **Project Board**: Visual Kanban (Backlog → To Do → In Progress → In Review → Done)
- **Issues**: Phases and tasks as GitHub Issues with sub-issues
- **Milestones**: Roadmap milestones
- **Comments**: Plans, research, and verification results as structured comments
`;
}

/** Write CLAUDE.md to the project root. */
export function writeClaudeMd(projectDir: string, projectName: string): void {
  const claudeMdPath = path.join(projectDir, 'CLAUDE.md');

  // Don't overwrite existing CLAUDE.md that isn't ours
  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf8');
    if (!existing.includes('MaxsimCLI') && !existing.includes('maxsim')) {
      // Append our section instead of overwriting
      const content = `${existing}\n\n${generateClaudeMd(projectName, true)}`;
      fs.writeFileSync(claudeMdPath, content, 'utf8');
      return;
    }
  }

  fs.writeFileSync(claudeMdPath, generateClaudeMd(projectName), 'utf8');
}
