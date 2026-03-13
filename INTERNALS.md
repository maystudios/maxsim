# MAXSIM Internals

Internal technical reference for the MAXSIM codebase. This document maps out how the three-layer prompt system chains together, what the CLI tools router does, how data flows, and how the system is delivered to end users.

---

## Table of Contents

1. [System Architecture Overview](#system-architecture-overview)
2. [Three-Layer Prompt System](#three-layer-prompt-system)
3. [Command → Workflow → Agent Chains](#command--workflow--agent-chains)
4. [CLI Tools Router](#cli-tools-router)
5. [Core Modules](#core-modules)
6. [GitHub Integration](#github-integration)
7. [Data Flow: From User Command to File Changes](#data-flow-from-user-command-to-file-changes)
8. [`.planning/` Directory Structure](#planning-directory-structure)
9. [Skills System](#skills-system)
10. [Hooks System](#hooks-system)
11. [Model Profiles and Agent Configuration](#model-profiles-and-agent-configuration)
12. [Build and Delivery Pipeline](#build-and-delivery-pipeline)
13. [Install Process](#install-process)

---

## System Architecture Overview

MAXSIM is a **prompt engineering system** — its runtime is the AI itself. The codebase delivers markdown prompts (commands, workflows, agents, skills, references) plus a compiled Node.js CLI binary (`maxsim-tools.cjs`) that serves as a tools router. The AI reads the markdown, follows the instructions, and calls the CLI binary for structured operations (state management, file parsing, GitHub integration, etc.).

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER TYPES                               │
│                    /maxsim:execute 3                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│  LAYER 1: COMMANDS (templates/commands/maxsim/*.md)               │
│  9 user-facing slash commands. Each loads a workflow via @path.   │
└───────────────────────┬───────────────────────────────────────────┘
                        │ @./workflows/execute.md
                        ▼
┌───────────────────────────────────────────────────────────────────┐
│  LAYER 2: WORKFLOWS (templates/workflows/*.md)                    │
│  23 orchestrator scripts. Define the state machine, gate logic,   │
│  and agent spawn sequences. Call CLI tools via Bash.              │
└──────────┬──────────────────────────────┬────────────────────────┘
           │ Task(subagent_type="executor") │ node maxsim-tools.cjs
           ▼                               ▼
┌─────────────────────┐    ┌───────────────────────────────────────┐
│  LAYER 3: AGENTS    │    │  CLI TOOLS ROUTER (dist/cli.cjs)      │
│  4 generic agents   │    │  150+ commands for state, phases,     │
│  spawned as Claude   │    │  roadmap, verification, GitHub, etc.  │
│  Code subagents     │    │  Called via: node maxsim-tools.cjs     │
└─────────────────────┘    └───────────────────────────────────────┘
```

Key architectural properties:
- **Agents cannot spawn other agents** — the orchestrator (workflow) mediates all agent-to-agent communication
- **Large outputs** (>50KB JSON) are written to a tmpfile and returned as `@file:/path` to prevent Bash buffer overflow
- **GitHub Issues is the single source of truth** for plans, research, verification results, and task tracking

---

## Three-Layer Prompt System

### Layer 1: Commands (`templates/commands/maxsim/`)

Commands are the user-facing interface. Each is a markdown file with YAML frontmatter defining the command name, allowed tools, and argument schema. The body contains an `<objective>`, `<execution_context>` (with `@path` references to workflows/references), and a `<process>` section.

| Command | Purpose | Workflow |
|---------|---------|----------|
| `execute` | Execute all plans in a phase with auto-verification and retry | `execute.md` |
| `plan` | State-machine: Discussion → Research → Planning stages | `plan.md` |
| `go` | Auto-detect project state and dispatch to the right command | `go.md` |
| `init` | Initialize new project, existing project, or manage milestones | `init.md` |
| `quick` | Execute ad-hoc tasks or capture todos | `quick.md` |
| `debug` | Systematic debugging with persistent state | (inline process) |
| `progress` | Check project/milestone status and route to next action | `progress.md` |
| `help` | Display command reference | `help.md` |
| `settings` | Configure model profile, workflow toggles, pipeline settings | `settings.md` |

When a user types `/maxsim:execute 3`, Claude Code:
1. Reads `execute.md` from `.claude/commands/maxsim/`
2. Resolves `@./workflows/execute.md` — loads the workflow content into context
3. Follows the workflow instructions as an orchestrator

### Layer 2: Workflows (`templates/workflows/`)

Workflows are orchestrator scripts. They define multi-step processes with state detection, gate confirmations, agent spawning, and CLI tool calls. Workflows are NOT directly user-invocable — they are always loaded by a command.

| Workflow | Loaded By | Purpose |
|----------|-----------|---------|
| `execute.md` | `/maxsim:execute` | Phase execution state machine |
| `execute-plan.md` | `execute.md` | Per-plan execution (spawns executor agent) |
| `plan.md` | `/maxsim:plan` | Planning state machine orchestrator |
| `plan-discuss.md` | `plan.md` | Discussion stage sub-workflow |
| `plan-research.md` | `plan.md` | Research stage (spawns researcher agent) |
| `plan-create.md` | `plan.md` | Plan creation (spawns planner agent) |
| `go.md` | `/maxsim:go` | Auto-detection and dispatch |
| `init.md` | `/maxsim:init` | Project initialization routing |
| `new-project.md` | `init.md` | New project setup flow |
| `init-existing.md` | `init.md` | Existing codebase onboarding |
| `new-milestone.md` | `init.md` | Milestone lifecycle management |
| `quick.md` | `/maxsim:quick` | Quick task execution |
| `progress.md` | `/maxsim:progress` | Progress checking and routing |
| `settings.md` | `/maxsim:settings` | Interactive configuration |
| `help.md` | `/maxsim:help` | Help reference content |
| `verify-phase.md` | `execute.md` | Phase verification (spawns verifier) |
| `verify-work.md` | (various) | Ad-hoc verification |
| `batch.md` | (internal) | Batch operations |
| `health.md` | (internal) | Health checks |
| `sdd.md` | (internal) | Spec-driven development |
| `research-phase.md` | `plan.md` | Phase research orchestration |
| `discuss-phase.md` | `plan.md` | Phase discussion orchestration |
| `diagnose-issues.md` | (internal) | Issue diagnosis |

Workflows call the CLI tools router via Bash:
```bash
INIT=$(node .claude/maxsim/bin/maxsim-tools.cjs init execute-phase "$PHASE")
```

### Layer 3: Agents (`templates/agents/`)

4 generic agents replace what was previously 14 specialized agents. Specialization comes from the orchestrator's spawn prompt, not the agent definition. Each agent has a base set of tools and skills, plus available skills that can be loaded on-demand.

| Agent | Role | Base Tools | Preloaded Skills |
|-------|------|------------|-----------------|
| `executor` | Implements plans with atomic commits | Read, Write, Edit, Bash, Grep, Glob | handoff-contract, evidence-collection, commit-conventions |
| `planner` | Creates plans posted as GitHub Issue comments | Read, Write, Bash, Grep, Glob | handoff-contract, input-validation |
| `researcher` | Investigates technical domains | Read, Bash, Grep, Glob, WebFetch | handoff-contract, evidence-collection |
| `verifier` | Verifies work against specifications | Read, Bash, Grep, Glob | verification-gates, evidence-collection, handoff-contract |

**Model assignment per profile** (from `MODEL_PROFILES` in `core.ts` — source of truth):

| Agent | quality | balanced | budget | tokenburner |
|-------|---------|----------|--------|-------------|
| executor | opus | sonnet | sonnet | opus |
| planner | opus | opus | sonnet | opus |
| researcher | opus | sonnet | haiku | opus |
| verifier | sonnet | sonnet | haiku | opus |
| debugger | sonnet | sonnet | haiku | opus |

Note: The `AGENTS.md` template file may show slightly different values — the code in `core.ts` is authoritative.

**Consolidation map** (old → new):
- `executor` ← maxsim-executor
- `planner` ← maxsim-planner, maxsim-roadmapper, maxsim-plan-checker
- `researcher` ← maxsim-phase-researcher, maxsim-project-researcher, maxsim-research-synthesizer, maxsim-codebase-mapper
- `verifier` ← maxsim-verifier, maxsim-code-reviewer, maxsim-spec-reviewer, maxsim-debugger, maxsim-integration-checker, maxsim-drift-checker

Every agent return follows the **handoff contract** format:

| Section | Content |
|---------|---------|
| Key Decisions | Decisions made during execution |
| Artifacts | Files created/modified (absolute paths) |
| Status | `complete`, `blocked`, or `partial` |
| Deferred Items | Work discovered but not implemented |

---

## Command → Workflow → Agent Chains

### `/maxsim:init` — Project Initialization

```
init.md (command)
  └→ init.md (workflow) — routes based on project state
       ├→ new-project.md — spawns researcher agents for domain research
       │    └→ researcher (agent) — investigates tech stack, patterns, pitfalls
       ├→ init-existing.md — onboards existing codebase
       │    └→ researcher (agent) — maps codebase architecture
       └→ new-milestone.md — milestone lifecycle
```

### `/maxsim:plan [phase]` — Phase Planning

```
plan.md (command)
  └→ plan.md (workflow) — 3-stage state machine
       ├→ Stage 1: plan-discuss.md — user discussion, captures context
       │    └→ Posts context as GitHub Issue comment (type: context)
       ├→ Stage 2: plan-research.md — technical research
       │    └→ researcher (agent) — investigates implementation approaches
       │    └→ Posts research as GitHub Issue comment (type: research)
       └→ Stage 3: plan-create.md — plan creation
            └→ planner (agent) — creates PLAN.md with tasks, waves, dependencies
            └→ Posts plan as GitHub Issue comment (type: plan)
            └→ Creates task sub-issues via github batch-create-tasks
```

### `/maxsim:execute [phase]` — Phase Execution

```
execute.md (command)
  └→ execute.md (workflow) — execution state machine
       ├→ Detects phase state (done, partial, ready)
       ├→ Groups plans by wave (parallel within waves, sequential across)
       ├→ For each plan in a wave:
       │    └→ execute-plan.md (sub-workflow)
       │         └→ executor (agent) — implements plan tasks atomically
       │              ├→ Reads plan from GitHub Issue comment
       │              ├→ Implements each task with evidence blocks
       │              ├→ Commits per task (conventional format)
       │              └→ Returns handoff with requirement evidence
       ├→ After all plans complete:
       │    └→ verifier (agent) — verifies phase against success criteria
       │         └→ Posts verification as GitHub Issue comment
       └→ If verification fails: retry with gap closure (max 2 retries)
```

### `/maxsim:quick` — Quick Tasks

```
quick.md (command)
  └→ quick.md (workflow)
       ├→ planner (agent, quick mode) — creates lightweight plan
       ├→ executor (agent) — implements the plan
       ├→ [--full]: planner (plan-checker mode) — validates plan
       └→ [--full]: verifier (agent) — post-execution verification
```

### `/maxsim:debug` — Debugging

```
debug.md (command, inline process — no separate workflow)
  ├→ Gathers symptoms via AskUserQuestion
  ├→ verifier (agent, debug mode) — investigates using scientific method
  │    ├→ Creates .planning/debug/{slug}.md session file
  │    ├→ Returns: ROOT CAUSE FOUND, CHECKPOINT REACHED, or INCONCLUSIVE
  └→ Handles checkpoints: spawns continuation agents with prior state
```

### `/maxsim:go` — Auto-Dispatch

```
go.md (command)
  └→ go.md (workflow)
       ├→ Gathers deep context (project state, git, blockers)
       ├→ Detects what needs to happen next
       └→ Dispatches to /maxsim:plan, /maxsim:execute, /maxsim:init, etc.
```

---

## CLI Tools Router

The CLI tools router (`packages/cli/src/cli.ts`) is a Node.js binary bundled as `maxsim-tools.cjs`. It is the structured operations backend — agents and workflows call it via Bash for all state management, file parsing, GitHub operations, and verification.

**Invocation**: `node .claude/maxsim/bin/maxsim-tools.cjs <command> [subcommand] [args] [--raw] [--cwd <path>]`

The `--raw` flag returns raw values instead of JSON. The `--cwd` flag overrides the working directory (used by worktree-based agents running outside the project root).

### Command Categories

#### State Management (`state`)
| Subcommand | Description |
|------------|-------------|
| `state` (no sub) | Load full STATE.md as JSON |
| `state update` | Update a STATE.md section |
| `state get` | Get a specific section from STATE.md |
| `state patch` | Batch-update multiple STATE.md fields |
| `state advance-plan` | Mark current plan as complete, advance to next |
| `state record-metric` | Record execution metrics (phase, plan, duration, tasks, files) |
| `state update-progress` | Refresh progress calculations |
| `state add-decision` | Add a decision entry with rationale |
| `state add-blocker` | Add a blocker entry |
| `state resolve-blocker` | Resolve an existing blocker |
| `state record-session` | Record session state for resume |

#### Phase Management (`phase`)
| Subcommand | Description |
|------------|-------------|
| `phase next-decimal` | Calculate next decimal phase number (e.g., 3 → 3.1) |
| `phase add` | Append a new phase to ROADMAP.md |
| `phase insert` | Insert a phase at a specific position |
| `phase remove` | Remove a phase (with `--force` option) |
| `phase complete` | Mark a phase as complete |
| `phase archive-preview` | Preview what archiving would do |
| `phase archive-execute` | Archive a completed phase |

#### Phases Listing (`phases`)
| Subcommand | Description |
|------------|-------------|
| `phases list` | List phases with optional filters (type, phase, offset, limit, include-archived) |

#### Roadmap (`roadmap`)
| Subcommand | Description |
|------------|-------------|
| `roadmap get-phase` | Get phase details from ROADMAP.md |
| `roadmap analyze` | Analyze roadmap structure and progress |
| `roadmap update-plan-progress` | Update plan progress in ROADMAP.md |

#### Verification (`verify`)
| Subcommand | Description |
|------------|-------------|
| `verify plan-structure` | Validate PLAN.md structure (frontmatter, tasks, waves) |
| `verify phase-completeness` | Check if all plans in a phase are complete |
| `verify references` | Verify file references exist |
| `verify commits` | Verify expected commits exist |
| `verify artifacts` | Verify must_haves artifacts exist with min_lines |
| `verify key-links` | Verify cross-file key_links patterns |
| `verify requirement-existence` | Validate requirement IDs exist in REQUIREMENTS.md |
| `verify requirement-status` | Check requirement completion status |
| `verify evidence-completeness` | Verify evidence blocks cover all criteria |

#### Validation (`validate`)
| Subcommand | Description |
|------------|-------------|
| `validate consistency` | Cross-check STATE.md, ROADMAP.md, and phase files |
| `validate health` | Health check with optional `--repair` |

#### Frontmatter (`frontmatter`)
| Subcommand | Description |
|------------|-------------|
| `frontmatter get` | Read YAML frontmatter from a file |
| `frontmatter set` | Set a frontmatter field |
| `frontmatter merge` | Merge JSON data into frontmatter |
| `frontmatter validate` | Validate frontmatter against a schema |

#### Template (`template`)
| Subcommand | Description |
|------------|-------------|
| `template select` | Select a template by type |
| `template fill` | Fill a template with provided values |

#### Init (Context Assembly) (`init`)
| Subcommand | Description |
|------------|-------------|
| `init execute-phase` | Assemble context for phase execution |
| `init plan-phase` | Assemble context for phase planning |
| `init new-project` | Assemble context for new project init |
| `init new-milestone` | Assemble context for new milestone |
| `init quick` | Assemble context for quick task |
| `init resume` | Assemble context for work resumption |
| `init verify-work` | Assemble context for verification |
| `init phase-op` | Assemble context for phase operations |
| `init todos` | Assemble context for todo management |
| `init milestone-op` | Assemble context for milestone operations |
| `init map-codebase` | Assemble context for codebase mapping |
| `init init-existing` | Assemble context for existing project onboarding |
| `init progress` | Assemble context for progress view |
| `init executor` | Assemble agent-level context for executor |
| `init planner` | Assemble agent-level context for planner |
| `init researcher` | Assemble agent-level context for researcher |
| `init verifier` | Assemble agent-level context for verifier |
| `init debugger` | Assemble agent-level context for debugger |
| `init check-drift` | Assemble context for drift checking |
| `init realign` | Assemble context for realignment |

#### GitHub (`github`)
| Subcommand | Description |
|------------|-------------|
| `github setup` | Initialize GitHub integration (project board, milestone) |
| `github create-phase` | Create a phase tracking issue |
| `github create-task` | Create a task sub-issue |
| `github batch-create-tasks` | Create multiple task sub-issues at once |
| `github post-plan-comment` | Post a plan as a comment on the phase issue |
| `github post-comment` | Post a typed comment (context, research, verification, summary) |
| `github post-completion` | Post task completion with commit SHA |
| `github get-issue` | Get issue details with optional comments |
| `github list-sub-issues` | List sub-issues of a phase issue |
| `github close-issue` | Close an issue with reason |
| `github reopen-issue` | Reopen a closed issue |
| `github bounce-issue` | Bounce an issue back with reason |
| `github move-issue` | Move issue on project board (To Do → In Progress → Done) |
| `github detect-external-edits` | Detect changes made outside MAXSIM |
| `github query-board` | Query project board state |
| `github add-to-board` | Add issue to project board |
| `github search-issues` | Search issues by labels, state, query |
| `github sync-check` | Check if local state is in sync with GitHub |
| `github phase-progress` | Get progress for a specific phase |
| `github all-progress` | Get overall milestone progress |
| `github detect-interrupted` | Detect interrupted tasks |
| `github add-todo` | Create a todo issue |
| `github complete-todo` | Complete a todo issue |
| `github list-todos` | List todos by area/status |
| `github status` | Overall GitHub integration status |
| `github sync` | Sync local state with GitHub |
| `github overview` | Project overview from GitHub |

#### Drift (`drift`)
| Subcommand | Description |
|------------|-------------|
| `drift read-report` | Read the drift report |
| `drift extract-requirements` | Extract requirements for drift comparison |
| `drift extract-nogos` | Extract no-go constraints |
| `drift extract-conventions` | Extract coding conventions |
| `drift write-report` | Write a drift analysis report |
| `drift previous-hash` | Get previous drift hash for change detection |

#### Worktree (`worktree`)
| Subcommand | Description |
|------------|-------------|
| `worktree create` | Create a git worktree for parallel execution |
| `worktree list` | List active worktrees |
| `worktree cleanup` | Clean up worktree(s) after execution |

#### Milestone (`milestone`)
| Subcommand | Description |
|------------|-------------|
| `milestone complete` | Complete and optionally archive a milestone |

#### Standalone Commands
| Command | Description |
|---------|-------------|
| `resolve-model` | Resolve model for an agent type based on config profile |
| `find-phase` | Find a phase directory by number |
| `commit` | Create a conventional commit with staged files |
| `verify-summary` | Verify a summary file's completeness |
| `generate-slug` | Generate a URL-safe slug from text |
| `current-timestamp` | Get current timestamp in specified format |
| `list-todos` | List pending todos |
| `verify-path-exists` | Check if a path exists |
| `config-ensure-section` | Ensure config.json has required sections |
| `config-set` / `config-get` | Read/write config.json values |
| `history-digest` | Generate a git history digest |
| `progress` | Render progress in JSON or text format |
| `todo complete` | Complete a todo item |
| `scaffold` | Scaffold a new phase or plan structure |
| `detect-stale-context` | Detect if loaded context is outdated |
| `get-archived-phase` | Read an archived phase |
| `phase-plan-index` | Get plan index for a phase |
| `state-snapshot` | Full state snapshot for debugging |
| `summary-extract` | Extract fields from a summary file |
| `websearch` | Web search with configurable limit/freshness |
| `artefakte-read/write/append/list` | Artefakte (persistent knowledge base) CRUD |
| `context-load` | Load context for a phase/topic |
| `skill-list/install/update` | Skill management |
| `decide-execution-mode` | Decide between standard and worktree execution |
| `validate-plan-independence` | Check if plans can run in parallel |
| `requirements mark-complete` | Mark requirements as complete |

---

## Core Modules

All business logic lives in `packages/cli/src/core/`. Each module exports functions consumed by the CLI router.

| Module | Responsibility |
|--------|---------------|
| `core.ts` | Constants, model profiles, git helpers, phase sorting/comparison, path utilities, output helpers (CliOutput/CliError), tmpfile overflow mechanism |
| `types.ts` | All type definitions: branded types (PhaseNumber, PhasePath), CmdResult, config interfaces, agent types, model profiles |
| `state.ts` | STATE.md CRUD operations: load, get, patch, update sections, add decisions/blockers, record metrics/sessions, snapshot |
| `phase.ts` | Phase lifecycle: add, insert, remove, complete, archive preview/execute, find, list, plan indexing |
| `roadmap.ts` | ROADMAP.md parsing: get phase info, analyze structure, update plan progress |
| `verify.ts` | Verification: plan structure, phase completeness, references, commits, artifacts, key-links, requirement/evidence validation |
| `config.ts` | `.planning/config.json` loading with defaults, ensure-section, get/set |
| `init.ts` | Context assembly for each workflow type. This is the largest module — it builds JSON context packets for every workflow and agent type |
| `template.ts` | Template scaffolding: select template by type, fill with variables |
| `milestone.ts` | Milestone completion and archiving |
| `commands.ts` | Utility commands: slug generation, timestamps, todo management, commit helper, history digest, progress rendering, summary extraction, web search |
| `frontmatter.ts` | YAML frontmatter parsing: get, set, merge, validate against schema |
| `drift.ts` | Drift detection: read/write reports, extract requirements/no-gos/conventions, hash comparison |
| `worktree.ts` | Git worktree management: create, list, cleanup, execution mode decision, plan independence validation |
| `context-loader.ts` | Load context for phases/topics with optional history |
| `artefakte.ts` | Artefakte (persistent knowledge base) CRUD: read, write, append, list |
| `skills.ts` | Skill management: list installed skills, install from registry, update |
| `index.ts` | Barrel export — re-exports everything from all modules |

---

## GitHub Integration

GitHub Issues serves as the **single source of truth** for plans, research, context, verification results, and task tracking. The integration lives in `packages/cli/src/github/`.

### Architecture

| Module | Responsibility |
|--------|---------------|
| `client.ts` | Octokit singleton with throttling + retry plugins. Auth via `gh auth token`. Hard gate: requires `gh` CLI installed, authenticated, with `project` scope |
| `types.ts` | Type definitions: GhResult, AuthError, IssueStatus (To Do / In Progress / In Review / Done), TaskIssueMapping, PhaseMapping, IssueMappingFile |
| `mapping.ts` | `.planning/github-issues.json` CRUD — maps phase numbers to GitHub issue numbers, task IDs to issue numbers, project board item IDs |
| `issues.ts` | Issue CRUD: create, close, reopen, bounce, search, get details with comments |
| `projects.ts` | GitHub Projects v2 integration: query board, add to board, move items between columns |
| `milestones.ts` | Milestone management: create, list, progress tracking |
| `labels.ts` | Label management: ensure required labels exist (phase, plan, task, quick, todo, etc.) |
| `sync.ts` | Bidirectional sync: detect external edits, reconcile local/remote state |
| `templates.ts` | Issue body templates: phase tracking issues, task issues, comment formatting |
| `commands.ts` | CLI command implementations: all `cmdGitHub*` functions wired into the router |
| `index.ts` | Barrel export |

### Data Flow

```
Workflow calls CLI          CLI calls Octokit           GitHub API
────────────────           ──────────────────          ──────────
github create-phase   →    issues.create()         →   POST /repos/:owner/:repo/issues
github post-comment   →    issues.createComment()  →   POST /issues/:number/comments
github move-issue     →    projects.moveItem()     →   GraphQL mutation
github query-board    →    projects.queryBoard()   →   GraphQL query
```

### Issue Comment Types

Workflows post typed comments to phase issues using HTML marker comments for detection:

| Type | Marker | Content |
|------|--------|---------|
| `context` | `<!-- maxsim:type=context -->` | User decisions from discussion stage |
| `research` | `<!-- maxsim:type=research -->` | Technical research findings |
| `plan` | `<!-- maxsim:type=plan -->` | Execution plan with tasks and waves |
| `summary` | `<!-- maxsim:type=summary -->` | Execution summary with requirement evidence |
| `verification` | `<!-- maxsim:type=verification -->` | Verification results (PASS/FAIL) |

### Project Board Columns

Issues move through: **To Do** → **In Progress** → **In Review** → **Done**

---

## Data Flow: From User Command to File Changes

### Example: `/maxsim:execute 3`

```
1. USER types /maxsim:execute 3
   │
2. CLAUDE reads .claude/commands/maxsim/execute.md
   │  ↓ resolves @./workflows/execute.md
   │
3. WORKFLOW (execute.md) starts:
   │
   ├─ 3a. Calls: node maxsim-tools.cjs init execute-phase 3
   │       → Returns JSON: phase state, plans, models, GitHub issue numbers
   │
   ├─ 3b. Calls: node maxsim-tools.cjs github get-issue $PHASE_ISSUE --comments
   │       → Returns: phase issue with plan comments
   │
   ├─ 3c. Detects state: plans found, not yet executed
   │
   ├─ 3d. Groups plans by wave number
   │
   ├─ 3e. For each wave (sequential):
   │       For each plan in wave (parallel via worktrees or sequential):
   │       │
   │       ├─ Spawns executor agent via Task():
   │       │   Task(
   │       │     prompt = "Execute plan 1 for phase 3...",
   │       │     subagent_type = "executor",
   │       │     model = resolved_model (opus/sonnet/haiku)
   │       │   )
   │       │
   │       │   EXECUTOR AGENT:
   │       │   ├─ Reads plan content from spawn prompt
   │       │   ├─ For each task:
   │       │   │   ├─ Implements changes (Read, Write, Edit)
   │       │   │   ├─ Runs verify block (Bash)
   │       │   │   ├─ Produces evidence blocks
   │       │   │   └─ Creates git commit
   │       │   └─ Returns handoff-contract result
   │       │
   │       └─ Orchestrator posts summary via:
   │          node maxsim-tools.cjs github post-comment --type summary
   │
   ├─ 3f. Auto-verification:
   │       Spawns verifier agent via Task()
   │       │
   │       VERIFIER AGENT:
   │       ├─ Reads phase success criteria
   │       ├─ Gathers fresh evidence for each criterion
   │       ├─ Returns PASS or FAIL with evidence blocks
   │       │
   │       └─ Orchestrator posts verification via:
   │          node maxsim-tools.cjs github post-comment --type verification
   │
   └─ 3g. If FAIL: retry with gap closure (max 2 retries)
          If PASS: mark phase complete
```

### Context Assembly Pattern

Every workflow starts with an `init` call that returns a JSON context packet. The `init.ts` module reads `.planning/` files, resolves models, loads GitHub mappings, and returns everything the workflow needs in one call.

```bash
# Workflow calls:
INIT=$(node .claude/maxsim/bin/maxsim-tools.cjs init execute-phase "3")

# Returns JSON like:
{
  "phase_found": true,
  "phase_dir": ".planning/phases/03-Foundation",
  "phase_number": "03",
  "phase_name": "Foundation",
  "plans": ["01-PLAN.md"],
  "executor_model": "sonnet",
  "verifier_model": "sonnet",
  "phase_issue_number": 42,
  "task_mappings": { "T1": { "number": 43, "status": "To Do" } },
  "commit_docs": "conventional",
  ...
}
```

---

## `.planning/` Directory Structure

MAXSIM creates a `.planning/` directory in user projects to store all project state:

```
.planning/
├── config.json               # Model profile, workflow flags, branching strategy
├── PROJECT.md                # Project vision and context (always loaded)
├── REQUIREMENTS.md           # Scoped requirements (v1/v2/out-of-scope)
├── ROADMAP.md                # Phase structure with goals and success criteria
├── STATE.md                  # Project memory: decisions, blockers, metrics, session state
├── DECISIONS.md              # Key decisions with rationale
├── ACCEPTANCE-CRITERIA.md    # Measurable success criteria
├── NO-GOS.md                 # Explicit exclusions and anti-patterns
├── github-issues.json        # GitHub Issues mapping (phase→issue, task→issue)
│
├── phases/
│   └── 01-Foundation/
│       ├── 01-CONTEXT.md       # User decisions from discussion stage
│       ├── 01-RESEARCH.md      # Phase research findings
│       ├── 01-01-PLAN.md       # Task plan (numbered per attempt)
│       ├── 01-01-SUMMARY.md    # Execution summary with evidence
│       ├── 01-VERIFICATION.md  # Verification results
│       └── 01-UAT.md           # User acceptance tests
│
├── codebase/                   # Codebase analysis (existing projects only)
├── research/                   # Domain research outputs
├── debug/                      # Debug session files
│
├── todos/
│   ├── pending/                # Pending todo items
│   └── completed/              # Completed todo items
│
└── artefakte/                  # Persistent knowledge base entries
```

### Phase Numbering

Phases support decimal and letter suffixes: `01`, `01A`, `01B`, `01.1`, `01.2`. Sort order: `01 < 01A < 01B < 01.1`.

The `normalizePhaseName()` function pads numbers to 2 digits: `3` → `03`, `3A` → `03A`.
The `comparePhaseNum()` function handles the full sort order including letter and decimal comparisons.

### config.json

```json
{
  "model_profile": "balanced",
  "research": true,
  "plan_checker": true,
  "verifier": true,
  "auto_advance": false,
  "branching": "none",
  "worktree_mode": "auto"
}
```

---

## Skills System

Skills are reusable prompt modules that agents can load. They live in `templates/skills/` as directories containing a `SKILL.md` file. Skills are **not user-invocable** — they are auto-loaded by agents based on frontmatter or on-demand by description matching.

### Built-in Skills (21)

| Category | Skill | Purpose |
|----------|-------|---------|
| **Protocol** | `handoff-contract` | Structural format for agent return values |
| **Protocol** | `verification-gates` | Anti-rationalization rules for verifiers |
| **Protocol** | `input-validation` | Input validation patterns for agents |
| **Methodology** | `evidence-collection` | How to collect and format evidence blocks |
| **Methodology** | `research-methodology` | Research source evaluation and confidence levels |
| **Methodology** | `systematic-debugging` | Scientific method for debugging |
| **Methodology** | `verification-before-completion` | Pre-completion verification patterns |
| **Convention** | `commit-conventions` | Conventional commit format rules |
| **Reference** | `agent-system-map` | System architecture reference |
| **Reference** | `tool-priority-guide` | Which tools to use when |
| **Reference** | `github-artifact-protocol` | How to read/write GitHub Issue artifacts |
| **Reference** | `github-tools-guide` | GitHub CLI tools reference |
| **Task** | `brainstorming` | Structured brainstorming techniques |
| **Task** | `code-review` | Code review methodology |
| **Task** | `memory-management` | Auto-memory management patterns |
| **Task** | `roadmap-writing` | How to write good roadmaps |
| **Task** | `sdd` | Spec-driven development methodology |
| **Task** | `tdd` | Test-driven development methodology |
| **Task** | `using-maxsim` | MAXSIM usage guide |
| **Task** | `maxsim-batch` | Batch operations |
| **Task** | `maxsim-simplify` | Simplification patterns |

### References (`templates/references/`)

14 reference documents provide inline context for specific topics. Commands and workflows load them via `@./references/filename.md`:

`checkpoints.md`, `continuation-format.md`, `decimal-phase-calculation.md`, `git-integration.md`, `git-planning-commit.md`, `model-profile-resolution.md`, `model-profiles.md`, `phase-argument-parsing.md`, `planning-config.md`, `questioning.md`, `tdd.md`, `thinking-partner.md`, `ui-brand.md`, `verification-patterns.md`

---

## Hooks System

Hooks are compiled Node.js scripts that run in response to Claude Code lifecycle events. Source lives in `packages/cli/src/hooks/`, compiled to `dist/assets/hooks/`, and installed to `.claude/hooks/`.

### Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| `maxsim-statusline.cjs` | `Notification` | Displays: `[update] model │ P{N} {BoardColumn} │ {milestone}: {pct}% │ dirname`. Spawns a background process to refresh progress cache from GitHub every 60s |
| `maxsim-check-update.cjs` | `SessionStart` | Checks npm registry for new MAXSIM version, writes result to cache file. Statusline shows ⬆ indicator when update is available |
| `maxsim-sync-reminder.cjs` | `PostToolUse` (Write) | Detects `.planning/` file writes and reminds user to sync to GitHub Issues. Debounces: fires on first write, then every 10 writes |
| `maxsim-notification-sound.cjs` | `PostToolUse` (AskUserQuestion) | Plays a notification sound when Claude asks the user a question |
| `maxsim-stop-sound.cjs` | `Stop` | Plays a sound when Claude finishes working |

### Hook Architecture

All hooks:
1. Read JSON from stdin via `readStdinJson()` (shared utility in `shared.ts`)
2. Process the input
3. Write result to stdout (for hooks that return data) or perform side effects (sounds, cache writes)
4. Never throw or block — all failures are silent

The `shared.ts` module provides `readStdinJson()`, `playSound()`, and the `CLAUDE_DIR` constant (`.claude`).

---

## Model Profiles and Agent Configuration

### Profile Table

The `MODEL_PROFILES` constant in `core.ts` maps agent types to model tiers:

| Agent | quality | balanced | budget | tokenburner |
|-------|---------|----------|--------|-------------|
| executor | opus | sonnet | sonnet | opus |
| planner | opus | opus | sonnet | opus |
| researcher | opus | sonnet | haiku | opus |
| verifier | sonnet | sonnet | haiku | opus |
| debugger | sonnet | sonnet | haiku | opus |

The user sets `model_profile` in `.planning/config.json` (default: `balanced`). Workflows resolve the model for each agent via:

```bash
MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model executor --raw)
```

This returns a model tier string (`opus`, `sonnet`, or `haiku`) which the orchestrator passes to `Task(model=...)`.

### Agent Frontmatter

Agent markdown files use `model: inherit` in their frontmatter, meaning they inherit the session's model by default. The orchestrator overrides this with the resolved model at spawn time.

---

## Build and Delivery Pipeline

### Monorepo Structure

```
maxsimcli-workspace/           # npm workspaces root
├── packages/
│   ├── cli/                   # Published as 'maxsimcli' to npm
│   │   ├── src/
│   │   │   ├── cli.ts         # Tools router → dist/cli.cjs
│   │   │   ├── install/       # Installer → dist/install.cjs
│   │   │   ├── core/          # Business logic modules
│   │   │   ├── github/        # GitHub integration
│   │   │   └── hooks/         # Hook sources → dist/assets/hooks/*.cjs
│   │   ├── scripts/
│   │   │   └── copy-assets.cjs
│   │   ├── dist/              # Build output
│   │   │   ├── install.cjs    # npm bin entry point
│   │   │   ├── cli.cjs        # Tools router binary
│   │   │   └── assets/
│   │   │       ├── templates/ # Copied from root templates/
│   │   │       ├── hooks/     # Compiled hook bundles
│   │   │       └── CHANGELOG.md
│   │   └── package.json       # name: "maxsimcli"
│   └── website/               # Marketing site (not published)
├── templates/                 # Source markdown assets
│   ├── commands/maxsim/       # 9 commands
│   ├── workflows/             # 23 workflows
│   ├── agents/                # 4 agents + AGENTS.md
│   ├── skills/                # 21 skills
│   └── references/            # 14 reference docs
└── package.json               # Workspace root
```

### Build Steps

`npm run build` runs:

1. **tsdown** (via `packages/cli/tsdown.config.ts`):
   - `src/install/index.ts` → `dist/install.cjs` (npm bin entry, `#!/usr/bin/env node`)
   - `src/cli.ts` → `dist/cli.cjs` (tools router, `#!/usr/bin/env node`, bundles `@octokit/*`)
   - `src/hooks/maxsim-check-update.ts` → `dist/assets/hooks/maxsim-check-update.cjs`
   - `src/hooks/maxsim-statusline.ts` → `dist/assets/hooks/maxsim-statusline.cjs`
   - `src/hooks/maxsim-sync-reminder.ts` → `dist/assets/hooks/maxsim-sync-reminder.cjs`
   - `src/hooks/maxsim-notification-sound.ts` → `dist/assets/hooks/maxsim-notification-sound.cjs`
   - `src/hooks/maxsim-stop-sound.ts` → `dist/assets/hooks/maxsim-stop-sound.cjs`
   - All outputs are CJS format, target ES2022, Node platform, with sourcemaps

2. **copy-assets.cjs** post-build script:
   - Copies `templates/` → `dist/assets/templates/`
   - Cleans up `.d.cts` declaration files from hooks output
   - Copies `CHANGELOG.md` → `dist/assets/CHANGELOG.md`
   - Copies root `README.md` → `packages/cli/README.md` (for npm tarball)

### npm Tarball Contents

The `files` field in `packages/cli/package.json` includes only `dist/` and `README.md`:

```
maxsimcli/
├── dist/
│   ├── install.cjs          # Entry point (npx maxsimcli)
│   ├── cli.cjs              # Tools router
│   └── assets/
│       ├── templates/       # All markdown assets
│       │   ├── commands/
│       │   ├── workflows/
│       │   ├── agents/
│       │   ├── skills/
│       │   ├── references/
│       │   ├── templates/
│       │   ├── rules/
│       │   └── CLAUDE.md
│       ├── hooks/           # Compiled hook bundles
│       │   ├── maxsim-check-update.cjs
│       │   ├── maxsim-statusline.cjs
│       │   ├── maxsim-sync-reminder.cjs
│       │   ├── maxsim-notification-sound.cjs
│       │   └── maxsim-stop-sound.cjs
│       └── CHANGELOG.md
└── README.md
```

### Publishing

- GitHub Actions (`publish.yml`) triggers on push to `main`
- `semantic-release` analyzes conventional commits since last git tag
- Version bump: `fix:` → patch, `feat:` → minor, `feat!:`/`fix!:` → major
- `chore:`, `docs:`, `test:` → no bump, no publish
- Publishes `maxsimcli` to npm, creates GitHub release and git tag

---

## Install Process

When a user runs `npx maxsimcli` (or `npx maxsimcli --local`), the installer (`dist/install.cjs`) executes:

### File Installation

1. **Commands**: `dist/assets/templates/commands/maxsim/` → `.claude/commands/maxsim/`
   - Path references (`~/.claude/`) are rewritten to `./.claude/` for local installs
   - Attribution strings are processed

2. **Workflows, Templates, References**: `dist/assets/templates/{workflows,templates,references}/` → `.claude/maxsim/{workflows,templates,references}/`

3. **Agents**: `dist/assets/templates/agents/*.md` → `.claude/agents/`
   - Old `maxsim-*` agents are cleaned up

4. **Skills**: `dist/assets/templates/skills/` → `.claude/skills/`
   - Built-in skills are overwritten; user custom skills are preserved

5. **Rules**: `dist/assets/templates/rules/*.md` → `.claude/rules/`

6. **CLAUDE.md**: `dist/assets/templates/CLAUDE.md` → `.claude/CLAUDE.md`

7. **VERSION**: Writes current version to `.claude/maxsim/VERSION`

8. **maxsim-tools.cjs**: `dist/cli.cjs` → `.claude/maxsim/bin/maxsim-tools.cjs`

9. **Hooks**: Compiled hook bundles → `.claude/hooks/`

10. **CHANGELOG**: `dist/assets/CHANGELOG.md` → `.claude/maxsim/CHANGELOG.md`

### Post-Install Configuration

- **settings.json**: Configures Claude Code hooks (statusline, check-update, sync-reminder, notification-sound, stop-sound) in `.claude/settings.json`
- **Statusline**: Optionally configures the Claude Code statusline hook
- **Agent Teams**: Optionally enables `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable
- **Manifest**: Writes a file manifest for future modification detection
- **MCP cleanup**: Removes legacy MAXSIM MCP server entry from `.mcp.json` if present

### Resulting Directory Structure

After install, `.claude/` contains:

```
.claude/
├── commands/maxsim/     # 9 command files
├── maxsim/
│   ├── bin/
│   │   └── maxsim-tools.cjs   # CLI tools router
│   ├── workflows/       # 23 workflow files
│   ├── templates/       # Template files
│   ├── references/      # 14 reference docs
│   ├── VERSION          # Installed version
│   └── CHANGELOG.md
├── agents/              # 4 agent files + AGENTS.md
├── skills/              # 21 skill directories
├── rules/               # Rule files
├── hooks/               # 5 compiled hook bundles
├── CLAUDE.md            # MAXSIM-specific CLAUDE.md
├── settings.json        # Hook and statusline configuration
└── package.json         # {"type":"commonjs"}
```

### Upgrade Safety

- **Backup**: Creates `.claude/maxsim-backup/` before overwriting
- **Local patches**: Detects locally modified MAXSIM files and backs them up
- **Orphan cleanup**: Removes files from previous versions that are no longer needed
- **Manifest**: Tracks all installed files for modification detection
