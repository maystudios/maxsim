# MAXSIM

Your AI coding assistant forgets things between sessions. MAXSIM keeps it on track.

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

MAXSIM breaks your work into phases, plans each one separately, and runs every task in a fresh agent with only the context it needs. Your decisions, requirements, and project state live in a `.planning/` directory. Agents read from it and write back to it. Nothing gets lost between sessions.

It does not call any LLM API directly. MAXSIM orchestrates Claude Code agents through markdown prompts and workflow files. No API keys, no extra costs beyond your existing Claude Code usage.

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
/maxsim:init        # Set up the planning structure
/maxsim:plan 1      # Plan phase 1
/maxsim:execute 1   # Run phase 1
```

That is the core loop. Init, plan, execute, verify. Each phase is isolated, each task gets a fresh agent, every change gets an atomic commit.

---

## What You Get

MAXSIM ships 9 slash commands, 4 agents, 21 skills, and 23 workflows. Here is what that means in practice.

**Spec-driven development.** All work flows through structured markdown files in `.planning/`. PROJECT.md, ROADMAP.md, STATE.md, REQUIREMENTS.md. The spec is the single source of truth. Agents read from it and update it as they work.

**4 agents with clear roles.** Executor builds things. Planner creates plans. Researcher investigates the codebase. Verifier checks the results. Each one does one job.

**4 model profiles.** Pick `quality`, `balanced`, `budget`, or `tokenburner` to control which Claude model tier each agent uses. You can override individual agents too.

**GitHub Issues as the source of truth.** Phases become tracking issues. Plans become sub-issues. A 4-column project board (To Do, In Progress, In Review, Done) mirrors your `.planning/` state.

**Parallel execution with git worktrees.** Independent plans run concurrently in separate worktrees. MAXSIM groups them into dependency-ordered waves and runs each wave in parallel.

**Review gates you can toggle.** Three gates (spec review, code review, simplify review) can be turned on or off. Each supports a retry limit before it escalates.

**Drift detection.** MAXSIM compares your codebase against the spec and flags divergence before it snowballs.

---

## Installation

You need Node.js 22+ and Claude Code. Git is required for parallel execution. GitHub CLI (`gh`) is optional, only needed for the Issues integration.

```bash
npx maxsimcli@latest
```

Run this from your project root. Everything goes into `.claude/`.

### CLI Flags

| Flag | Alias | What it does |
|------|-------|-------------|
| `--local` | `-l` | Install to current project (default) |
| `--uninstall` | `-u` | Remove all MAXSIM files |
| `--config-dir <path>` | `-c` | Custom target directory |
| `--force-statusline` | | Replace existing statusline config |
| `--help` | `-h` | Show usage |
| `--version` | | Print version |

### Skill Management

```bash
npx maxsimcli skill-list                # Show installed skills
npx maxsimcli skill-install <name>      # Add a skill
npx maxsimcli skill-update [name]       # Update one or all
```

### What Lands in Your Project

The installer copies these files into `.claude/`:

- 9 slash commands (`/maxsim:init`, `/maxsim:plan`, etc.)
- 4 agent definitions (executor, planner, researcher, verifier)
- 21 skills (TDD, debugging, code review, and more)
- 23 workflow files
- 14 reference documents, 2 rules files
- 5 hooks (statusline, update checker, sounds)
- 1 tool binary (`maxsim-tools.cjs`)

### Directory Layout

```
.claude/
├── commands/maxsim/          # 9 slash commands
├── maxsim/
│   ├── bin/maxsim-tools.cjs  # Tool binary
│   ├── workflows/            # 23 workflows
│   ├── templates/            # Planning document templates
│   ├── references/           # 14 reference docs
│   ├── VERSION
│   └── CHANGELOG.md
├── agents/                   # 4 agents (maxsim-*.md)
├── skills/                   # 21 skill directories
├── rules/                    # 2 rules files
├── hooks/                    # 5 hook scripts (.js)
├── settings.json
└── package.json
```

### Upgrading

Run `npx maxsimcli@latest` again. The installer backs up your current install to `.claude/maxsim-backup/`, saves your local modifications to `.claude/maxsim-local-patches/`, preserves custom skills and agents, then updates everything.

### Uninstall

```bash
npx maxsimcli --uninstall
```

Removes MAXSIM files from `.claude/`. Your own skills, agents, and Claude Code config stay untouched.

---

## Commands

| Command | What it does |
|---------|-------------|
| `/maxsim:init` | Set up a new project or onboard an existing codebase |
| `/maxsim:plan <phase>` | Research, discuss, and create plans for a phase |
| `/maxsim:execute <phase>` | Run plans for a phase (serial or parallel) |
| `/maxsim:go <phase>` | Plan + execute in one step |
| `/maxsim:quick <description>` | Run an ad-hoc task outside the phase system |
| `/maxsim:progress` | Show project progress |
| `/maxsim:debug` | Start a debug session |
| `/maxsim:settings` | View and change configuration |
| `/maxsim:help` | Show available commands |

## Core Workflow

MAXSIM organizes development into phases. Each phase moves through five stages.

**1. Initialize** (`/maxsim:init`)

Run once per project. Creates the `.planning/` directory with PROJECT.md, ROADMAP.md, STATE.md, REQUIREMENTS.md, and config.json. Optionally connects GitHub Issues for tracking.

**2. Plan** (`/maxsim:plan <phase>`)

Three steps happen in sequence. A researcher agent inspects the codebase. You discuss scope and acceptance criteria. A planner agent writes structured plan files into `.planning/phases/<phase>/`.

**3. Execute** (`/maxsim:execute <phase>`)

An executor agent picks up each plan, makes the code changes, commits atomically, and runs verification before moving on. Independent plans can run in parallel across multiple agents.

**4. Verify**

A verifier agent checks that every plan has a summary, expected artifacts exist, requirements have evidence, and the project passes health checks. Gaps get surfaced before the phase closes.

**5. Complete**

The phase is marked done and progress updates. The next phase becomes active.

Want to plan and execute in one go? Use `/maxsim:go <phase>`. Got a quick fix that does not fit a phase? Use `/maxsim:quick <description>`.

## Phase Lifecycle

```
empty → discussed → researched → planned → partial → complete
```

| State | Meaning |
|-------|---------|
| `empty` | Phase directory exists, no work started |
| `discussed` | Requirements gathered |
| `researched` | Codebase research done |
| `planned` | Plan files written |
| `partial` | Execution started but not finished |
| `complete` | All plans executed and verified |

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

Each agent is a markdown file at `.claude/agents/maxsim-{name}.md` with YAML frontmatter for tools, model tier, and preloaded skills.

A 5th type, Debugger, exists in the model profile system for debug sessions but has no standalone agent file.

### Model Profiles

Set `model_profile` in `.planning/config.json` to control which Claude model each agent uses:

| Agent Type | `quality` | `balanced` (default) | `budget` | `tokenburner` |
|------------|-----------|---------------------|----------|---------------|
| executor | opus | sonnet | sonnet | opus |
| planner | opus | opus | sonnet | opus |
| researcher | opus | sonnet | haiku | opus |
| verifier | sonnet | sonnet | haiku | opus |
| debugger | sonnet | sonnet | haiku | opus |

`opus` maps to `inherit`, meaning it uses your Claude Code session model. `sonnet` and `haiku` are passed directly to subagent invocations.

### Per-Agent Overrides

Override individual agents regardless of profile:

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

MAXSIM tracks phase and plan progress through GitHub Issues. Your `.planning/` files hold project-level documents (roadmap, state, config). Execution progress lives in GitHub.

You need GitHub CLI (`gh`) installed and authenticated, plus a GitHub-hosted repository.

### Setup

Configured during `/maxsim:init`:

1. Creates a "MAXSIM Task Board" project with 4 columns (To Do, In Progress, In Review, Done)
2. Creates labels: `phase` (purple), `task` (blue), `blocker` (red)
3. Optionally creates a GitHub Milestone

### How It Works

Each phase gets a tracking issue. Each plan becomes a sub-issue linked to its phase. Plan content goes into structured comments. Completion data (commit SHA, files changed) gets posted to task issues. Progress is computed from open vs closed sub-issue counts.

A local `.planning/github-issues.json` caches the mapping between phase numbers and issue numbers. It is a performance cache, the system rebuilds it from GitHub when needed.

### Tool Commands

| Subcommand | What it does |
|---|---|
| `github setup` | Create board, labels, milestone |
| `github create-phase` | Create a phase tracking issue |
| `github create-task` / `batch-create-tasks` | Create task sub-issues |
| `github move-issue` | Move issue between board columns |
| `github status` | Show progress and board overview |
| `github sync-check` | Verify local cache matches GitHub |
| `github all-progress` | Show progress for all phases |

---

## Configuration

Project config lives in `.planning/config.json`, created during `/maxsim:init`.

### Full Reference

| Setting | Type | Default | What it does |
|---------|------|---------|-------------|
| `model_profile` | `'quality' \| 'balanced' \| 'budget' \| 'tokenburner'` | `'balanced'` | Model tier for all agents |
| `model_overrides` | `Record<AgentType, ModelTier>` | | Per-agent model overrides |
| `commit_docs` | `boolean` | `true` | Auto-commit `.planning/` changes |
| `search_gitignored` | `boolean` | `false` | Include gitignored files in codebase mapping |
| `branching_strategy` | `'none' \| 'phase' \| 'milestone'` | `'none'` | Git branching strategy |
| `phase_branch_template` | `string` | `'maxsim/phase-{phase}-{slug}'` | Branch name template for phases |
| `milestone_branch_template` | `string` | `'maxsim/{milestone}-{slug}'` | Branch name template for milestones |
| `workflow.research` | `boolean` | `true` | Run research before planning |
| `workflow.plan_checker` | `boolean` | `true` | Run plan checker agent |
| `workflow.verifier` | `boolean` | `true` | Run verifier after execution |
| `parallelization` | `boolean` | `true` | Allow parallel plan execution |
| `worktree_mode` | `'auto' \| 'always' \| 'never'` | `'auto'` | When to use git worktrees |
| `max_parallel_agents` | `number` | `10` | Cap on concurrent agents |
| `brave_search` | `boolean` | `false` | Let researcher agents use Brave Search |
| `review.spec_review` | `boolean` | `true` | Spec review gate |
| `review.code_review` | `boolean` | `true` | Code review gate |
| `review.simplify_review` | `boolean` | `true` | Simplification review gate |
| `review.retry_limit` | `number` | `3` | Max retries per review gate |

### User-Level Defaults

Put global defaults in `~/.maxsim/defaults.json`. These merge with hardcoded defaults when a new `.planning/config.json` gets created. They do not override existing project configs.

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

### Built-in Skills (21)

| Skill | Category | What it does |
|-------|----------|-------------|
| `tdd` | Task | Test-driven development, Red-Green-Refactor cycle |
| `systematic-debugging` | Methodology | Root-cause analysis: reproduce, hypothesize, isolate, verify, fix |
| `verification-before-completion` | Methodology | Requires evidence before marking work as done |
| `maxsim-simplify` | Task | Finds duplication, dead code, and unnecessary complexity |
| `code-review` | Task | Checks security, interfaces, error handling, test coverage |
| `memory-management` | Task | Persists patterns and decisions to project memory |
| `using-maxsim` | Task | Routes work through the spec-driven workflow |
| `brainstorming` | Task | Explores multiple approaches before picking a design |
| `roadmap-writing` | Task | Creates structured roadmaps with phased planning |
| `sdd` | Task | Spec-driven development, sequential tasks with fresh context |
| `maxsim-batch` | Task | Decomposes tasks for parallel worktree execution |
| `agent-system-map` | Reference | Overview of the agent system |
| `commit-conventions` | Convention | Conventional commit format and version trigger rules |
| `evidence-collection` | Methodology | Structured evidence gathering for verification |
| `github-artifact-protocol` | Reference | How to read and write GitHub Issue artifacts |
| `github-tools-guide` | Reference | Guide to the GitHub CLI commands |
| `handoff-contract` | Protocol | Agent-to-agent handoff protocol |
| `input-validation` | Protocol | Input validation rules for agents |
| `research-methodology` | Methodology | Structured research approach for agents |
| `tool-priority-guide` | Reference | Which tools to prefer for which tasks |
| `verification-gates` | Protocol | Review gate protocol with pass/fail criteria |

### Skill Types

Protocol skills load automatically (handoff-contract, verification-gates, input-validation). Methodology skills guide how agents think. Task skills are user-invocable workflows like TDD or code review. Reference skills provide static information.

### Managing Skills

```bash
npx maxsimcli skill-list              # Show installed skills
npx maxsimcli skill-install <name>    # Add a skill
npx maxsimcli skill-update [name]     # Update one or all
```

Built-in skills update when you upgrade MAXSIM. Custom skills you place in `.claude/skills/` are preserved.

---

## Parallel Execution

MAXSIM can run multiple plans at the same time using git worktrees. Each plan gets its own isolated working directory.

Plans within a phase are grouped into waves. Wave 1 runs first, wave 2 starts after wave 1 finishes. Plans in the same wave run in parallel if they do not touch the same files.

Each parallel plan gets a worktree at `.maxsim-worktrees/{planId}/` on its own branch. Worktrees are cleaned up automatically after completion.

### When It Activates

In `auto` mode (default), parallel execution kicks in when one wave has more than 2 plans and `parallelization` is `true` in config. Set `worktree_mode` to `always` or `never` for manual control. `max_parallel_agents` caps concurrent agents at 10 by default.

You need `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` set in your environment and a git repository.

Before running in parallel, MAXSIM checks that plans do not modify the same files. If there is a conflict, it falls back to sequential mode.

---

## Hooks

MAXSIM installs 5 Claude Code hooks:

| Hook | Event | What it does |
|------|-------|-------------|
| `maxsim-statusline` | `statusLine` | Shows model tier, phase number, board column, and milestone progress |
| `maxsim-check-update` | `SessionStart` | Checks npm for new MAXSIM versions in the background |
| `maxsim-notification-sound` | `PostToolUse` | Plays a sound when Claude asks you a question |
| `maxsim-stop-sound` | `Stop` | Plays a sound when Claude finishes |
| `maxsim-sync-reminder` | `PostToolUse` | No-op stub, kept for structural reasons |

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
