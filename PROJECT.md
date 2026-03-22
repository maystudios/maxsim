# MaxsimCLI — Project Specification

> **Single Source of Truth** for what MaxsimCLI is, how it works, and what it should become.
> Every architectural decision, feature, and constraint is defined here.

---

## 1. Identity

| Field | Value |
|-------|-------|
| **Name** | MaxsimCLI |
| **Meaning** | **MAX**imale **SIM**plicity |
| **npm package** | `maxsimcli` |
| **Command prefix** | `/maxsim:` |
| **Repository** | `github.com/maystudios/maxsimcli` |
| **Website** | `maxsimcli.com` (Landing Page + Documentation) |
| **License** | MIT |

## 2. What MaxsimCLI Is

MaxsimCLI is a **meta-prompting and project orchestration system** for Claude Code. It installs into any project via `npx maxsimcli@latest` and transforms Claude Code from an ad-hoc coding assistant into a structured, self-improving project management engine.

MaxsimCLI solves three problems simultaneously:

1. **Context Loss** — Without MaxsimCLI, Claude forgets project goals, decisions, and progress across sessions. MaxsimCLI persists everything on GitHub as the single source of truth.
2. **Lack of Structure** — Without MaxsimCLI, large projects devolve into unstructured, untracked work. MaxsimCLI enforces a Plan → Execute → Verify cycle with phases, milestones, and roadmaps.
3. **Quality Control** — Without MaxsimCLI, code is produced without systematic verification. MaxsimCLI enforces strict quality gates with automated testing, linting, spec compliance, and code review.

### Genealogy

MaxsimCLI is an **independent project** inspired by two predecessors:

- **Get-Shit-Done (GSD)** — Provided the project planning model (phases, milestones, roadmaps, verification).
- **Superpowers** — Provided the feedback loop and self-improvement philosophy.

MaxsimCLI is not a fork of either. It combines the best of both, extends them with GitHub-native orchestration and massive parallelism, and follows Anthropic's own conventions exactly.

## 3. Target Audience

All Claude Code users — from beginners to power users. The system is simple to install (one command) and progressive in complexity: beginners use `/maxsim:go` and let the system handle everything; power users configure profiles, skills, and parallel execution strategies.

## 4. Core Principles

1. **GitHub is the Single Source of Truth** — All project state, plans, tasks, progress, decisions, and learnings live on GitHub (Issues, Projects, Milestones, Wiki, Discussions). Local files are only for MaxsimCLI's own installation (`.claude/`).
2. **Maximum Parallelism** — Use as many parallel agents as the task allows. Competitive implementation (same task solved 3 ways, best picked). Agent Teams for complex coordination.
3. **Full Automation** — Commits, merges, pushes, branch management, verification, and error recovery happen automatically. The user is only involved at plan approval gates and when unrecoverable errors occur.
4. **Self-Improvement** — MaxsimCLI learns from every session. Skills, prompts, configurations, and workflows improve over time through a structured feedback loop.
5. **Anthropic Conformity** — Every skill, command, hook, and agent follows Anthropic's documented conventions exactly. Correct tool names (`Agent`, not `Task`), correct frontmatter format, correct skill structure.
6. **Plan Before Execute** — Every action goes through Claude Code's Plan Mode first. The user always sees and approves what will happen before any code is written.

---

## 5. Architecture

### 5.1 Runtime

- **Only Claude Code** — No multi-runtime support. MaxsimCLI is 100% Claude Code focused.
- **Node.js >=22** — Required runtime for the CLI binary.
- **GitHub CLI (`gh`)** — Required for all GitHub operations. If not authenticated, MaxsimCLI refuses to start.

### 5.2 Installation

```bash
npx maxsimcli@latest
```

One command. Installs project-locally into `.claude/`. No global installation.

**What gets installed:**
```
.claude/
├── settings.json          # Claude Code settings (hooks, permissions, env)
├── settings.local.json    # Local overrides (not committed)
├── CLAUDE.md              # → symlinked/copied to project root
├── commands/maxsim/       # 9 slash commands
├── agents/                # 4 agent definitions
├── skills/                # 14 skill modules
├── rules/                 # Conventions + verification protocol
├── maxsim/
│   ├── bin/maxsim-tools.cjs  # Internal CLI helper
│   ├── hooks/             # Hook scripts (statusline, update-check, sounds)
│   ├── workflows/         # Workflow definitions
│   ├── references/        # Reference documents
│   └── templates/         # Output templates
└── agent-memory/          # Per-agent persistent memory (auto-created)
```

