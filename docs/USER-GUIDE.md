# MaxsimCLI User Guide

> **MaxsimCLI** — **MAX**imal **SIM**plicity. One command to install. One command to run. GitHub as the single source of truth.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Commands](#commands)
- [Workflow](#workflow)
- [GitHub Integration](#github-integration)
- [Configuration](#configuration)
- [Agent System](#agent-system)
- [Skills](#skills)
- [Self-Improvement](#self-improvement)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Install

```bash
npx maxsimcli@latest
```

Run this in your project directory. MaxsimCLI installs project-locally into `.claude/`. Nothing is installed globally.

**Requirements:**
- Node.js >= 22
- GitHub CLI (`gh`) installed and authenticated — run `gh auth login` if needed
- Claude Code

### 2. Start

```
/maxsim:go
```

That is the entire interface. MaxsimCLI reads your GitHub Project Board, determines what state the project is in, proposes the right next action, waits for your approval, and executes.

### 3. That is it

MaxsimCLI detects what to do next automatically:

- No GitHub repo? It offers to create one.
- No project board? It runs `/maxsim:init` to set one up.
- A phase is planned and ready? It executes it.
- Work is in progress? It resumes from where it left off.
- Something broke? It enters debug mode.

You never need to remember where you were. `/maxsim:go` always knows.

---

## Commands

MaxsimCLI provides 13 slash commands. `/maxsim:go` is the primary interface — use the others when you want explicit control over a specific step.

| Command | Description | Example |
|---------|-------------|---------|
| `/maxsim:go` | **Auto-dispatch.** Reads the GitHub Project Board, detects project state, proposes and executes the right next action. The command you will use most. | `/maxsim:go` |
| `/maxsim:init` | **Initialize** MaxsimCLI in a project. Interviews you about the project, scans existing code (brownfield), creates the GitHub repo, project board, labels, and milestones. | `/maxsim:init` |
| `/maxsim:plan [N]` | **Plan a specific phase.** Runs parallel research agents, creates a task breakdown as GitHub sub-issues, and enters Plan Mode for your approval. | `/maxsim:plan 3` |
| `/maxsim:execute [N]` | **Execute a planned phase.** Shows the full plan for approval, then spawns executor agents in parallel waves — each in its own git worktree. Verifies, merges, and pushes automatically. | `/maxsim:execute 3` |
| `/maxsim:debug [desc]` | **Debug a specific issue.** Runs systematic debugging: reproduce, hypothesize, isolate, verify, fix, confirm. Also triggered automatically by `/maxsim:go` when issues exist. | `/maxsim:debug "login fails on mobile"` |
| `/maxsim:quick [desc]` | **Quick task.** Simplified single-issue flow for small changes — no multi-phase overhead. Creates a GitHub Issue, plans it, and executes in one pass. | `/maxsim:quick "update the README"` |
| `/maxsim:progress` | **Show project status.** Reads the GitHub Project Board and displays a summary of what is done, what is in progress, and what to do next. | `/maxsim:progress` |
| `/maxsim:settings` | **Configure MaxsimCLI.** Change model profiles, verification settings, parallelism, and other options. Writes to `.claude/maxsim/config.json`. | `/maxsim:settings` |
| `/maxsim:help` | **Show available commands.** Quick reference for all commands. | `/maxsim:help` |
| `/maxsim:improve [metric]` | **Autonomous optimization loop.** Iteratively modifies the codebase, verifies the result, and keeps or discards changes based on whether the target metric improves. | `/maxsim:improve performance` |
| `/maxsim:fix-loop [cmd]` | **Autonomous error repair.** Runs the given command, diagnoses failures, applies fixes, and repeats until zero errors remain. | `/maxsim:fix-loop "npm test"` |
| `/maxsim:debug-loop [symptom]` | **Autonomous bug hunting.** Applies the scientific method with hypothesis testing — form hypotheses, design experiments, verify, and repeat until the root cause is confirmed and fixed. | `/maxsim:debug-loop "login fails on mobile"` |
| `/maxsim:security [scope]` | **Security audit.** Runs a read-only STRIDE + OWASP + red-team analysis across the specified scope and produces a prioritised finding report. | `/maxsim:security src/` |

### When to use explicit commands vs `/maxsim:go`

Use `/maxsim:go` for normal day-to-day work. Use explicit commands when:

- You want to jump to a specific phase out of sequence: `/maxsim:plan 5`
- You want to re-execute a phase that already ran: `/maxsim:execute 2`
- You have a quick one-off task that does not belong in the roadmap: `/maxsim:quick`
- Something specific broke and you want to go straight to debugging: `/maxsim:debug`

---

## Workflow

MaxsimCLI enforces a four-step cycle for every phase of work:

```
Init → Plan → Execute → Verify
```

### Step 1: Init

`/maxsim:init` runs once per project. It:

1. Scans your existing codebase using parallel Research agents — count scaled by model profile and project size — (brownfield support)
2. Interviews you: project name, goals, tech stack, conventions, testing strategy, acceptance criteria
3. Creates your GitHub repository if none exists
4. Sets up the GitHub Project Board (Kanban: To Do → In Progress → In Review → Done)
5. Creates labels and milestones
6. Optionally generates an initial roadmap as GitHub Issues
7. Writes a `CLAUDE.md` in your project root so Claude Code has context at every session start

After init, your project state lives entirely on GitHub. No local planning files, no `.planning/` directory.

### Step 2: Plan

`/maxsim:plan [N]` plans a specific phase:

1. Enters Plan Mode — Claude Code enters read-only mode. No code changes until you approve.
2. Reads the phase issue from GitHub
3. Spawns parallel Research agents to investigate the codebase and relevant topics
4. Creates a task breakdown as GitHub sub-issues attached to the phase issue
5. Presents the plan for your review
6. You approve via ExitPlanMode. Only then does execution become possible.

You always see the plan before anything is written.

### Step 3: Execute

`/maxsim:execute [N]` executes a planned phase:

1. Enters Plan Mode — shows all planned tasks for final review
2. You approve
3. Executor agents spawn in parallel waves based on task dependencies
4. Each agent works in its own git worktree (`maxsim/phase-{N}-task-{id}`)
5. Competitive implementation: the same task may be solved by 2-3 agents independently; the best result is selected
6. Each task is verified automatically before the worktree is merged
7. Verified worktrees merge sequentially into main; the merged result is verified again
8. Changes are pushed to remote

If verification fails, MaxsimCLI retries up to 3 times with fresh executor agents. After 3 failures, it escalates: creates a diagnostic GitHub Issue and asks for your input.

### Step 4: Verify

Verification is automatic and runs after every task. It checks:

- Tests pass
- Build succeeds
- Lint is clean
- All planned tasks were actually implemented (spec compliance)
- Code review passes (security, quality, efficiency)

Every verification produces a structured evidence block — no completion claims without proof.

The Guard pattern also runs a regression check: "did this task break what was already working?" A task that passes its own verification but breaks existing tests is rejected.

---

## GitHub Integration

GitHub is not optional. MaxsimCLI uses GitHub as the single source of truth for all project state. There are no local planning files.

### Project Board (Kanban)

MaxsimCLI creates and maintains a GitHub Projects v2 board with four columns:

| Column | Meaning |
|--------|---------|
| **To Do** | Phases and tasks that are planned but not started |
| **In Progress** | Work currently being executed |
| **In Review** | Work completed, awaiting verification or approval |
| **Done** | Verified and merged |

The column an issue is in IS its status. No sync needed. No local state file.

### Issues and Sub-Issues

Every unit of work is a GitHub Issue:

- **Phase Issues** — One issue per phase. Created during init or planning. Tracks the phase goal, plan, and progress.
- **Sub-Issues** — One issue per task within a phase. Sub-issues of the phase issue. Created during `/maxsim:plan`.
- **Quick Issues** — Created by `/maxsim:quick` for small one-off tasks.
- **Bug/Debug Issues** — Created automatically when verification fails and human input is needed.

You can also write GitHub Issues directly. MaxsimCLI recognizes user-created issues and integrates them into the planning and execution pipeline.

### Issue Comments

MaxsimCLI stores structured data as issue comments with HTML markers so they can be found and updated reliably:

| Comment Type | Content |
|-------------|---------|
| Plan comment | Research findings, task breakdown, implementation approach |
| Research comment | Parallel agent research results |
| Verification comment | Evidence blocks with test output, build results, lint results |
| Summary comment | What was done, what was decided, what was learned |
| Diagnostic comment | Debug context, error details, reproduction steps |

### Milestones

GitHub Milestones group phases into deliverable versions:

- Each milestone has a title (e.g., `v1.0 — Core Features`), due date, and description
- Milestone completion percentage reflects how many phase issues are closed
- The roadmap is visible at a glance in the GitHub Milestones page

### GitHub Wiki

MaxsimCLI uses the GitHub Wiki to store durable project artifacts that apply across all phases: conventions, requirements, and architecture decisions. Unlike issue comments (which belong to a single issue), the Wiki is a persistent reference visible to anyone working on the project.

### GitHub Discussions

GitHub Discussions are used for architecture decisions and design proposals that benefit from an open-ended conversation format. When a decision is made, the outcome is captured in a project Wiki page or issue comment for reference during planning and execution.

### Labels

MaxsimCLI creates approximately 15 labels across four namespaces:

- **`type:`** — `type:phase`, `type:task`, `type:bug`, `type:quick`, `type:user`
- **`priority:`** — `priority:p0` through `priority:p3`
- **`status:`** — `status:planning`, `status:ready`, `status:blocked`
- **`maxsim:`** — `maxsim:managed`, `maxsim:lesson`, `maxsim:decision`

---

## Configuration

MaxsimCLI reads and writes configuration at:

```
.claude/maxsim/config.json
```

Use `/maxsim:settings` to configure interactively, or edit the file directly.

### Full Schema

```json
{
  "version": "6.0.0",
  "execution": {
    "modelProfile": "balanced",
    "parallelism": {
      "maxAgentsPerWave": 3,
      "maxRetries": 3,
      "competitionStrategy": "standard"
    },
    "verification": {
      "strictMode": true,
      "gates": ["tests_pass", "build_succeeds", "lint_clean", "spec_compliance", "code_review"],
      "requireCodeReview": true,
      "autoResolveConflicts": true
    }
  },
  "worktrees": {
    "basePath": ".maxsim-worktrees/",
    "autoCleanup": true,
    "branchPrefix": "maxsim/"
  },
  "automation": {
    "autoCommitOnSuccess": true,
    "conventionalCommits": true
  }
}
```

### Model Profiles

The `execution.modelProfile` setting controls which Claude model is used for each agent type.

| Agent | `quality` | `balanced` (default) | `budget` |
|-------|-----------|----------------------|----------|
| Planner | Opus | Opus | Sonnet |
| Executor | Opus | Sonnet | Sonnet |
| Researcher | Sonnet | Sonnet | Haiku |
| Verifier | Opus | Sonnet | Sonnet |

**Profile guidance:**

- `quality` — Use when the work is critical and you have token budget. Opus for all decision-making.
- `balanced` — The default. Opus for planning (where architecture decisions happen), Sonnet for execution and verification.
- `budget` — Sonnet for code writing, Haiku for research. Use for high-volume or exploratory work.

Switch profiles at any time with `/maxsim:settings`.

### Verification Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `execution.verification.strictMode` | `true` | Require all verification gates to pass before marking a task complete |
| `execution.verification.requireCodeReview` | `true` | Whether the code review gate runs as part of verification |

Disable `strictMode` only for rapid prototyping where you plan to verify manually later.

### Parallelism Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `execution.parallelism.maxAgentsPerWave` | `3` | Maximum concurrent executor agents per wave |
| `execution.parallelism.maxRetries` | `3` | How many times a failing task is retried before escalation |
| `execution.competitionStrategy` | `"standard"` | Competitive implementation strategy: `none`, `quick`, `standard`, or `deep` |

Competitive implementation uses more tokens but produces higher quality output. Set `execution.competitionStrategy` to `"none"` to disable it on straightforward tasks.

### GitHub Settings

GitHub connection details (repo, project name, push behavior) are configured during `/maxsim:init` and stored in the project's `CLAUDE.md`. They are not part of `config.json`.

---

## Agent System

MaxsimCLI uses 4 specialized agent types that work together to plan, build, research, and verify your project.

### Agent Types

| Agent | Role | What it Does |
|-------|------|-------------|
| **Planner** | Planning | Creates phase plans and task breakdowns. Operates in read-only Plan Mode — it cannot write code. Reads GitHub Issues and produces sub-issue task breakdowns. |
| **Executor** | Implementation | Writes code. Each executor works in an isolated git worktree on its own branch. Commits atomically using conventional commit format. |
| **Researcher** | Investigation | Reads the codebase, searches the web, investigates dependencies. Used during init (parallel agents, count scaled by model profile and project size) and during planning (domain research). |
| **Verifier** | Quality Control | Reviews completed work. Runs tests, checks build, runs lint, reviews code for security and quality issues, and produces evidence blocks. |

### Parallel Execution with Worktrees

Every executor agent gets its own git worktree:

```
.maxsim-worktrees/
  phase-3-task-001/    ← Executor A working here
  phase-3-task-002/    ← Executor B working here
  phase-3-task-003/    ← Executor C working here
```

Each worktree is an independent branch. After an executor finishes and the Verifier approves its work, the worktree branch is merged back into main. Merges happen sequentially to minimize conflicts. Auto-resolution is attempted; the Verifier checks the merged result.

This means agents never step on each other. Work that fails verification is discarded without affecting anything else.

### Competitive Implementation

When `execution.competitionStrategy` is set to `"quick"`, `"standard"`, or `"deep"`, the same task is assigned to multiple executor agents simultaneously. Each works independently without knowing about the others. The Verifier scores all implementations across criteria including correctness, test coverage, security, code quality, and spec compliance — and selects the best one.

This is the same principle used in ensemble ML methods: multiple independent attempts at a problem produce better results than a single attempt.

### Agent Waves

Executor agents spawn in dependency-ordered waves. Tasks with no dependencies run in parallel in Wave 1. Tasks that depend on Wave 1 results run in Wave 2, and so on. MaxsimCLI uses Kahn's algorithm to build the wave schedule from the task dependency graph in the GitHub sub-issues.

---

## Skills

MaxsimCLI ships with 14 built-in skills. Skills are instruction modules that Claude Code loads on-demand based on semantic matching — Claude reads the skill's description and loads it when the task matches.

### How Skills Are Loaded

You do not need to invoke skills manually. Claude Code:

1. Reads each skill's frontmatter description
2. When a task matches a skill's trigger conditions, loads the skill automatically
3. Agent prompts also reference skills explicitly (e.g., the Verifier agent prompt says "use the verification skill")

Skills can also be requested explicitly during init: "use the UX-Pro skill for all design decisions."

### Skill List

| # | Skill | Purpose |
|---|-------|---------|
| 1 | `tdd` | Test-Driven Development. Red-green-refactor cycle. Used by executor agents when writing new features. |
| 2 | `systematic-debugging` | Structured debugging: reproduce, hypothesize, isolate, verify, fix, confirm. Used by `/maxsim:debug`. |
| 3 | `brainstorming` | Multi-approach design exploration before committing to an implementation. |
| 4 | `roadmap-writing` | Phase planning with dependencies and success criteria. Used during `/maxsim:plan`. |
| 5 | `handoff-contract` | Standard output format for all agent results. Ensures consistent handoffs between agents. |
| 6 | `commit-conventions` | Conventional commit format, atomic changes, co-author attribution. Used by all executor agents. |
| 7 | `maxsim-batch` | Parallel execution orchestration. Defines the batch pattern for spawning multiple agents in one message. |
| 8 | `code-review` | Security, quality, and spec-compliance review. Used by Verifier agents. |
| 9 | `verification` | Gate framework, evidence blocks, anti-rationalization enforcement. The verification protocol all Verifiers follow. |
| 10 | `github-operations` | GitHub artifact types, comment conventions, CLI commands, issue lifecycle state machine. |
| 11 | `research` | Systematic investigation with source hierarchy and tool priority. Used by Researcher agents. |
| 12 | `project-memory` | GitHub-native persistence for project learnings, decisions, and patterns across sessions. |
| 13 | `using-maxsim` | Command reference and routing table. Loaded when Claude needs to invoke MaxsimCLI commands. |
| 14 | `maxsim-simplify` | Code simplification, dead code removal, reuse improvement. |

---

## Self-Improvement

MaxsimCLI learns from every session. It is not a static tool — it improves per project over time.

### The Feedback Loop

```
Session Start
  → Read git log (last 20 commits) for patterns
  → Read project memory (MEMORY.md)
  → Apply learned adjustments to configuration and behavior

Session Work
  → Execute tasks
  → Measure results (tests pass, build succeeds, spec compliance)
  → Log outcomes

Session End (automatic Stop hook)
  → Capture learnings
  → Update agent memory
  → Record what worked and what failed
```

The Stop hook runs automatically when Claude Code ends a session. You do not need to do anything.

### Git as Memory

MaxsimCLI reads `git log --oneline -20` at the start of every session. The commit history tells the story of what was tried, what succeeded, and what was rolled back. This gives Claude Code context without any explicit state file.

### Agent Memory

Each project maintains persistent agent memory at:

```
.claude/agent-memory/maxsim-learner/MEMORY.md
```

This file stores:
- Patterns that worked well (e.g., "this project uses vitest, not jest")
- Patterns that caused failures (e.g., "circular imports between module A and B")
- Configuration adjustments (e.g., "executor concurrency reduced because of file lock conflicts")
- Project-specific conventions discovered during execution

This memory is loaded at the start of each session and applied to all subsequent agent behavior.

### Metric Tracking

Session outcomes are also written to `autoresearch-results.tsv` in the project root (gitignored). This tab-separated file records per-session metrics — task success rates, retry counts, verification outcomes — so improvements can be measured over time.

### What Improves Over Time

| Target | How It Improves |
|--------|----------------|
| Skills | Instruction adjustments based on success/failure patterns |
| Configuration | Model profile, parallelism settings, verification thresholds |
| Workflows | Process steps refined based on what caused failures |
| Agent behavior | Prompts refined based on output quality |

### Isolation

All improvements are project-local. Two projects using MaxsimCLI never interfere with each other. Each project has its own `.claude/agent-memory/`, its own `MEMORY.md`, and its own Claude Code session memory.

---

## Troubleshooting

### How to Check Installation

```
/maxsim:health
```

This checks that all required components are present and working:
- GitHub CLI authenticated
- GitHub repo accessible
- Project board exists
- Config file valid
- Hooks registered correctly

### How to Uninstall

```bash
npx maxsimcli --uninstall
```

This removes MaxsimCLI-managed files from `.claude/` (custom skills and agents you created are preserved), deregisters all hooks from Claude Code settings, and removes the project-root `CLAUDE.md`. Your code and GitHub Issues are not affected.

### Common Issues

**"gh: command not found"**

GitHub CLI is not installed. Install it from [cli.github.com](https://cli.github.com), then run `gh auth login`.

**"Not authenticated with GitHub"**

Run `gh auth login` and follow the prompts. MaxsimCLI requires GitHub CLI to be authenticated before it will start.

**"/maxsim:go reports no project board found"**

The GitHub Project board was not created yet. Run `/maxsim:init` to set up the project board, labels, and milestones.

**"Verification failed after 3 retries"**

MaxsimCLI created a diagnostic GitHub Issue with the full error context. Check your GitHub Issues for an issue labeled `verification-failed`. It contains the exact test output, build errors, and lint results so you can understand what went wrong. You can fix the issue manually and then run `/maxsim:go` to continue.

**"Executor agents are slow or timing out"**

Reduce parallelism in `/maxsim:settings`: lower `execution.parallelism.maxAgentsPerWave` to 2-3. Also consider switching to the `budget` model profile to use faster models.

**"Plans do not match what I wanted"**

Plans are created from the GitHub Issue description. Before running `/maxsim:plan`, edit the phase issue directly on GitHub to add more detail about your requirements, constraints, and preferred approach. MaxsimCLI reads the issue content during planning.

**"I accidentally closed a GitHub Issue"**

Reopen it on GitHub. MaxsimCLI reads issue state from GitHub; reopening the issue is sufficient.

**"The project board column is wrong"**

Move the issue card to the correct column on the GitHub Project Board. MaxsimCLI treats the board column as authoritative state. There is no sync conflict — GitHub is always right.

**"Commits are not being pushed"**

Check `automation.autoCommitOnSuccess` in `.claude/maxsim/config.json`. If commits are succeeding but pushes are not happening, verify the GitHub remote is configured correctly and run `gh auth status` to confirm authentication.

**"I need to start over"**

1. Archive or delete the GitHub Project Board from GitHub Settings
2. Close or delete the phase issues
3. Run `/maxsim:init` to set up a fresh project structure

Your code is not touched. Only the planning structure on GitHub is reset.

**"MaxsimCLI is installed but `/maxsim:` commands are not appearing"**

The `.claude/commands/maxsim/` directory must exist. Run `ls .claude/commands/maxsim/` to check. If the directory is missing, reinstall with `npx maxsimcli@latest`.

**"I want to use a different model for a specific agent"**

Use `/maxsim:settings` to configure individual agent overrides. Model profiles set defaults; per-agent overrides take precedence.

### Getting Help

- Run `/maxsim:help` for a command reference within Claude Code
- Run `/maxsim:progress` to see the current project state
- Check your GitHub Issues — MaxsimCLI creates diagnostic issues when things go wrong
- Visit [maxsimcli.com](https://maxsimcli.com) for full documentation
- Report bugs at [github.com/maystudios/maxsimcli](https://github.com/maystudios/maxsimcli)

---

*MaxsimCLI v6 — GitHub is the source of truth. `/maxsim:go` is the interface.*
