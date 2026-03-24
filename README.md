# MAXSIM

Meta-prompting and project orchestration system for Claude Code.

[![npm version](https://img.shields.io/npm/v/maxsimcli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/maxsimcli)
[![npm downloads](https://img.shields.io/npm/dm/maxsimcli?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/maxsimcli)
[![GitHub stars](https://img.shields.io/github/stars/maystudios/maxsimcli?style=for-the-badge&logo=github&logoColor=white&color=24292e)](https://github.com/maystudios/maxsimcli)
[![License](https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge)](LICENSE)

[![Website](https://img.shields.io/badge/Website-maxsimcli.dev-3b82f6?style=for-the-badge&logo=googlechrome&logoColor=white)](https://maxsimcli.dev/)
[![Docs](https://img.shields.io/badge/Docs-maxsimcli.dev%2Fdocs-6366f1?style=for-the-badge&logo=readthedocs&logoColor=white)](https://maxsimcli.dev/docs)

---

## The Problem

You start a Claude Code session. The first 20 minutes go well. Then it forgets your architecture decisions, repeats the same mistakes, and output quality drops. You open a fresh session and lose all context.

That is context rot. It gets worse the bigger your project grows.

## What MAXSIM Does

MAXSIM breaks your work into phases, plans each one separately, and runs every task in a fresh agent with only the context it needs. Your decisions, requirements, and project state live on GitHub — Issues, Project Boards, and Milestones. GitHub is the single source of truth. Nothing gets lost between sessions.

It does not call any LLM API directly. MAXSIM orchestrates Claude Code agents through markdown prompts and workflow files. No API keys, no extra costs beyond your existing Claude Code usage. v6 is Claude Code only.

You install it with one command. It lands in your project's `.claude/` directory and shows up as slash commands in Claude Code.

```sh
npx maxsimcli@latest
```

---

## Quick Start

```bash
npx maxsimcli@latest
```

Then inside Claude Code:

```
/maxsim:go
```

**Tip:** `/maxsim:go` auto-detects project state and proposes the right action. Use it as your primary entry point.

Or use the explicit sequence:

```
/maxsim:init        # Set up the planning structure
/maxsim:plan 1      # Plan phase 1
/maxsim:execute 1   # Run phase 1
```

That is the core loop. Init, plan, execute, verify. Each phase is isolated, each task gets a fresh agent, every change gets an atomic commit.

---

## What You Get

MAXSIM ships 13 slash commands, 4 agents, 14 skills, and 18 workflows. Here is what that means in practice.

**Spec-driven development.** All work flows through GitHub — phase Issues, sub-issue tasks, Project Board columns, and structured comments. The GitHub Project Board is the single source of truth. Agents read from it and update it as they work.

**4 generic agents with clear roles.** Executor builds things. Planner creates plans. Researcher investigates the codebase. Verifier checks the results. Each one does one job.

**3 model profiles.** Pick `quality`, `balanced`, or `budget` to control which Claude model tier each agent uses. You can override individual agents too.

**GitHub Issues as the source of truth.** Phases become tracking issues. Plans become sub-issues. A 5-column project board (Backlog, To Do, In Progress, In Review, Done) tracks execution progress.

**Parallel execution with git worktrees.** Independent plans run concurrently in separate worktrees. MAXSIM groups them into dependency-ordered waves and runs each wave in parallel.

**Review gates you can toggle.** Three gates (spec review, code review, simplify review) can be turned on or off. Each supports a retry limit before it escalates.

**Drift detection.** MAXSIM compares your codebase against the spec and flags divergence before it snowballs.

---

## Installation

You need Node.js 22+ and Claude Code. Git is required for parallel execution. GitHub CLI (`gh`) is required for all GitHub operations. MaxsimCLI uses GitHub as the single source of truth.

```bash
npx maxsimcli@latest
```

Run this from your project root. Everything goes into `.claude/`.

### CLI Flags

| Flag | Alias | What it does |
|------|-------|-------------|
| `--uninstall` | | Remove all MAXSIM files from `.claude/` |
| `--quiet` | `-q` | Suppress output |
| `--help` | `-h` | Show usage |
| `--version` | `-v` | Print version |

### What Lands in Your Project

The installer copies these files into `.claude/`:

- 13 slash commands (`/maxsim:init`, `/maxsim:plan`, etc.)
- 4 agent definitions (executor, planner, researcher, verifier)
- 14 skills (TDD, debugging, code review, and more)
- 18 workflow files
- 5 reference documents, 2 rules files
- 5 hooks (statusline, update checker, sounds, capture-learnings)
- 1 tool binary (`maxsim-tools.cjs`)
- `CLAUDE.md` in your project root

### Directory Layout

```
.claude/
├── commands/maxsim/          # 13 slash commands
├── maxsim/
│   ├── bin/maxsim-tools.cjs  # Tool binary
│   ├── workflows/            # 18 workflows
│   ├── templates/            # Planning document templates
│   ├── references/           # 5 reference docs
│   └── hooks/                # 5 hook scripts (.cjs)
├── agents/                   # 4 agents
├── skills/                   # 14 skill directories
├── rules/                    # 2 rules files
├── settings.json
└── CLAUDE.md                 # Not here — see note below
# CLAUDE.md is generated in the project root, not inside .claude/
```

### Upgrading

Run `npx maxsimcli@latest` again. The installer overwrites MAXSIM-managed files. Custom skills you have added to `.claude/skills/` and your own agents are not touched.

### Uninstall

```bash
npx maxsimcli --uninstall
```

Removes MAXSIM files from `.claude/`. Your own skills, agents, and Claude Code config stay untouched.

---

## Commands

| Command | What it does |
|---------|-------------|
| `/maxsim:init` | Initialize MaxsimCLI in current project with GitHub integration |
| `/maxsim:plan <phase>` | Plan a specific phase with discussion, research, and task breakdown |
| `/maxsim:execute <phase>` | Execute all plans in a phase with parallel agents and auto-verification |
| `/maxsim:go` | Auto-detect project state and execute the right action |
| `/maxsim:quick <description>` | Quick task — create a GitHub Issue and execute in simplified flow |
| `/maxsim:progress` | Show project status from GitHub Project Board with next-action recommendation |
| `/maxsim:debug` | Systematic debugging with reproduce-hypothesize-isolate-verify-fix cycle |
| `/maxsim:settings` | View and modify MaxsimCLI configuration |
| `/maxsim:help` | Show available MaxsimCLI commands and usage |

## Core Workflow

MAXSIM organizes development into phases. Each phase moves through five stages.

**1. Initialize** (`/maxsim:init`)

Run once per project. Creates a local `.claude/maxsim/config.json` for CLI settings and connects to GitHub — creating Issues labels, a Project Board, and optionally a Milestone for tracking.

**2. Plan** (`/maxsim:plan <phase>`)

Three steps happen in sequence. A researcher agent inspects the codebase. You discuss scope and acceptance criteria. A planner agent creates a phase tracking issue and sub-issues on GitHub with structured plan content.

**3. Execute** (`/maxsim:execute <phase>`)

An executor agent picks up each plan, makes the code changes, commits atomically, and runs verification before moving on. Independent plans can run in parallel across multiple agents.

**4. Verify**

A verifier agent checks that every plan has a summary, expected artifacts exist, requirements have evidence, and the project passes health checks. Gaps get surfaced before the phase closes.

**5. Complete**

The phase is marked done and progress updates. The next phase becomes active.

Want to plan and execute in one go? Use `/maxsim:go`. Got a quick fix that does not fit a phase? Use `/maxsim:quick <description>`.

## Phase Lifecycle

Phases move through the GitHub Project Board columns:

```
Backlog → To Do → In Progress → In Review → Done
```

| Column | Meaning |
|--------|---------|
| `Backlog` | Phase identified, not yet scheduled |
| `To Do` | Phase planned and ready to start |
| `In Progress` | Execution underway |
| `In Review` | Verification gate active |
| `Done` | All plans executed, verified, and closed |

Phase numbers are flexible. Integer (`01`, `02`), letter suffixes for parallel tracks (`02A`, `02B`), and decimal inserts (`02.1`) all work.

---

## Agents

4 agents, each with one job:

| Agent | Role | What it does |
|-------|------|-------------|
| Executor | Builds things | Reads plans, makes code changes, commits atomically, handles deviations |
| Planner | Creates plans | Turns research into structured PLAN.md files with tasks, waves, and dependencies |
| Researcher | Investigates | Explores the codebase, gathers technical context, can use Brave Search |
| Verifier | Checks results | Validates plan structure, artifacts, requirement evidence, commit integrity |

Each agent is a markdown file at `.claude/agents/{name}.md` with YAML frontmatter for tools, model tier, and preloaded skills.

### Model Profiles

Set `execution.model_profile` in `.claude/maxsim/config.json` to control which Claude model each agent uses:

| Profile | Planner | Executor | Researcher | Verifier |
|---------|---------|----------|------------|----------|
| quality | opus | opus | sonnet | opus |
| balanced | opus | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | haiku | sonnet |

`opus` maps to `inherit`, meaning it uses your Claude Code session model. `sonnet` and `haiku` are passed directly to subagent invocations.

### Per-Agent Overrides

The model profile applies uniformly to all agents of each type. To change which models are used, set `execution.model_profile` in `.claude/maxsim/config.json` to `quality`, `balanced`, or `budget`.

---

## GitHub Integration

MAXSIM tracks phase and plan progress through GitHub Issues. Execution progress lives in GitHub. A local `.claude/maxsim/config.json` holds CLI settings. GitHub CLI (`gh`) and a GitHub-hosted repository are required for this feature.

### Setup

Configured during `/maxsim:init`:

1. Creates a "MAXSIM Task Board" project with 5 columns (Backlog, To Do, In Progress, In Review, Done)
2. Creates 6 labels in 2 namespaces (`type:phase`, `type:task`, `type:bug`, `type:quick`, `maxsim:auto`, `maxsim:user`)
3. Optionally creates a GitHub Milestone

### How It Works

Each phase gets a tracking issue. Each plan becomes a sub-issue linked to its phase. Plan content goes into structured comments. Completion data (commit SHA, files changed) gets posted to task issues. Progress is computed from open vs closed sub-issue counts.

The CLI binary maintains an internal cache that maps phase numbers to GitHub issue numbers. This is an implementation detail of the binary and is not a user-facing file; it is rebuilt automatically from GitHub when needed.

### Tool Commands

The `github` subcommands are dispatched through the `maxsim-tools.cjs` binary. The CLI dispatcher for these commands is not yet fully implemented; the binary is currently a stub. The following subcommands are planned:

| Subcommand | Status | What it does |
|---|---|---|
| `github setup` | planned | Create board, labels, milestone |
| `github create-phase` | planned | Create a phase tracking issue |
| `github create-task` / `batch-create-tasks` | planned | Create task sub-issues |
| `github move-issue` | planned | Move issue between board columns |
| `github status` | planned | Show progress and board overview |
| `github sync-check` | planned | Verify local cache matches GitHub |
| `github all-progress` | planned | Show progress for all phases |

---

## Configuration

Project config lives in `.claude/maxsim/config.json`, created during `/maxsim:init`.

### Full Reference

| Setting | Type | Default | What it does |
|---------|------|---------|-------------|
| `version` | `string` | `"6.0.0"` | Config schema version |
| `execution.model_profile` | `'quality' \| 'balanced' \| 'budget'` | `'balanced'` | Model tier for all agents |
| `execution.parallelism.max_agents_per_wave` | `number` | `3` | Cap on concurrent agents per wave |
| `execution.parallelism.max_retries` | `number` | `3` | Max retries per failed plan |
| `execution.parallelism.competition_strategy` | `'none' \| 'quick' \| 'standard' \| 'deep'` | `'standard'` | Parallel competition strategy |
| `execution.verification.strict_mode` | `boolean` | `true` | Enforce all verification gates |
| `execution.verification.require_code_review` | `boolean` | `true` | Code review gate |
| `execution.verification.auto_resolve_conflicts` | `boolean` | `true` | Auto-resolve merge conflicts |
| `worktrees.basePath` | `string` | `'.maxsim-worktrees/'` | Worktree base directory |
| `worktrees.auto_cleanup` | `boolean` | `true` | Remove worktrees after completion |
| `worktrees.branch_prefix` | `string` | `'maxsim/'` | Branch prefix for worktree branches |
| `automation.auto_commit_on_success` | `boolean` | `true` | Auto-commit on successful plan execution |
| `automation.conventional_commits` | `boolean` | `true` | Enforce conventional commit format |
| `automation.co_author` | `string` | `'Co-Authored-By: Claude <noreply@anthropic.com>'` | Co-author trailer added to commits |
| `github.projectName` | `string` | `''` | GitHub Project Board name |
| `github.auto_push` | `boolean` | `true` | Auto-push branches after execution |
| `hooks.enabled` | `boolean` | `true` | Enable all MAXSIM hooks |

### Config Example

```json
{
  "version": "6.0.0",
  "execution": {
    "model_profile": "balanced",
    "parallelism": {
      "max_agents_per_wave": 3,
      "max_retries": 3,
      "competition_strategy": "standard"
    },
    "verification": {
      "strict_mode": true,
      "require_code_review": true,
      "auto_resolve_conflicts": true
    }
  },
  "worktrees": {
    "basePath": ".maxsim-worktrees/",
    "auto_cleanup": true,
    "branch_prefix": "maxsim/"
  },
  "automation": {
    "auto_commit_on_success": true,
    "conventional_commits": true,
    "co_author": "Co-Authored-By: Claude <noreply@anthropic.com>"
  },
  "github": {
    "projectName": "MAXSIM Task Board",
    "auto_push": true
  },
  "hooks": {
    "enabled": true
  }
}
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `BRAVE_API_KEY` | Brave Search API key (or put it in `~/.maxsim/brave_api_key`) |
| `MAXSIM_DEBUG` | Verbose debug logging to stderr |
| `MAXSIM_SOUND=0` | Turn off notification sounds |
| `CI=true` | Suppress sounds in CI |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Enable Agent Teams for parallel execution |

---

## Skills

Skills are reusable prompt modules that agents load on demand. Each skill is a `SKILL.md` file with YAML frontmatter and a markdown body.

### Built-in Skills (14)

| Skill | Category | What it does |
|-------|----------|-------------|
| `tdd` | Task | Test-driven development, Red-Green-Refactor cycle with atomic commits |
| `systematic-debugging` | Methodology | Root-cause analysis: reproduce, hypothesize, isolate, verify, fix |
| `verification` | Methodology | Evidence-based verification with quality gates and anti-rationalization enforcement |
| `maxsim-simplify` | Task | Reviews changed code for reuse opportunities and unnecessary complexity |
| `code-review` | Task | Checks security, interfaces, error handling, test coverage |
| `project-memory` | Task | GitHub-native persistence for learnings, decisions, and patterns |
| `using-maxsim` | Task | Routes work through MaxsimCLI commands based on project state |
| `brainstorming` | Task | Explores multiple approaches with structured comparison before committing |
| `roadmap-writing` | Task | Creates phased roadmaps with dependency graphs and GitHub Milestone structure |
| `maxsim-batch` | Task | Decomposes tasks for parallel worktree execution |
| `commit-conventions` | Convention | Conventional commit format and version trigger rules |
| `github-operations` | Reference | Unified GitHub interaction: artifacts, comments, CLI, issue lifecycle |
| `handoff-contract` | Protocol | Agent-to-agent handoff protocol |
| `research` | Methodology | Systematic investigation using parallel agents and source hierarchy |

### Skill Types

Protocol skills load automatically (handoff-contract). Methodology skills guide how agents think. Task skills are user-invocable workflows like TDD or code review. Reference skills provide static information.

### Managing Skills

Built-in skills update when you upgrade MAXSIM. Custom skills you place in `.claude/skills/` are preserved.

---

## Parallel Execution

MAXSIM can run multiple plans at the same time using git worktrees. Each plan gets its own isolated working directory.

Plans within a phase are grouped into waves. Wave 1 runs first, wave 2 starts after wave 1 finishes. Plans in the same wave run in parallel if they do not touch the same files.

Each parallel plan gets a worktree at `.maxsim-worktrees/{planId}/` on its own branch. Worktrees are cleaned up automatically after completion.

### When It Activates

`execution.parallelism.max_agents_per_wave` caps concurrent agents per wave (default 3). `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set automatically in `settings.json` during installation.

Before running in parallel, MAXSIM checks that plans do not modify the same files. If there is a conflict, it falls back to sequential mode.

---

## Hooks

MAXSIM installs 5 Claude Code hooks:

| Hook | Event | What it does |
|------|-------|-------------|
| `maxsim-statusline` | `statusLine` | Shows model tier, phase number, board column, and milestone progress |
| `maxsim-check-update` | `SessionStart` | Checks npm for new MAXSIM versions in the background |
| `maxsim-notification-sound` | `Notification` | Plays a sound when Claude asks you a question |
| `maxsim-stop-sound` | `Stop` | Plays a sound when Claude finishes |
| `maxsim-capture-learnings` | `Stop` | Appends a dated learning entry to `.claude/agent-memory/` from the last 5 commits |

### Statusline

```
[update] model | P{N} {BoardColumn} | milestone: pct% | dirname
```

Sounds are suppressed when `MAXSIM_SOUND=0`, `CI=true`, or `SSH_CONNECTION` is set. On Windows sounds play as .wav via PowerShell, on macOS as .aiff via afplay, on Linux it falls back to a terminal bell.

---

## Architecture

### Monorepo

npm workspaces monorepo with two packages:

```
maxsim/
├── packages/
│   ├── cli/          # maxsimcli, the published npm package
│   └── website/      # maxsimcli.dev, project website (private)
├── templates/        # Markdown assets copied into dist during build
└── package.json      # Workspace root
```

Only `packages/cli` gets published to npm as `maxsimcli`.

### Build

```bash
npm run build        # tsdown (CJS) then copy-assets into dist/
npm test             # Vitest unit tests
npm run e2e          # Vitest e2e tests
npm run lint         # Biome
```

tsdown compiles TypeScript to CJS. copy-assets bundles templates, workflows, agents, skills, hooks, and references into `dist/assets/`. semantic-release handles versioning and npm publish on push to `main`.

## Contributing

Conventional commits. See [CONTRIBUTING.md](CONTRIBUTING.md).

- `fix:` triggers a patch release
- `feat:` triggers a minor release
- `feat!:` or `BREAKING CHANGE:` triggers a major release

## License

[MIT](LICENSE)