**What does NOT exist:**
- No `.planning/` directory — all planning lives on GitHub
- No local `STATE.md`, `ROADMAP.md`, `PLAN.md` files — GitHub is the source of truth
- No global `~/.claude/maxsim/` installation — everything is project-local

### 5.3 GitHub Integration (Mandatory)

GitHub is not optional. MaxsimCLI requires:

| GitHub Feature | Purpose |
|----------------|---------|
| **Repository** | Code storage. If none exists, MaxsimCLI offers to create a private repo. |
| **GitHub Projects (v2)** | Visual project board. Kanban: To Do → In Progress → In Review → Done |
| **GitHub Issues** | Source of truth for phases, tasks, plans, and context |
| **Sub-Issues** | Tasks within a phase (sub-issues of the phase issue) |
| **GitHub Milestones** | Group phases into deliverable milestones |
| **Labels** | Categorize issues (phase, task, blocker, bug, etc.) |
| **Issue Comments** | Store plans, research, context, summaries as structured comments |
| **GitHub Wiki** | Project conventions, requirements, decisions |
| **GitHub Discussions** | Architecture decisions, design proposals |

**User-created Issues:** Users can write GitHub Issues directly. MaxsimCLI recognizes them and integrates them into the planning/execution pipeline.

### 5.4 Local Files

Only `.claude/` exists locally. Additionally:

- `CLAUDE.md` in project root — Auto-generated during init. Brief: project name, that MaxsimCLI is installed, available commands, link to GitHub Project. Claude Code reads this automatically at session start.
- No other MaxsimCLI files in the project root or anywhere outside `.claude/`.

### 5.5 State Tracking

The project state IS the GitHub Project Board:
- Which column an issue is in = its status
- Open/closed issues = progress
- Milestone completion percentage = roadmap progress
- Issue comments = plans, research, context, summaries
- Issue labels = categorization

No local state file. No sync mechanism needed. GitHub is always authoritative.

### 5.6 Multi-Project Isolation

Each project is completely isolated:
- Own `.claude/` directory
- Own GitHub Project Board
- Own agent memory (`.claude/agent-memory/`)
- No cross-project interference
- No shared global state

---

## 6. Commands

MaxsimCLI provides **9 slash commands**. `/maxsim:go` is the primary interface.

### 6.1 Command List

| Command | Purpose | Primary? |
|---------|---------|----------|
| `/maxsim:go` | **Auto-dispatch** — Detects project state and does the right thing | **YES** |
| `/maxsim:init` | Initialize MaxsimCLI in a project | Setup |
| `/maxsim:plan [N]` | Plan a specific phase | Explicit |
| `/maxsim:execute [N]` | Execute a specific phase | Explicit |
| `/maxsim:debug [desc]` | Debug a specific issue | Explicit |
| `/maxsim:quick [desc]` | Quick task (simplified flow) | Shortcut |
| `/maxsim:progress` | Show project status + recommendation | Info |
| `/maxsim:settings` | Configure MaxsimCLI | Config |
| `/maxsim:help` | Show available commands | Info |

### 6.2 `/maxsim:go` — The Main Command

