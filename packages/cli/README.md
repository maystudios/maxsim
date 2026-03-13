# MAXSIM

**Spec-driven workflow orchestration for Claude Code — eliminate context rot across AI-assisted development sessions.**

[![npm version](https://img.shields.io/npm/v/maxsimcli)](https://www.npmjs.com/package/maxsimcli)
[![Node.js >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![CI](https://github.com/maystudios/maxsim/actions/workflows/release.yml/badge.svg)](https://github.com/maystudios/maxsim/actions)

---

## What is MAXSIM?

MAXSIM is a spec-driven workflow orchestration system for Claude Code. It provides a structured layer of planning documents, phase plans, and specialized AI agents that keep your project's intent, decisions, and current state consistently available — session to session, agent to agent.

The problem it solves is "context rot": the gradual loss of coherent project state that happens when AI coding assistants start each session from scratch, rediscover the same constraints, and drift from prior decisions. MAXSIM combats this by maintaining a `.planning/` directory of markdown files as the authoritative record of what the project is, where it is going, and what has already been decided. GitHub Issues serve as the single source of truth for discrete work items, keeping planning artifacts and execution history tightly linked.

MAXSIM does not call any LLM API directly. It orchestrates Claude Code agents through markdown prompts, workflow definitions, and context documents — so there are no API keys to configure and no additional costs beyond your existing Claude Code usage. It is installed via `npx maxsimcli@latest` into a project's `.claude/` directory, making it immediately available as slash commands inside Claude Code.

---

## Quick Start

Install MAXSIM into your project:

```sh
npx maxsimcli@latest
```

Then, inside Claude Code:

```
/maxsim:init        # Initialize project planning structure
/maxsim:plan 1      # Plan phase 1
/maxsim:execute 1   # Execute phase 1
```

---

## Features

### Spec-Driven Development

All work flows through a `.planning/` directory containing structured markdown files — `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, and more. The spec is the single source of truth; agents read from and write back to it throughout the development lifecycle.

### 4 Specialized Agents

MAXSIM ships with four purpose-built agents: **executor** (implements plans), **planner** (creates plans), **researcher** (investigates technical questions), and **verifier** (validates completed work). Consolidated from 14 agents in v5.0, each agent is scoped to a single responsibility.

### 4 Model Profiles

Choose a model profile to control cost and quality across all agent types: **quality**, **balanced** (default), **budget**, and **tokenburner**. Each profile maps the five agent types (executor, planner, researcher, verifier, debugger) to an appropriate Claude model tier (Opus, Sonnet, or Haiku).

### GitHub Issues Integration

GitHub Issues is the single source of truth for phase and plan tracking. MAXSIM automatically creates issues, links sub-issues, and maintains a 4-column project board (To Do, In Progress, In Review, Done) that mirrors the state of your `.planning/` directory.

### Wave-Based Parallel Execution

Plans within a phase can execute concurrently using git worktrees and Claude Code Agent Teams. MAXSIM groups plans into dependency-ordered waves, running each wave in parallel to reduce total execution time.

### 21 Built-in Skills

Skills are reusable prompt modules loaded by agents on demand. The 21 built-in skills cover test-driven development, debugging, code review, brainstorming, and more — each delivered as a self-contained markdown file.

### 23 Workflows

Workflows are step-by-step markdown processes for every stage of the lifecycle: init, planning, execution, verification, and more. All 23 workflows are available out of the box and can be extended or overridden per project.

### Configurable Review Gates

Three review gates — `spec_review`, `code_review`, and `simplify_review` — can be enabled or disabled independently. Each gate supports a configurable retry limit before escalating or failing.

### Phase Lifecycle

Phases move through a defined lifecycle: **add → plan → execute → verify → complete → archive**. Decimal phase numbers (e.g., `3.1`) are supported for urgent work that must be inserted between existing phases without renumbering.

### Drift Detection

MAXSIM monitors the codebase against the spec — requirements, conventions, and no-gos — and surfaces divergence before it compounds. Drift reports are written to `.planning/` so the team has a clear record of what has deviated and why.

---

## Installation

### Prerequisites

- Node.js >= 22.0.0
- Claude Code (Anthropic's CLI for Claude)
- Git (for worktree-based parallel execution)
- GitHub CLI (`gh`) — optional, for GitHub Issues integration

### Install

```bash
npx maxsimcli@latest
```

Run this command from your project root. MAXSIM installs into your project's `.claude/` directory.

### CLI Flags

| Flag | Alias | Description |
|------|-------|-------------|
| `--local` | `-l` | Install to current project (default) |
| `--uninstall` | `-u` | Remove all MAXSIM files |
| `--config-dir <path>` | `-c` | Custom target directory name |
| `--force-statusline` | | Replace existing statusline config |
| `--help` | `-h` | Show usage |
| `--version` | | Print version |

### Skill Management Subcommands

```bash
npx maxsimcli skill-list                # List installed skills
npx maxsimcli skill-install <name>      # Install a skill
npx maxsimcli skill-update [name]       # Update one or all skills
```

### What Gets Installed

The installer copies files into your project's `.claude/` directory:

- **9 slash commands** (`/maxsim:init`, `/maxsim:plan`, etc.)
- **4 agent definitions** (executor, planner, researcher, verifier)
- **21 built-in skills** (TDD, debugging, code review, etc.)
- **23 workflow files** (step-by-step processes for agents)
- **14 reference documents**
- **2 rules files** (conventions, verification protocol)
- **5 hooks** (statusline, update checker, sounds)
- **1 tool binary** (`maxsim-tools.cjs`)

### Installed Directory Structure

```
.claude/
├── commands/maxsim/          # 9 slash command definitions
├── maxsim/
│   ├── bin/maxsim-tools.cjs  # Internal tool binary
│   ├── workflows/            # 23 workflow files
│   ├── templates/            # Planning document templates
│   ├── references/           # 14 reference documents
│   ├── VERSION               # Installed version
│   └── CHANGELOG.md
├── agents/                   # 4 agent definitions (maxsim-*.md)
├── skills/                   # 21 skill directories
├── rules/                    # 2 rules files
├── hooks/                    # 5 hook scripts (.js)
├── settings.json             # Hook + statusline configuration
└── package.json              # {"type":"commonjs"}
```

### Upgrading

Simply re-run `npx maxsimcli@latest`. The installer:

- Backs up your current installation to `.claude/maxsim-backup/`
- Preserves locally modified files to `.claude/maxsim-local-patches/`
- Preserves custom (non-MAXSIM) skills and agents
- Updates all MAXSIM files

### Uninstall

```bash
npx maxsimcli --uninstall
```

This removes all MAXSIM-managed files from `.claude/`. Your own skills, agents, and other Claude Code configuration are left untouched.

---

## Commands

| Command | Description |
|---------|-------------|
| `/maxsim:init` | Initialize a new MAXSIM project or onboard an existing codebase |
| `/maxsim:plan <phase>` | Research, discuss, and create plans for a phase |
| `/maxsim:execute <phase>` | Execute plans for a phase (serial or parallel) |
| `/maxsim:go <phase>` | Shortcut: plan + execute in one command |
| `/maxsim:quick <description>` | Run a quick ad-hoc task outside the phase system |
| `/maxsim:progress` | Show project progress overview |
| `/maxsim:debug` | Start a debug session for investigating issues |
| `/maxsim:settings` | View and modify MAXSIM configuration |
| `/maxsim:help` | Show available commands and usage |

## Core Workflow

MAXSIM structures development into phases that move through a defined lifecycle. The standard cycle has five stages:

**1. Initialize** — `/maxsim:init`

Run once per project. Creates the `.planning/` directory and scaffolds the core planning files: `PROJECT.md`, `ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, and `config.json`. Optionally sets up GitHub Issues integration so phase progress is tracked in your repository.

**2. Plan** — `/maxsim:plan <phase>`

Planning runs three sub-stages in sequence:

- **Research** — A researcher agent inspects the codebase to understand the current state, relevant files, and constraints.
- **Discuss** — Requirements are gathered through conversation, clarifying scope and acceptance criteria before any plans are written.
- **Create** — A planner agent produces one or more structured plan files in `.planning/phases/<phase>/`, each containing tasks, dependencies, and verification criteria.

**3. Execute** — `/maxsim:execute <phase>`

An executor agent works through the phase plans. For each task it reads the plan, makes the required code changes, commits atomically, and runs the verification step before moving to the next task. On completion, it posts a summary to the linked GitHub Issue.

Plans can be executed serially (one after another) or in parallel across multiple agents when tasks are independent.

**4. Verify**

A verifier agent validates that the phase is fully complete. It checks that every plan has a corresponding summary file, that expected artifacts exist, that requirements have documented evidence, and that the project passes its health checks. Any gaps are surfaced before the phase is closed.

**5. Complete**

The phase is marked done, overall project progress is updated, and the phase can be archived as part of the milestone record. The next phase in the roadmap becomes active.

---

For a combined plan-then-execute flow, use `/maxsim:go <phase>`. For work that does not fit a phase — a quick fix, a one-off investigation, an isolated change — use `/maxsim:quick <description>` to run an ad-hoc task without touching the planning system.

## Phase Lifecycle

Every phase moves through the following states:

```
empty → discussed → researched → planned → partial → complete
```

| State | Meaning |
|-------|---------|
| `empty` | Phase directory exists but no work has started |
| `discussed` | Requirements have been gathered |
| `researched` | Codebase research is complete |
| `planned` | One or more plan files have been written |
| `partial` | Execution has started but not all plans are done |
| `complete` | All plans executed and verified |

Phase numbers are flexible. MAXSIM supports integer phases (`01`, `02`), letter suffixes for parallel tracks (`02A`, `02B`), and decimal insertions for phases added between existing ones (`02.1`).

---

## Agents

MAXSIM uses 4 specialized Claude Code agents, each with a distinct role:

| Agent | Role | Description |
|-------|------|-------------|
| **Executor** | Implements plans | Reads structured plans, makes code changes with atomic commits, handles deviations, runs verification per task |
| **Planner** | Creates plans | Transforms research and context into structured PLAN.md files with YAML frontmatter, tasks, waves, and dependencies |
| **Researcher** | Investigates | Explores the codebase and gathers technical context before planning. Can use Brave Search API for web research. |
| **Verifier** | Validates work | Verifies phase completion: plan structure, artifact existence, requirement evidence, commit validity, project health |

Each agent is a markdown file installed at `.claude/agents/maxsim-{name}.md` with YAML frontmatter specifying tools, model tier, and preloaded skills.

A 5th agent type, **Debugger**, exists in the model profile system for debug sessions but does not have a standalone agent definition file.

### Model Profiles

The `model_profile` setting in `.planning/config.json` controls which Claude model tier each agent type uses:

| Agent Type | `quality` | `balanced` (default) | `budget` | `tokenburner` |
|------------|-----------|---------------------|----------|---------------|
| executor | opus | sonnet | sonnet | opus |
| planner | opus | opus | sonnet | opus |
| researcher | opus | sonnet | haiku | opus |
| verifier | sonnet | sonnet | haiku | opus |
| debugger | sonnet | sonnet | haiku | opus |

- **`opus`** maps to `inherit` — uses the Claude Code session model (typically Opus)
- **`sonnet`** and **`haiku`** are passed directly to subagent invocations

### Per-Agent Overrides

Override individual agent models regardless of profile:

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "executor": "opus",
    "researcher": "haiku"
  }
}
```

---

## GitHub Integration

MAXSIM uses GitHub Issues as the **single source of truth** for phase and plan tracking. Local `.planning/` files store project-level documents (roadmap, state, config), while execution progress lives in GitHub.

### Prerequisites
- GitHub CLI (`gh`) installed and authenticated (`gh auth login`)
- Repository hosted on GitHub

### Setup
GitHub integration is configured during `/maxsim:init`. The setup process:
1. Creates a "MAXSIM Task Board" project (4 columns: To Do, In Progress, In Review, Done)
2. Creates labels: `phase` (purple), `task` (blue), `blocker` (red)
3. Optionally creates a GitHub Milestone

### How It Works
- Each **phase** gets a tracking issue (labeled `phase`, title: `[Phase 01] Phase Name`)
- Each **plan/task** becomes a sub-issue linked to its phase issue
- Plan content is posted as structured comments on phase issues
- Completion data (commit SHA, files changed) is posted to task issues
- Progress is computed from open/closed sub-issue counts

### Local Mapping Cache
A `.planning/github-issues.json` file caches the mapping between phase numbers and GitHub issue numbers. This is a performance cache — the system can rebuild it from GitHub at any time.

### Key Commands (internal tool binary)
The following `github` subcommands are available through the tools binary:

| Subcommand | Description |
|---|---|
| `github setup` | One-shot: create board, labels, milestone |
| `github create-phase` | Create a phase tracking issue |
| `github create-task` / `batch-create-tasks` | Create task sub-issues |
| `github move-issue` | Move issue between board columns |
| `github status` | Combined dashboard: progress + board overview |
| `github sync-check` | Verify local cache matches GitHub state |
| `github all-progress` | Progress for all phases |

---

## Configuration

MAXSIM configuration is stored in `.planning/config.json`. Created during `/maxsim:init` or via the `config-ensure-section` tool command.

### Configuration Reference

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `model_profile` | `'quality' \| 'balanced' \| 'budget' \| 'tokenburner'` | `'balanced'` | Model tier preset for all agent types |
| `model_overrides` | `Record<AgentType, ModelTier>` | — | Per-agent model overrides |
| `commit_docs` | `boolean` | `true` | Auto-commit `.planning/` changes to git |
| `search_gitignored` | `boolean` | `false` | Include gitignored files in codebase mapping |
| `branching_strategy` | `'none' \| 'phase' \| 'milestone'` | `'none'` | Git branching strategy |
| `phase_branch_template` | `string` | `'maxsim/phase-{phase}-{slug}'` | Branch name template for phases |
| `milestone_branch_template` | `string` | `'maxsim/{milestone}-{slug}'` | Branch name template for milestones |
| `workflow.research` | `boolean` | `true` | Enable research phase in planning |
| `workflow.plan_checker` | `boolean` | `true` | Enable plan checker agent |
| `workflow.verifier` | `boolean` | `true` | Enable verifier agent post-execution |
| `parallelization` | `boolean` | `true` | Enable parallel plan execution |
| `worktree_mode` | `'auto' \| 'always' \| 'never'` | `'auto'` | When to use git worktrees |
| `max_parallel_agents` | `number` | `10` | Max concurrent parallel agents |
| `brave_search` | `boolean` | `false` | Enable Brave Search for researcher agents |
| `review.spec_review` | `boolean` | `true` | Enable spec review gate |
| `review.code_review` | `boolean` | `true` | Enable code review gate |
| `review.simplify_review` | `boolean` | `true` | Enable simplification review gate |
| `review.retry_limit` | `number` | `3` | Max review gate retry attempts |

### User-Level Defaults

Place global defaults at `~/.maxsim/defaults.json`. These are merged with hardcoded defaults when a new `.planning/config.json` is created. They do NOT override existing project configs.

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `BRAVE_API_KEY` | Brave Search API key (also: `~/.maxsim/brave_api_key` file) |
| `MAXSIM_DEBUG` | Enable verbose debug logging to stderr |
| `MAXSIM_SOUND=0` | Disable notification sounds |
| `CI=true` | Suppress sounds in CI |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Enable Agent Teams for parallel execution |

---

## Skills

Skills are reusable markdown prompt modules that agents load on demand. Each skill is a `SKILL.md` file with YAML frontmatter (`name`, `description`) and a markdown body containing methodology, protocols, or reference information.

### Built-in Skills (21)

| Skill | Category | Description |
|-------|----------|-------------|
| `tdd` | Task | Test-driven development: Red-Green-Refactor cycle |
| `systematic-debugging` | Methodology | Root-cause analysis: reproduce, hypothesize, isolate, verify, fix |
| `verification-before-completion` | Methodology | Requires evidence before claiming work is done |
| `maxsim-simplify` | Task | Maintainability pass: finds duplication, dead code, complexity |
| `code-review` | Task | Correctness gate: security, interfaces, error handling, coverage |
| `memory-management` | Task | Persists patterns and decisions to project memory files |
| `using-maxsim` | Task | Routes work through MAXSIM's spec-driven workflow |
| `brainstorming` | Task | Explores multiple approaches before committing to a design |
| `roadmap-writing` | Task | Creates structured project roadmaps with phased planning |
| `sdd` | Task | Spec-driven development: sequential tasks with fresh context |
| `maxsim-batch` | Task | Decomposes tasks for parallel worktree execution |
| `agent-system-map` | Reference | Overview of the MAXSIM agent system |
| `commit-conventions` | Convention | Conventional commit format and version trigger rules |
| `evidence-collection` | Methodology | Structured evidence gathering for verification |
| `github-artifact-protocol` | Reference | How to read/write GitHub Issue artifacts |
| `github-tools-guide` | Reference | Guide to MAXSIM's GitHub CLI commands |
| `handoff-contract` | Protocol | Agent-to-agent handoff protocol |
| `input-validation` | Protocol | Input validation rules for agents |
| `research-methodology` | Methodology | Structured research methodology for agents |
| `tool-priority-guide` | Reference | Which tools to prefer for which tasks |
| `verification-gates` | Protocol | Review gate protocol and pass/fail criteria |

### Skill Types

- **Protocol skills** (`user-invocable: false`): Loaded automatically by agents — handoff-contract, verification-gates, input-validation
- **Methodology skills**: Evidence-collection, research-methodology, systematic-debugging, verification-before-completion
- **Task skills**: User-invocable workflows like TDD, code review, brainstorming
- **Reference skills**: Static reference information for agents

### Managing Skills

```bash
npx maxsimcli skill-list              # List installed skills
npx maxsimcli skill-install <name>    # Install a specific skill
npx maxsimcli skill-update [name]     # Update one or all skills
```

Built-in skills are updated on `npx maxsimcli` upgrades. Custom skills (placed manually in `.claude/skills/`) are preserved during upgrades.

---

## Parallel Execution

MAXSIM can execute multiple plans simultaneously using git worktrees, with each plan running in an isolated working directory.

### How It Works
1. Plans within a phase are assigned to **waves** (wave 1 runs first, wave 2 after wave 1 completes)
2. Plans in the same wave can run in parallel if they don't share files
3. Each parallel plan gets its own git worktree at `.maxsim-worktrees/{planId}/` on a branch `maxsim/worktree-{phase}-{planId}`
4. After completion, worktrees are cleaned up automatically

### Execution Mode Decision
In `auto` mode (default), parallel execution activates when:
- There is exactly **one wave** with **more than 2 plans**
- `parallelization` is `true` in config

Manual control:
- `worktree_mode: 'always'` — always use worktrees
- `worktree_mode: 'never'` — always run sequentially
- `max_parallel_agents` — cap on concurrent agents (default: 10)

### Prerequisites
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable set
- Git repository (for worktree support)

### Plan Independence Validation
Before parallel execution, MAXSIM validates that plans don't modify the same files. Conflicts are flagged and execution falls back to sequential mode.

---

## Hook System

MAXSIM installs 5 Claude Code hooks that enhance the development experience:

| Hook | Event | Description |
|------|-------|-------------|
| `maxsim-statusline` | `statusLine` | Shows model tier, phase number, board column, milestone progress in the terminal status bar |
| `maxsim-check-update` | `SessionStart` | Background check for new MAXSIM versions on npm; shows update indicator in statusline |
| `maxsim-notification-sound` | `PostToolUse` (AskUserQuestion) | Plays a system sound when Claude asks a question |
| `maxsim-stop-sound` | `Stop` | Plays a sound when Claude finishes working |
| `maxsim-sync-reminder` | `PostToolUse` (Write\|Edit) | No-op stub (retained for structural reasons after GitHub Issues migration) |

### Statusline Format
```
[update] model | P{N} {BoardColumn} | milestone: pct% | dirname
```

### Sound Control
Sounds are suppressed when:
- `MAXSIM_SOUND=0`
- `CI=true`
- `SSH_CONNECTION` is set

Platform sounds: Windows (`.wav` via PowerShell), macOS (`.aiff` via `afplay`), Linux (terminal bell).

---

## Architecture

### Monorepo Structure

MAXSIM is developed as an npm workspaces monorepo with two packages:

```
maxsim/
├── packages/
│   ├── cli/          # maxsimcli — the published npm package
│   └── website/      # maxsimcli.dev — project website (private)
├── templates/        # Markdown asset templates (copied into dist during build)
└── package.json      # Workspace root
```

Only `packages/cli` is published to npm as `maxsimcli`.

### Build Pipeline

```bash
npm run build        # tsdown (CJS) → copy-assets → dist/
npm test             # Vitest unit tests
npm run e2e          # Vitest e2e tests
npm run lint         # Biome check
```

- **tsdown** compiles TypeScript to CJS (`dist/install.cjs`)
- **copy-assets** bundles templates, workflows, agents, skills, hooks, and references into `dist/assets/`
- **semantic-release** automates versioning and npm publish on push to `main`

## Contributing

MAXSIM uses [conventional commits](https://www.conventionalcommits.org/). See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

- `fix:` → patch release
- `feat:` → minor release
- `feat!:` or `BREAKING CHANGE:` → major release

## License

[MIT](LICENSE)