Auto-dispatch is the primary way users interact with MaxsimCLI. It:
1. Reads the GitHub Project Board
2. Determines the current state (what's planned, what's in progress, what's blocked)
3. Proposes the next action
4. Enters Plan Mode for user approval
5. Executes the approved action
6. Reports results

### 6.3 `/maxsim:init` — Project Initialization

Interactive process:
1. **Scan** — Analyze existing repo (if any): README, package.json, tech stack, file structure. Use 30+ parallel Research agents.
2. **Interview** — Deep questioning: project name, description, goals, tech stack, conventions, testing strategy, deployment, acceptance criteria, no-gos, risks.
3. **GitHub Setup** — Create/configure: GitHub repo (if none, offer to create private), GitHub Project Board (Kanban), Labels, Milestones.
4. **CLAUDE.md** — Generate project-root CLAUDE.md with brief context.
5. **Roadmap** (optional) — Ask user if they want an initial roadmap created as GitHub Milestones + Phase Issues.

For **brownfield projects** (existing code): Use massive parallel agent scanning (30-40 agents) to map the codebase, identify goals/patterns, then confirm with user before creating the GitHub structure.

### 6.4 `/maxsim:plan [N]`

Plans a specific phase:
1. Enter Plan Mode
2. Read phase issue from GitHub
3. Discussion stage — gather context
4. Research stage — parallel research agents investigate
5. Planning stage — create task breakdown as sub-issues
6. User approves plan via ExitPlanMode

### 6.5 `/maxsim:execute [N]`

Executes a planned phase:
1. Enter Plan Mode — show all plans for review
2. User approves via ExitPlanMode
3. Spawn executor agents in adaptive waves
4. Each executor works in its own git worktree
5. Competitive implementation: same task solved multiple ways, best selected
6. Automatic verification after each task
7. Max 3 retries on failure
8. Merge verified worktrees sequentially, auto-resolve conflicts, verify merged result
9. Push to remote

### 6.6 `/maxsim:debug [desc]`

Dedicated debugging:
- Auto-detected by `/maxsim:go` when issues exist
- Also callable directly
- Uses systematic-debugging skill (reproduce → hypothesize → isolate → verify → fix → confirm)

### 6.7 `/maxsim:quick [desc]`

Simplified flow for small tasks:
- Creates a single GitHub Issue
- Plans and executes in one flow
- No multi-phase overhead

### 6.8 `/maxsim:progress`

Shows:
- GitHub Project Board status summary
- Textual project summary
- Recommendation for what to do next

### 6.9 Behavior Without a Command

When a user opens Claude Code and describes a task without using `/maxsim:`, Claude sees the CLAUDE.md which contains a soft hint that MaxsimCLI is available. Claude works normally but may suggest using `/maxsim:go` or `/maxsim:quick`.

---

## 7. Agent System

### 7.1 Agent Types

| Agent | Role | Tools | Preloaded Skills |
|-------|------|-------|------------------|
| **Executor** | Implements code changes | Read, Write, Edit, Bash, Grep, Glob | handoff-contract, commit-conventions |
| **Planner** | Creates plans and task breakdowns | Read, Write, Bash, Grep, Glob (permissionMode: plan) | handoff-contract, roadmap-writing |
| **Researcher** | Investigates codebase and external sources | Read, Bash, Grep, Glob, WebFetch, WebSearch | handoff-contract, research |
| **Verifier** | Reviews and verifies completed work | Read, Bash, Grep, Glob | handoff-contract, verification, code-review |

### 7.2 Parallelism Strategy

**Hybrid approach: Agent Tool + Agent Teams**

- **Agent Tool** (`isolation: "worktree"`) — For parallel execution of independent tasks. Follows Anthropic's batch pattern: all agents spawned in a single message block, self-contained prompts, `run_in_background: true`.
- **Agent Teams** — For complex tasks requiring inter-agent communication. Teammates can message each other, share a task list, and coordinate. Used within each parallel branch.
- **Competitive Implementation** — The same task can be assigned to 2-3 executor agents simultaneously. Each works independently. The verifier picks the best implementation.

### 7.3 Worktrees

Every executor agent works in its own git worktree. Always. No exceptions.
- Worktree per agent: `.maxsim-worktrees/{taskId}/`
- Own branch per worktree
- Merged back after verification
- Sequential merge order to minimize conflicts
- Auto-resolve where possible, verifier checks merged result

### 7.4 Model Configuration

**Profiles** define default models per agent type:

| Profile | Planner | Executor | Researcher | Verifier |
|---------|---------|----------|------------|----------|
| quality | opus | opus | sonnet | opus |
| balanced (default) | opus | sonnet | sonnet | sonnet |
| budget | sonnet | sonnet | haiku | sonnet |

- Profiles are configurable via `/maxsim:settings`
- Individual agent overrides possible
- Claude can autonomously choose a different model when justified (e.g., Haiku for simple file listing, Opus with extended thinking for complex architecture)

---

## 8. Plan Mode Integration

**Every MaxsimCLI command starts in Plan Mode.** This ensures the user always sees and approves what will happen before any code changes.

Flow:
1. Command invoked (e.g., `/maxsim:go`)
2. MaxsimCLI enters Plan Mode (EnterPlanMode)
3. Read-only research and analysis
4. Plan presented to user
5. User approves (ExitPlanMode)
6. Execution begins

**Planner agent** has `permissionMode: plan` in its frontmatter — enforcing read-only operation regardless of parent session state.

---

## 9. Skills

MaxsimCLI ships with **14 skills**, following Anthropic's skill conventions exactly.

### 9.1 Skill Format

Every skill follows this structure:
```yaml
---
name: skill-name          # kebab-case, matches folder name
description: What it does. Use when [trigger conditions].
---

# Skill Title

[Body: max 500 lines, structured instructions]
```

- YAML frontmatter with `name` and `description` (required)
- Third-person descriptions
- No `@` imports (use plain path references)
- Heavy content in `references/` subdirectory
- Loaded on-demand by Claude Code's semantic matching

### 9.2 Skill Inventory

| # | Skill | Type | Purpose |
|---|-------|------|---------|
| 1 | `tdd` | Technique | Test-Driven Development (red-green-refactor cycle) |
| 2 | `systematic-debugging` | Technique | Reproduce → Hypothesize → Isolate → Verify → Fix → Confirm |
| 3 | `brainstorming` | Technique | Multi-approach design exploration before implementation |
| 4 | `roadmap-writing` | Technique | Phase planning with dependencies and success criteria |
| 5 | `handoff-contract` | Infrastructure | Standard output format for all agent results |
| 6 | `commit-conventions` | Infrastructure | Conventional commits, atomic changes, co-author attribution |
| 7 | `maxsim-batch` | Technique | Parallel execution orchestration (batch pattern) |
| 8 | `code-review` | Technique | Security, quality, spec-compliance review |
| 9 | `verification` | Infrastructure | **MERGED** from: verification-before-completion + evidence-collection + verification-gates. Single authoritative verification skill with gate framework, evidence blocks, anti-rationalization enforcement. |
| 10 | `github-operations` | Infrastructure | **MERGED** from: github-artifact-protocol + github-tools-guide. Unified GitHub interaction: artifact types, comment conventions, CLI commands, lifecycle state machine. |
| 11 | `research` | Technique | **MERGED** from: research-methodology + tool-priority-guide. Systematic investigation with source hierarchy and Claude Code tool priority. |
| 12 | `project-memory` | Infrastructure | **NEW** — GitHub-native persistence for project learnings, decisions, and patterns. |
| 13 | `using-maxsim` | User-facing | Command reference and routing table. Updated for v5 commands. |
| 14 | `maxsim-simplify` | Technique | Code simplification, dead code removal, reuse improvement. |

### 9.3 Skill Loading

- Skills are auto-loaded by Claude Code based on semantic description matching
- Agent prompts mention recommended skills (e.g., "prefer using the tdd skill")
- Users can request specific skills during init (e.g., "use the UX-Pro skill")
- Skills can invoke other skills via the `Skill` tool

---

## 10. Verification System

### 10.1 Philosophy

Verification is **automatic, strict, and evidence-based**. No completion claims without fresh verification evidence.

### 10.2 What Gets Checked

After every task execution:

| Check | Tool | Required |
|-------|------|----------|
| Tests pass | Test runner (jest, vitest, pytest, etc.) | Yes |
| Build succeeds | Build tool (tsc, vite, etc.) | Yes |
| Lint clean | Linter (biome, eslint, etc.) | Yes |
| Spec compliance | Verify planned tasks were implemented | Yes |
| Code review | Parallel review agents (security, quality, efficiency) | Yes |
| Evidence block | Structured CLAIM/EVIDENCE/OUTPUT/VERDICT | Yes |

### 10.3 Retry Logic

- Max **3 automatic retries** on verification failure
- Each retry spawns a fresh executor agent (no accumulated context rot)
- After 3 failures: escalate to user with diagnostic GitHub Issue
- autoresearch-style: atomic change → verify → keep/discard

### 10.4 Guard Pattern

Borrowed from autoresearch:
- **Verify command** — "Did this task accomplish its goal?" (primary metric)
- **Guard command** — "Did this task break what was already working?" (regression check)
- If guard fails after verify passes: 2 rework attempts before discarding

---

## 11. Self-Improvement

### 11.1 Philosophy

MaxsimCLI improves locally per project with every session. Inspired by autoresearch: atomic changes, metric-based evaluation, keep/discard decisions.

### 11.2 What Improves

| Target | Mechanism |
|--------|-----------|
| Skills | Feedback loop adjusts skill instructions based on success/failure patterns |
| Configuration | Model profiles, parallelism settings, verification thresholds auto-tuned |
| Workflows | Process steps refined based on what worked vs what caused failures |
| Prompts | Agent prompts refined based on output quality metrics |

### 11.3 Feedback Loop

```
Session Start
  → Read git log (last 20 commits) for patterns
  → Read project memory (agent-memory/MEMORY.md)
  → Apply learned adjustments

Session Work
  → Execute tasks
  → Measure results (tests, build, spec compliance)
  → Log results to autoresearch-results.tsv

Session End (Stop hook)
  → Capture learnings
  → Update agent memory
  → Record what worked / what failed
```

### 11.4 Storage

- **Git as Memory** — `git log --oneline -20` at session start reveals what was tried
- **Agent Memory** — `.claude/agent-memory/maxsim-learner/MEMORY.md` (Claude Code's subagent memory system, `memory: project`)
- **Results TSV** — `autoresearch-results.tsv` (gitignored) for metric tracking
- **Claude Code Memory** — Native auto-memory for user-level preferences

### 11.5 Isolation

All improvements are project-local. Two projects using MaxsimCLI never interfere with each other:
- Separate `.claude/agent-memory/`
- Separate `autoresearch-results.tsv`
- Separate Claude Code auto-memory (keyed by git repo)

---

## 12. Hooks

### 12.1 Hook List

| Hook | Event | Purpose |
|------|-------|---------|
| `maxsim-statusline` | statusLine | Show current MaxsimCLI status in terminal |
| `maxsim-check-update` | SessionStart | Check for new MaxsimCLI version |
| `maxsim-notification-sound` | Notification | Play sound when Claude asks a question |
| `maxsim-stop-sound` | Stop | Play sound when Claude finishes |
| `maxsim-capture-learnings` | Stop | Capture session learnings to agent memory |

### 12.2 Agent Team Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| TeammateIdle quality gate | TeammateIdle | Exit code 2 = teammate must continue (tests not passing) |
| TaskCompleted verification | TaskCompleted | Exit code 2 = task stays incomplete (verification failed) |

---

## 13. Error Handling

Three-tier recovery:

1. **Debug** — MaxsimCLI automatically enters debug mode and attempts to diagnose/fix the issue
2. **Rollback** — If debugging fails, revert to the last verified state (`git revert`)
3. **Escalate** — Create a diagnostic GitHub Issue with full context and notify the user

---

## 14. Git Strategy

### 14.1 Branching

MaxsimCLI decides the branching strategy:
- Each executor agent gets a worktree branch: `maxsim/phase-{N}-task-{id}`
- After verification, branches are merged into the main branch
- Sequential merge order to minimize conflicts
- Auto-resolve where possible
- Verifier checks the merged result

### 14.2 Commits

Fully automatic:
- Conventional commit format: `type(scope): description`
- Co-author attribution: `Co-Authored-By: Claude <noreply@anthropic.com>`
- Atomic commits (one logical change per commit)
- Automatic push after successful verification

---

## 15. Technical Stack

### 15.1 Monorepo Structure

```
maxsimcli/
├── packages/
│   ├── cli/              # Main CLI package (TypeScript)
│   │   ├── src/
│   │   │   ├── core/     # Core logic (config, state, phases, milestones)
│   │   │   ├── github/   # GitHub API integration (Projects v2, Issues, etc.)
│   │   │   ├── hooks/    # Hook scripts
│   │   │   └── install/  # Install/uninstall logic
│   │   └── tests/        # Unit + E2E tests (TDD)
│   └── website/          # Landing page + documentation (React + Vite)
├── templates/            # Source templates (copied to .claude/ during install)
│   ├── agents/           # 4 agent definitions
│   ├── commands/maxsim/  # 9 slash commands
│   ├── skills/           # 14 skill modules
│   ├── workflows/        # Workflow definitions
│   ├── references/       # Reference documents
│   ├── rules/            # Conventions + verification
│   └── templates/        # Output templates
├── docs/                 # Reference documentation (Anthropic courses, GSD reference, etc.)
└── scripts/              # Build/test scripts
```

### 15.2 Technology

| Component | Technology |
|-----------|-----------|
| Language | TypeScript |
| Bundler | tsdown (rolldown) |
| Testing | Vitest (TDD for everything) |
| Linting | Biome |
| CI/CD | GitHub Actions |
| Releases | semantic-release |
| Website | React + Vite + Tailwind CSS + Framer Motion |
| Documentation | Markdoc |

### 15.3 Testing Strategy

**TDD for everything.** Tests before code.

| Level | Coverage |
|-------|----------|
| Unit tests | Core logic, GitHub API, config, state, phases |
| Integration tests | Install/uninstall flow, hook registration |
| E2E tests | Full user flow: install → init → plan → execute |

---

## 16. Website

`maxsimcli.com` serves two purposes:

1. **Landing Page** — Marketing: features, benefits, installation instructions, tech stack showcase
2. **Full Documentation** — All commands, workflows, skills, configuration, and guides

---

## 17. What MaxsimCLI is NOT

- **Not a fork** of GSD or Superpowers — it is an independent project inspired by both
- **Not multi-runtime** — it only works with Claude Code
- **Not global** — it installs per-project, not globally
- **Not local-first** — GitHub is always the source of truth
- **Not a MCP server** — commands are slash commands, not MCP tools
- **Not optional** — GitHub integration is mandatory, not a plugin

---

## 18. Success Criteria

MaxsimCLI is successful when:

1. A user can run `npx maxsimcli@latest` in any project and within minutes have a fully orchestrated development environment
2. `/maxsim:go` correctly detects project state and proposes the right action every time
3. Phases are planned, executed, and verified without manual intervention
4. The GitHub Project Board accurately reflects the project's real state at all times
5. Quality gates prevent broken code from being merged
6. The system measurably improves with each session (fewer errors, better plans, faster execution)
7. All components follow Anthropic's conventions exactly

---

## 19. Implementation Roadmap (Clean Rewrite v6)

**Strategy:** Clean rewrite on `main`. Phase for phase. Each phase = tagged commit.
**Approach:** TDD — tests first, implementation second. Parallel agents for execution.
**Spec Documents:** `docs/spec/` contains all technical details for each phase.

### Phase 0: Foundation
**Goal:** Clean slate with correct build tooling.
**Spec:** N/A (infrastructure only)
```
1. git tag v5-archive (preserve current state)
2. Clear packages/cli/src/ completely
3. Set up fresh TypeScript project:
   - tsconfig.json (strict mode)
   - tsdown.config.ts (correct entry points)
   - vitest.config.ts (TDD setup)
   - biome.json (with rules ENABLED)
4. Create package.json with correct:
   - dependencies (only runtime needs)
   - devDependencies (build/test tools)
   - bin entry point
   - engines: >=22
5. Verify: npm run build && npm test passes (empty)
```
**Commit:** `chore: clean rewrite foundation v6`

### Phase 1: Core Types & Config
**Goal:** Type-safe foundation for the entire system.
**Spec:** PROJECT.md §5, §7, §14
```
1. src/core/types.ts — All TypeScript interfaces (single source)
2. src/core/config.ts — Config loading (from .claude/maxsim/config.json)
3. src/core/cli.ts — CLI entry point (maxsim-tools.cjs)
4. src/core/utils.ts — Shared utilities (path construction, frontmatter parsing)
5. Tests: unit tests for every exported function
```
**Commit:** `feat: core types and config module`

### Phase 2: GitHub Module (THE critical module)
**Goal:** Correct GitHub Projects v2 integration from scratch.
**Spec:** `docs/spec/github-projects-v2-api.md`, `docs/spec/github-structure-design.md`
```
1. src/github/client.ts — Octokit setup, auth, error handling
2. src/github/projects.ts — Projects v2 (GraphQL + REST, CORRECT APIs)
3. src/github/issues.ts — Issues + Sub-Issues (correct ID types)
4. src/github/milestones.ts — Milestones (with pagination)
5. src/github/labels.ts — Label taxonomy (30+ labels)
6. src/github/comments.ts — Structured comments (HTML markers)
7. src/github/mapping.ts — Local cache (github-issues.json)
8. src/github/sync.ts — State synchronization
9. src/github/commands.ts — All GitHub CLI commands
10. src/github/types.ts — GitHub-specific types
11. Tests: unit tests with mocked Octokit, E2E with real API
```
**Commit:** `feat: GitHub Projects v2 integration (correct API)`

### Phase 3: Install System
**Goal:** npx maxsimcli@latest works correctly.
**Spec:** PROJECT.md §5.2, `docs/spec/claude-md-guide.md`
```
1. src/install/index.ts — Main installer orchestrator
2. src/install/copy.ts — Template file copying (with path replacement)
3. src/install/hooks.ts — Hook registration in settings.json
4. src/install/uninstall.ts — Clean uninstall (complete!)
5. src/install/manifest.ts — Track all installed files
6. scripts/copy-assets.cjs — Build step: copy templates to dist
7. Tests: E2E install/uninstall cycle
```
**Commit:** `feat: install system with complete uninstall`

### Phase 4: Commands + Workflows
**Goal:** 9 slash commands with correct tool names and GitHub-first workflows.
**Spec:** PROJECT.md §6, `docs/spec/init-process-design.md`, `docs/spec/wave-execution-design.md`
```
1. templates/commands/maxsim/ — All 9 commands (correct frontmatter)
   - Use 'Agent' tool (NOT 'Task')
   - Use correct allowed-tools
   - Correct argument-hint on all commands
2. templates/workflows/ — All workflows (GitHub-first)
   - No local .planning/ references
   - GitHub Issues as source of truth
   - Plan Mode integration (EnterPlanMode before execute)
   - Correct Agent tool spawn syntax
3. Tests: frontmatter parsing, workflow references
```
**Commit:** `feat: commands and workflows (GitHub-first, correct tool names)`

### Phase 5: Skills (14 new)
**Goal:** 14 skills following Anthropic conventions exactly.
**Spec:** `docs/spec/skills-specification.md`, `docs/spec/skills-writing-guide.md`
```
1. Keep 8: tdd, systematic-debugging, brainstorming, roadmap-writing,
   handoff-contract, commit-conventions, maxsim-batch, code-review
2. Merge 3: verification, github-operations, research
3. New 2: project-memory, using-maxsim (updated)
4. Keep 1: maxsim-simplify
5. All with correct YAML frontmatter (name, description)
6. All under 500 lines
7. No @ imports
8. Third-person descriptions
```
**Commit:** `feat: 14 skills (Anthropic-compliant)`

### Phase 6: Agents (4 definitions)
**Goal:** 4 agent definitions with valid YAML frontmatter.
**Spec:** PROJECT.md §7
```
1. templates/agents/executor.md — Valid YAML, correct tools
2. templates/agents/planner.md — permissionMode: plan
3. templates/agents/researcher.md — WebSearch + WebFetch
4. templates/agents/verifier.md — Verification skills
5. templates/agents/AGENTS.md — Registry (no debugger row)
6. No pipe-table YAML! Use proper YAML lists.
```
**Commit:** `feat: 4 agent definitions (valid YAML)`

### Phase 7: Hooks
**Goal:** Working hooks for statusline, updates, sounds, learnings.
**Spec:** `docs/spec/hooks-reference.md`
```
1. src/hooks/maxsim-statusline.ts — Status in terminal
2. src/hooks/maxsim-check-update.ts — Version check on SessionStart
3. src/hooks/maxsim-notification-sound.ts — Sound on Notification (correct event!)
4. src/hooks/maxsim-stop-sound.ts — Sound on Stop
5. src/hooks/maxsim-capture-learnings.ts — NEW: Save learnings on Stop
6. Correct registration in settings.json (right events, right matchers)
7. Platform-safe paths (quoted for Windows spaces)
```
**Commit:** `feat: hooks (correct events, learnings capture)`

### Phase 8: Self-Improvement
**Goal:** autoresearch-style feedback loop.
**Spec:** `docs/spec/self-improvement-guide.md`, `docs/spec/memory-system-guide.md`
```
1. Verify + Guard dual-command pattern in verification workflow
2. Git-as-Memory: read git log at session start
3. Results TSV logging after each phase
4. Agent memory integration (memory: project on agents)
5. Stop hook captures learnings to MEMORY.md
6. Stuck detection (5 consecutive failures → recovery)
```
**Commit:** `feat: self-improvement loop (autoresearch-adapted)`

### Phase 9: Documentation & Website
**Goal:** All docs match the new v6 implementation.
**Spec:** All docs/spec/ documents
```
1. Rewrite USER-GUIDE.md for v6
2. Rewrite INTERNALS.md for v6
3. Update README.md
4. Update website markdown docs (keep design, update content)
5. Fix CONTRIBUTING.md (correct lint command, etc.)
6. Update GitHub issue templates
7. Update global CLAUDE.md template
8. Verify all docs match actual code
```
**Commit:** `docs: complete documentation for v6`

### Release
```
1. npm version major (6.0.0)
2. Update CHANGELOG.md
3. npm publish
4. Deploy website
5. Announce
```

---

## 20. Deep-Dive Specifications

Each section above has a corresponding deep-dive document in `docs/spec/` with full technical details, API references, and implementation guidance.

| # | Topic | Document | Lines | Key Content |
|---|-------|----------|-------|-------------|
| 1 | GitHub Projects v2 API | [`github-projects-v2-api.md`](docs/spec/github-projects-v2-api.md) | 2,374 | Complete REST + GraphQL + gh CLI reference, Sub-Issues API, authentication, pagination |
| 2 | GitHub Issue Structure | [`github-structure-design.md`](docs/spec/github-structure-design.md) | 1,855 | Board design, issue hierarchy, 30+ labels, 9 comment types, IssueOps, GitHub Actions |
| 3 | Agent Teams Guide | [`agent-teams-guide.md`](docs/spec/agent-teams-guide.md) | 1,283 | TeamCreate, SendMessage, TeammateIdle/TaskCompleted hooks, 6 coordination patterns |
| 4 | Plan Mode Guide | [`plan-mode-guide.md`](docs/spec/plan-mode-guide.md) | 1,090 | EnterPlanMode/ExitPlanMode mechanics, permissionMode:plan, tool restrictions |
| 5 | Skills Writing Guide | [`skills-writing-guide.md`](docs/spec/skills-writing-guide.md) | 1,480 | Anthropic skill conventions, frontmatter spec, CSO rules, 12 anti-patterns |
| 6 | Skills Specification | [`skills-specification.md`](docs/spec/skills-specification.md) | 985 | All 14 target skills: name, description, structure, agent preloads |
| 7 | Memory System Guide | [`memory-system-guide.md`](docs/spec/memory-system-guide.md) | 1,340 | CLAUDE.md, auto memory, MEMORY.md, subagent memory, feedback loops |
| 8 | CLAUDE.md Guide | [`claude-md-guide.md`](docs/spec/claude-md-guide.md) | 961 | Best practices, template, 200-line limit, path-scoped rules |
| 9 | Self-Improvement Guide | [`self-improvement-guide.md`](docs/spec/self-improvement-guide.md) | 1,151 | autoresearch adaptation, 8-phase loop, Verify+Guard, Git-as-Memory |
| 10 | Parallel Execution Guide | [`parallel-execution-guide.md`](docs/spec/parallel-execution-guide.md) | 1,043 | Agent tool parameters, batch pattern, worktree isolation, token costs |
| 11 | Wave Execution Design | [`wave-execution-design.md`](docs/spec/wave-execution-design.md) | 848 | Dependency analysis, Kahn's algorithm, adaptive waves, error recovery |
| 12 | Competitive Implementation | [`competitive-implementation-design.md`](docs/spec/competitive-implementation-design.md) | 1,136 | Best-of-N sampling, 7 scoring criteria, prompt variation, hybrid strategy |
| 13 | Verification System | [`verification-system-design.md`](docs/spec/verification-system-design.md) | 1,432 | Gate framework, evidence blocks, anti-rationalization, Guard pattern |
| 14 | Init Process Design | [`init-process-design.md`](docs/spec/init-process-design.md) | ~1,000 | 5-phase init, 30+ scan agents, adaptive interview, GitHub setup |
| 15 | Hooks Reference | [`hooks-reference.md`](docs/spec/hooks-reference.md) | ~1,200 | All 22 hook events, settings.json format, 4 handler types, 12 gotchas |
| 16 | Git Worktree Strategy | [`git-worktree-strategy.md`](docs/spec/git-worktree-strategy.md) | 2,007 | Worktree lifecycle, merge strategies, conflict resolution, cleanup |
| 17 | Claude Code SDK Guide | [`claude-code-sdk-guide.md`](docs/spec/claude-code-sdk-guide.md) | ~800 | Claude Agent SDK, headless mode, programmatic sessions, @maxsim/sdk |

**Total specification volume: ~20,000+ lines across 18 documents.**

---

*This document is the authoritative specification for MaxsimCLI. All code, templates, documentation, and workflows must conform to what is defined here. The deep-dive documents in `docs/spec/` provide the technical details for implementation. When in doubt, this document wins.*
