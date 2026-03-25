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
| **Repository** | `https://github.com/maystudios/maxsimcli` |
| **Website** | `maxsimcli.dev` (Landing Page + Documentation) |
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
2. **Maximum Parallelism** — Two-tier hybrid: Subagents (Tier 1, default) for independent tasks, Agent Teams (Tier 2, opt-in) for workflows requiring inter-agent communication. Scaled by model profile (budget: 5–10, balanced: 10–20, quality: 30–40) and project size. Competitive implementation available as an optional strategy. Graceful degradation to Tier 1 when Agent Teams are unavailable.
3. **Full Automation** — Commits, merges, pushes, branch management, verification, and error recovery happen automatically. The user is only involved at plan approval gates and when unrecoverable errors occur.
4. **Self-Improvement** — MaxsimCLI learns from every session. Skills, prompts, configurations, and workflows improve over time through a structured feedback loop.
5. **Anthropic Conformity** — Every skill, command, hook, and agent follows Anthropic's documented conventions exactly. Correct tool names (`Agent`, not `Task`), correct frontmatter format, correct skill structure.
6. **Plan Before Execute** — Every action that modifies code, GitHub state, or project configuration goes through Claude Code's Plan Mode first. The user always sees and approves what will happen before any code is written. Read-only commands (help, progress) are exempt.

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
├── commands/maxsim/       # 13 slash commands
├── agents/                # 4 agent definitions + AGENTS.md registry
├── skills/                # 15 skill modules
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
| **GitHub Projects (v2)** | Visual project board. Kanban: Backlog → To Do → In Progress → In Review → Done |
| **GitHub Issues** | Source of truth for phases, tasks, plans, and context |
| **Sub-Issues** | Tasks within a phase (sub-issues of the phase issue) |
| **GitHub Milestones** | Group phases into deliverable milestones |
| **Labels** | Categorize issues — 6 labels in 2 namespaces: `type:` (phase, task, bug, quick) and `maxsim:` (auto, user) |
| **Issue Relations** | Native GitHub "blocked by" / "blocking" for dependency tracking |
| **Issue Comments** | Store plans, research, context, summaries as structured comments |
| **GitHub Wiki** | Project conventions, requirements, decisions |
| **GitHub Discussions** | Architecture decisions, design proposals |

**User-created Issues:** Users can write GitHub Issues directly. MaxsimCLI recognizes them and integrates them into the planning/execution pipeline.

### 5.4 Local Files

Only `.claude/` exists locally. Additionally:

- `CLAUDE.md` in project root — Auto-generated during install. Contains a full command reference table with Quick Start pointing to `/maxsim:go`. Claude Code reads this automatically at session start.
- No other MaxsimCLI files in the project root or anywhere outside `.claude/`.

### 5.5 State Tracking

The project state IS the GitHub Project Board:
- Which column an issue is in = its status (Backlog → To Do → In Progress → In Review → Done)
- Open/closed issues = progress
- Milestone completion percentage = roadmap progress
- Issue comments = plans, research, context, summaries
- Issue labels = type categorization (`type:phase`, `type:task`, `type:bug`, `type:quick`) and origin (`maxsim:auto`, `maxsim:user`)
- Issue relations = dependency tracking (native GitHub "blocked by" / "blocking")

No local state file. No sync mechanism needed. No local cache. GitHub is always authoritative.

### 5.6 Multi-Project Isolation

Each project is completely isolated:
- Own `.claude/` directory
- Own GitHub Project Board
- Own agent memory (`.claude/agent-memory/`)
- No cross-project interference
- No shared global state

---

## 6. Commands

MaxsimCLI provides **13 slash commands**. `/maxsim:go` is the primary interface.

### 6.1 Command List

| Command | Purpose | Category |
|---------|---------|----------|
| `/maxsim:go` | **Auto-dispatch** — Detects project state and does the right thing | **Primary** |
| `/maxsim:init` | Initialize MaxsimCLI in a project | Setup |
| `/maxsim:plan [N]` | Plan a specific phase | Phase |
| `/maxsim:execute [N]` | Execute a specific phase | Phase |
| `/maxsim:debug [desc]` | Debug a specific issue | Explicit |
| `/maxsim:quick [desc]` | Quick task (simplified flow) | Shortcut |
| `/maxsim:progress` | Show project status + recommendation | Info |
| `/maxsim:settings` | Configure MaxsimCLI | Config |
| `/maxsim:help` | Show available commands | Info |
| `/maxsim:improve` | **Autonomous optimization loop** — modify→verify→keep/discard cycle against any metric | Optimization |
| `/maxsim:fix-loop` | **Autonomous error repair** — Iteratively fix until zero errors remain | Optimization |
| `/maxsim:debug-loop` | **Autonomous bug hunting** — Scientific method with hypothesis testing | Optimization |
| `/maxsim:security` | **Security audit** — STRIDE + OWASP + red-team analysis (read-only) | Audit |

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
1. **Scan** — Analyze existing repo (if any): README, package.json, tech stack, file structure. Use parallel Research agents (count scaled by model profile and project size — see §7.4).
2. **Interview** — Deep questioning: project name, description, goals, tech stack, conventions, testing strategy, deployment, acceptance criteria, no-gos, risks.
3. **GitHub Setup** — Create/configure: GitHub repo (if none, offer to create private), GitHub Project Board (Kanban), Labels, Milestones.
4. **CLAUDE.md** — Generate project-root CLAUDE.md with brief context.
5. **Roadmap** (optional) — Ask user if they want an initial roadmap created as GitHub Milestones + Phase Issues.

For **brownfield projects** (existing code): Use parallel agent scanning (count determined by model profile and codebase size — see §7.4) to map the codebase, identify goals/patterns, then confirm with user before creating the GitHub structure.

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
5. Competitive implementation (optional): if enabled or user-approved, same task solved multiple ways, best selected
6. Automatic verification after each task
7. Max 3 retries on failure
8. Merge verified worktrees sequentially, auto-resolve conflicts, verify merged result
9. Push to remote

### 6.6 `/maxsim:debug [desc]`

Dedicated debugging:
- Auto-detected by `/maxsim:go` when issues exist
- Also callable directly
- Uses systematic-debugging skill (reproduce → hypothesize → isolate → verify → fix → resolve)

### 6.7 `/maxsim:quick [desc]`

Simplified flow for small tasks:
- Creates a single GitHub Issue
- Plans and executes in one flow
- No multi-phase overhead

### 6.8 `/maxsim:progress`

Shows:
- GitHub Project Board status table (phases, tasks, columns)
- Gap detection (blocked, overdue, or missing tasks)
- Next-action recommendation with the exact command to run

### 6.9 Behavior Without a Command

When a user opens Claude Code and describes a task without using `/maxsim:`, Claude sees the auto-generated CLAUDE.md which contains a full command reference table with a Quick Start note pointing to `/maxsim:go`. Claude works normally but is aware of all available MaxsimCLI commands.

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

**Two-tier hybrid: Subagents (default) + Agent Teams (opt-in)**

> Research completed 2026-03-24. Full findings: `docs/spec/agent-teams-research.md`
> Official docs: https://code.claude.com/docs/en/agent-teams

#### Tier 1 — Subagents (Default)

For parallel execution of independent tasks. This is MaxsimCLI's primary execution mechanism.

- Uses the `Agent` tool with `isolation: "worktree"` and `run_in_background: true`
- Follows Anthropic's batch pattern: all agents spawned in a single message block
- Each subagent gets a self-contained prompt with full context (no shared state)
- Results return to the coordinator; subagents cannot communicate with each other
- **Cost: ~2x** a single session for 3 workers — token-efficient
- Works on all platforms, all plans, all terminals

**Used for:**
- `/maxsim:execute` — parallel phase execution (independent tasks)
- `/maxsim:init` — parallel codebase scanning (read-only, report back)
- `/maxsim:plan` — parallel research gathering (when no cross-checking needed)
- Any workflow where tasks are independent and only the result matters

#### Tier 2 — Agent Teams (Opt-in)

For workflows that genuinely require inter-agent communication, shared task lists, and peer-to-peer messaging.

- Experimental feature (since Feb 2026, Claude Code v2.1.32+)
- Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (set by MaxsimCLI installer)
- Each teammate is a fully independent Claude Code session with its own context window
- Teammates share a task list (`~/.claude/tasks/{team-name}/`) with auto-dependency-unblocking
- Peer-to-peer messaging via `SendMessage` — teammates can challenge each other's findings
- Lead creates team, spawns teammates, synthesizes results
- Teammates do NOT inherit the lead's conversation history — spawn prompt must contain full context
- **Cost: ~4-7x** a single session — significantly more expensive
- Display: in-process mode (any terminal) or split-pane mode (tmux/iTerm2 only, **not Windows Terminal**)

**Used for:**
- **Competitive implementation with debate** — 2-3 agents solve the same problem, actively disprove each other
- **Multi-reviewer code review** — security + performance + test-coverage reviewers share findings
- **Competing hypothesis debugging** — agents investigate different root causes, debate like scientists
- **Cross-layer feature work** — frontend + backend + tests, each owned by a different teammate
- **Architecture decisions** — UX + architecture + devil's advocate explore a design

**Not used for:** Sequential tasks, same-file edits, simple focused work, budget-constrained workflows.

#### Tier Selection Logic

MaxsimCLI chooses the tier automatically based on the workflow:

| Workflow | Tier | Reason |
|----------|------|--------|
| Phase execution (independent tasks) | Tier 1 (Subagents) | Tasks don't need to communicate |
| Codebase scanning | Tier 1 (Subagents) | Read-only, report back |
| Research gathering | Tier 1 (Subagents) | Collect and report |
| Competitive implementation | Tier 2 (Agent Teams) | Agents need to debate |
| Multi-dimensional code review | Tier 2 (Agent Teams) | Findings need cross-checking |
| Collaborative debugging | Tier 2 (Agent Teams) | Hypotheses need adversarial testing |
| Architecture exploration | Tier 2 (Agent Teams) | Requires discussion |

**Graceful degradation:** If Agent Teams are unavailable (env var not set, unsupported plan, or feature not yet stable), MaxsimCLI falls back to Tier 1 subagents for all workflows. The user is informed but not blocked.

#### Agent Teams Architecture (Reference)

| Component | Role | Storage |
|-----------|------|---------|
| Team lead | Creates team, spawns teammates, coordinates | Main session |
| Teammates | Independent Claude Code instances | `~/.claude/teams/{team-name}/config.json` |
| Task list | Shared work items with dependency tracking | `~/.claude/tasks/{team-name}/{id}.json` |
| Mailbox | Per-agent message queues | `~/.claude/teams/{team-name}/inboxes/{name}.json` |

**Key Agent Teams constraints:**
- One team per session, no nested teams
- Lead is fixed (no promotion/transfer)
- Teammates load CLAUDE.md + MCP + skills at spawn, but NOT lead's conversation history
- 3-5 teammates recommended, 5-6 tasks per teammate
- File locking prevents race conditions on task claiming
- Avoid two teammates editing the same file (causes overwrites)

#### Agent Teams Quality Gates

Two hooks enable automatic quality enforcement:

| Hook | Fires When | Exit Code 2 Effect |
|------|-----------|-------------------|
| `TeammateIdle` | Teammate about to go idle | Keeps teammate working; stderr becomes feedback |
| `TaskCompleted` | Task being marked complete | Blocks completion; stderr becomes feedback |

**Example:** A `TaskCompleted` hook that runs `npm test` before allowing task completion — if tests fail, the teammate receives the failure output and continues fixing.

#### Competitive Implementation (Optional)

The same task can be assigned to 2–3 agents simultaneously. Each works independently. The verifier picks the best implementation. **Not enabled by default.** Activated either by user approval during planning or automatically for tasks marked as critical.

In Tier 2 mode, competitive implementation uses the Agent Teams debate pattern: agents actively try to disprove each other's approaches, and the theory/implementation that survives adversarial cross-examination wins. This fights LLM anchoring bias (first plausible answer wins).

Rationale: a single high-quality result from competitive implementation can save more tokens than multiple retry cycles.

### 7.3 Worktrees

Every executor agent works in its own git worktree. Always. No exceptions.
- Uses Claude Code's native worktree mechanism: `.claude/worktrees/agent-{id}/`
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

**Parallelism limits per profile** (scaled dynamically by project size):

| Profile | Max Agents | Typical Range |
|---------|-----------|---------------|
| quality | 40 | 20–40 |
| balanced (default) | 20 | 10–20 |
| budget | 10 | 5–10 |

Small projects (< 10 files) use fewer agents regardless of profile. The exact count is determined dynamically based on codebase size, task complexity, and profile limits.

---

## 8. Plan Mode Integration

**Every MaxsimCLI command that modifies code, GitHub state, or project configuration starts in Plan Mode.** This ensures the user always sees and approves what will happen before any changes.

**Plan Mode per command:**

| Command | Plan Mode | Reason |
|---------|-----------|--------|
| `/maxsim:go` | Yes | Proposes modifying actions |
| `/maxsim:init` | Yes | Creates GitHub resources |
| `/maxsim:plan [N]` | Yes | Creates sub-issues |
| `/maxsim:execute [N]` | Yes | Writes code |
| `/maxsim:quick [desc]` | Yes | Creates issue + code |
| `/maxsim:improve` | Yes | Modifies code autonomously |
| `/maxsim:fix-loop` | Yes | Repairs code autonomously |
| `/maxsim:debug-loop` | Yes | May modify code |
| `/maxsim:debug [desc]` | Yes | Shows debugging plan + fix approach for approval before executing fix |
| `/maxsim:settings` | Yes | Shows current config for review before writing changes |
| `/maxsim:security` | No | Read-only audit |
| `/maxsim:progress` | No | Read-only status display |
| `/maxsim:help` | No | Read-only text display |

### 8.1 Plan → Approve → Execute Flow

Follows the same pattern as Claude Code's `/batch` skill:

1. Command invoked (e.g., `/maxsim:execute`)
2. MaxsimCLI enters Plan Mode (`EnterPlanMode`) — read-only research begins
3. Explore/Research agents analyze codebase (read-only tools only)
4. Plan written to plan file, presented to user via `ExitPlanMode`
5. User reviews plan — can edit via Ctrl+G before approving
6. On approval: Plan Mode exits, execution begins with full permissions
7. On rejection: stays in Plan Mode, agent revises based on feedback

### 8.2 How Plan Mode Works Internally

Plan Mode is **prompt-based, not tool-enforcement-based**. A `<system-reminder>` is injected that instructs Claude not to use write/execute tools. The restricted tools (Write, Edit, Bash) remain technically callable — enforcement relies on the LLM following instructions.

**Only `ExitPlanMode` has real UI enforcement** — it requires an actual user approval dialog before returning.

**Tools available in Plan Mode:**
- Full read access: Read, Glob, Grep, LS, WebSearch, WebFetch
- Task management: TodoRead, TodoWrite
- User interaction: AskUserQuestion (for clarifying requirements, NOT for plan approval)
- Subagent spawning: Explore agents (read-only)
- Plan file: Write/Edit allowed ONLY for the plan file

### 8.3 Two Plan Mode Mechanisms

| Mechanism | `permissionMode: plan` | `EnterPlanMode` tool |
|-----------|----------------------|---------------------|
| Set by | Frontmatter / CLI flag / SDK | The agent itself, mid-session |
| Scope | Entire session from start | From the point the tool is called |
| User consent | No — imposed by configuration | Yes — requires user approval |
| Use case | Planner agent definition | MaxsimCLI workflow commands |

**Planner agent** has `permissionMode: plan` in its frontmatter — enforcing read-only operation for the entire agent session. This is used when MaxsimCLI spawns a dedicated Planner subagent.

**Workflow commands** use `EnterPlanMode` / `ExitPlanMode` dynamically — the main session enters plan mode, researches, presents the plan, gets approval, then exits plan mode and executes.

---

## 9. Skills

MaxsimCLI ships with **15 skills**, following Anthropic's skill conventions exactly.

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
| 7 | `maxsim-batch` | Technique | Parallel execution orchestration — Tier 1 (subagent batch) + Tier 2 (Agent Teams) selection |
| 8 | `code-review` | Technique | Security, quality, spec-compliance review |
| 9 | `verification` | Infrastructure | **MERGED** from: verification-before-completion + evidence-collection + verification-gates. Single authoritative verification skill with gate framework, evidence blocks, anti-rationalization enforcement. |
| 10 | `github-operations` | Infrastructure | **MERGED** from: github-artifact-protocol + github-tools-guide. Unified GitHub interaction: artifact types, comment conventions, CLI commands, lifecycle state machine. |
| 11 | `research` | Technique | **MERGED** from: research-methodology + tool-priority-guide. Systematic investigation with source hierarchy and Claude Code tool priority. |
| 12 | `project-memory` | Infrastructure | **NEW** — GitHub-native persistence for project learnings, decisions, and patterns. |
| 13 | `using-maxsim` | User-facing | Command reference and routing table. Updated for v6 commands. |
| 14 | `maxsim-simplify` | Technique | Code simplification, dead code removal, reuse improvement. |
| 15 | `autoresearch` | Technique | Autonomous optimization loop with reference workflows (loop-protocol, debug, fix, security, results-logging, core-principles). Powers `/maxsim:improve`, `/maxsim:fix-loop`, `/maxsim:debug-loop`, `/maxsim:security`. |

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

> **Implementation status:** Currently instruction-based (enforced via skill/rule prompts). Code-level enforcement of fresh agent spawning per retry is planned.

### 10.4 Guard Pattern

Borrowed from autoresearch:
- **Verify command** — "Did this task accomplish its goal?" (primary metric)
- **Guard command** — "Did this task break what was already working?" (regression check)
- If guard fails after verify passes: 2 rework attempts before discarding

> **Implementation status:** Currently instruction-based (enforced via verification skill). Code-level enforcement of the VERIFY+GUARD dual-command pattern is planned.

---

## 11. Self-Improvement

> Research completed 2026-03-24. Full findings: `docs/spec/self-improvement-research.md`
> Sources analyzed: autoresearch (1,900 stars, v1.8.2), Superpowers (v4.3.1), 40+ academic/community sources

### 11.1 Philosophy

MaxsimCLI improves locally per project with every session through three layers: **Session Memory** (automatic), **Metric Tracking** (per task/phase), and an optional **Optimization Loop** (on-demand). Inspired by autoresearch's "constraint + mechanical metric + autonomous iteration = compounding gains" and Superpowers' anti-rationalization enforcement.

**Core principles** (adapted from autoresearch's 7 universal principles):
1. **Mechanical verification only** — no subjective "looks good"; every keep/discard uses a number
2. **One atomic change per iteration** — precise causality; if it breaks, the cause is unambiguous
3. **Git as memory** — `git revert` (not `git reset --hard`) preserves failed experiments for learning
4. **Automatic rollback** — failure has no permanent cost; every change reverts instantly
5. **External enforcement** — the system guarantees termination, not the agent's self-awareness
6. **Evidence before claims** — no completion without fresh verification (Superpowers Iron Law)

### 11.2 Three-Layer Architecture

| Layer | Mechanism | Frequency | What It Does |
|-------|-----------|-----------|-------------|
| **Session Memory** | Stop + SessionStart hooks → MEMORY.md | Every session | Captures learnings, injects context at start |
| **Metric Tracking** | TSV logging after each task/phase | Every task execution | Tracks what worked/failed with numbers |
| **Optimization Loop** | `/maxsim:improve` command | On-demand | Runs autoresearch-style iteration loop |

### 11.3 Layer 1 — Session Memory

**Stop hook** (`maxsim-capture-learnings`): Fires at session end. Must be improved to:
- Track only THIS session's commits (diff `session_start_commit..HEAD`, not last 5 all-time)
- Extract patterns from `last_assistant_message` (available in Stop payload)
- Prune MEMORY.md to stay under 180 lines (hard 200-line limit in Claude Code)
- Use `stop_reason` to differentiate clean exits from crashes
- Check `stop_hook_active` to prevent infinite blocking loops
- Write structured entries: date, session_id, commit_count, patterns, stop_reason

**SessionStart hook** (`maxsim-session-start`, NEW): Fires at session start/resume/compact. Injects context:
- Read `git log --oneline -20` (instant orientation)
- Read first 200 lines of MEMORY.md (learned patterns)
- Read last 10 TSV entries (metric trends, if file exists)
- Output via `hookSpecificOutput.additionalContext` for injection into Claude's context

**Storage:** `.claude/agent-memory/maxsim-learner/MEMORY.md` (gitignored, machine-local)

### 11.4 Layer 2 — Metric Tracking

**TSV format** (adopted from autoresearch, 7 columns):

```tsv
# metric_direction: lower_is_better
iteration	commit	metric	delta	guard	status	description
0	abc1234	847	0	-	baseline	Initial measurement
1	def5678	831	-16	pass	keep	Reduce verification timeout
2	-	852	+5	-	discard	Add parallel workers (reverted)
3	ghi9012	-	-	-	crash	Refactor config (syntax error, fixed)
```

| Column | Description |
|--------|-------------|
| `iteration` | Sequential counter (0 = baseline) |
| `commit` | Git hash or `-` if reverted |
| `metric` | Measured numeric value |
| `delta` | Change from previous best |
| `guard` | `pass` / `fail` / `-` (no guard) |
| `status` | `baseline` / `keep` / `discard` / `crash` / `hook-blocked` |
| `description` | One-sentence experiment description |

**Path:** `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv` (gitignored)

**When written:** After each task in `/maxsim:execute`, after each phase verification, after each `/maxsim:improve` iteration.

### 11.5 Layer 3 — Optimization Loop

`/maxsim:improve` runs the autoresearch 8-phase loop. The full autoresearch skill is included in `templates/skills/autoresearch/` with all reference workflows.

1. **Review** — read git log + TSV + diff
2. **Ideate** — exploit successes, avoid repeated failures, try untried approaches
3. **Modify** — make ONE atomic change
4. **Commit** — commit before verify (`experiment(<scope>):` prefix)
5. **Verify** — run metric command, extract number
6. **Guard** — run regression check (e.g., `npm test`)
7. **Decide** — improved + guard pass → keep; otherwise → `git revert`
8. **Log** — append to TSV, check stuck condition, repeat

**Verify + Guard dual-command pattern:**
- **Verify:** "Did the metric improve?" (primary goal)
- **Guard:** "Did anything else break?" (regression safety net)
- Guard failure + verify pass → rework (max 2 attempts), then discard
- Guard/test files are NEVER modified by the loop

**Stuck detection:** After 5 consecutive discards/crashes:
1. Re-read ALL in-scope files (full context reload)
2. Re-read original goal
3. Review entire TSV log for patterns
4. Try combining 2-3 successful past changes
5. Try the OPPOSITE approach
6. Try a radical architectural change
7. If still stuck → create diagnostic GitHub Issue + escalate to user

**Noise handling** for volatile metrics: 3-run median for 1-5% variance, 5-run median for >5%, minimum-delta threshold to filter noise.

**Note:** Claude Code's built-in `/loop` command exists for scheduled recurring prompts but is not used by MaxsimCLI — it has no memory between cycles and is session-scoped (max 3 days). `/maxsim:improve` uses its own internal loop with git-based memory and TSV tracking.

### 11.6 Quality Enforcement (from Superpowers)

Adopted from Superpowers' anti-rationalization philosophy:

- **Evidence Blocks** required for all completion claims: `CLAIM / EVIDENCE / OUTPUT / VERDICT`
- **10 forbidden phrases** in verification: "should work", "I already checked", "tests were passing before", etc.
- **`<HARD-GATE>` tags** in agent prompts for non-negotiable rules
- **Two-stage review** (optional): Spec Compliance → Code Quality, each by a fresh subagent
- **Iron Law:** No completion claims without fresh verification evidence from this session

### 11.7 Code Enforcement via Hooks

| Hook | Event | Purpose | Exit Code 2 Effect |
|------|-------|---------|-------------------|
| `maxsim-capture-learnings` | Stop | Write session learnings to MEMORY.md | N/A (always exit 0) |
| `maxsim-session-start` | SessionStart | Inject MEMORY.md + TSV + git log context | N/A (context injection) |
| `maxsim-task-completed` | TaskCompleted | Run tests before allowing task completion | Blocks completion, feeds back failure |
| `maxsim-teammate-idle` | TeammateIdle | Check for pending tasks before allowing idle | Keeps teammate working |

### 11.8 Isolation

All improvements are project-local. Two projects using MaxsimCLI never interfere:
- Separate `.claude/agent-memory/maxsim-learner/` per project
- Separate `autoresearch-results.tsv` per project
- Separate Claude Code auto-memory (keyed by git repo root)
- MEMORY.md hard-limited to 200 lines (Claude Code constraint)

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

> Research completed 2026-03-24. Official docs: https://code.claude.com/docs/en/hooks

These hooks fire only when Agent Teams are active (Tier 2 workflows). Neither hook supports matchers — they fire for every occurrence.

| Hook | Event | Fires When | Payload Fields |
|------|-------|-----------|---------------|
| `maxsim-teammate-idle` | `TeammateIdle` | Teammate about to go idle | `teammate_name`, `team_name`, `session_id`, `cwd` |
| `maxsim-task-completed` | `TaskCompleted` | Task being marked complete | `task_id`, `task_subject`, `task_description`, `teammate_name`, `team_name` |

**Exit code behavior (both hooks):**
- `exit 0` — allow the action (teammate goes idle / task marked complete)
- `exit 2` — block the action; stderr is fed back to the teammate as instruction
- JSON `{"continue": false, "stopReason": "..."}` — stop the teammate entirely

**MaxsimCLI implementation:**
- `maxsim-teammate-idle`: Checks if pending tasks remain on the shared task list. If yes, exits 2 with "Pick up the next available task."
- `maxsim-task-completed`: Runs verification (tests, build, lint). If any gate fails, exits 2 with the failure output. The teammate continues fixing until gates pass.

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
- Co-author attribution: configurable via `co_author` config key (default: `Co-Authored-By: Claude <noreply@anthropic.com>`)
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
│   │   │   ├── core/     # Core logic (config, types, utilities)
│   │   │   ├── github/   # GitHub API integration (Projects v2, Issues, etc.)
│   │   │   ├── hooks/    # Hook scripts
│   │   │   └── install/  # Install/uninstall logic
│   │   └── tests/        # Unit + E2E tests (TDD)
│   └── website/          # Landing page + documentation (React + Vite)
├── templates/            # Source templates (copied to .claude/ during install)
│   ├── agents/           # 4 agent definitions + AGENTS.md registry
│   ├── commands/maxsim/  # 13 slash commands
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
| Releases | semantic-release (single source of truth for versioning — version injected into code at build time) |
| Website | React + Vite + Tailwind CSS + Motion |
| Documentation | Markdoc |

### 15.3 Testing Strategy

**TDD for everything.** Tests before code.

| Level | Coverage |
|-------|----------|
| Unit tests | Core logic, GitHub API, config, state, phases |
| Integration tests | Install/uninstall flow, hook registration |
| E2E tests | Full user flow: install → init → plan → execute. **Runs against real GitHub API** with a dedicated test account/token in CI secrets. |

---

## 16. Website

`maxsimcli.dev` serves two purposes:

1. **Landing Page** — Marketing: features, benefits, installation instructions, tech stack showcase
2. **Full Documentation** — All commands, workflows, skills, configuration, and guides

> **Note:** The current 33 documentation articles are outdated (reference v5 concepts like `.planning/` directory, `/maxsim:milestone`, `/maxsim:todos`). **All documentation must be completely rewritten** to reflect the v6 spec. Only features that exist in this spec should be documented.

---

## 17. What MaxsimCLI is NOT

- **Not a fork** of GSD or Superpowers — it is an independent project inspired by both
- **Not multi-runtime** — it only works with Claude Code
- **Not global** — it installs per-project into `.claude/`, not globally. Any global `~/.claude/maxsim/` installation is a developer's personal setup, not part of the product.
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
3. src/cli.ts — CLI entry point (maxsim-tools.cjs) — lives at src/ root, not src/core/
4. src/core/utils.ts — Shared utilities (path construction, frontmatter parsing)
5. src/core/version.ts — Version detection utilities
5. Tests: unit tests for every exported function
```
**Commit:** `feat: core types and config module`

### Phase 2: GitHub Module (THE critical module)
**Goal:** Correct GitHub Projects v2 integration from scratch.
**Spec:** `docs/spec/github-projects-v2-api.md`, `docs/spec/github-structure-design.md`
```
1. src/github/client.ts — Octokit setup, auth, error handling ✅
2. src/github/projects.ts — Projects v2 (GraphQL + REST, CORRECT APIs) ✅
3. src/github/issues.ts — Issues + Sub-Issues (correct ID types) ✅
4. src/github/milestones.ts — Milestones (with pagination) ✅
5. src/github/labels.ts — Label taxonomy (6 labels in 2 namespaces: type + maxsim) ✅ [UPDATE CODE: reduce from 19 to 6]
6. src/github/comments.ts — Structured comments (HTML markers) ✅
7. src/github/types.ts — GitHub-specific types ✅
8. Tests: unit tests with mocked Octokit, E2E with real API
REMOVED: mapping.ts (local cache contradicts GitHub-only principle)
REMOVED: sync.ts (no sync needed — GitHub is always authoritative)
REMOVED: commands.ts (functionality covered by client.ts + individual modules)
```
**Commit:** `feat: GitHub Projects v2 integration (correct API)`

### Phase 3: Install System
**Goal:** npx maxsimcli@latest works correctly.
**Spec:** PROJECT.md §5.2, `docs/spec/claude-md-guide.md`
```
1. src/install/index.ts — Main installer orchestrator ✅
2. src/install/copy.ts — Template file copying (with path replacement) ✅
3. src/install/hooks.ts — Hook registration in settings.json ✅
4. src/install/uninstall.ts — Clean uninstall (complete!) ✅
5. src/install/claudemd.ts — CLAUDE.md generation ✅ (added, not in original spec)
6. src/install/manifest.ts — Track all installed files ⬚ not yet implemented (useful for clean uninstall)
7. scripts/copy-assets.cjs — Build step: copy templates to dist ✅
8. Tests: E2E install/uninstall cycle
```
**Commit:** `feat: install system with complete uninstall`

### Phase 4: Commands + Workflows
**Goal:** 13 slash commands with correct tool names and GitHub-first workflows.
**Spec:** PROJECT.md §6, `docs/spec/init-process-design.md`, `docs/spec/wave-execution-design.md`
```
1. templates/commands/maxsim/ — All 13 commands (correct frontmatter)
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

### Phase 5: Skills (15 total)
**Goal:** 15 skills following Anthropic conventions exactly.
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
**Goal:** Three-layer self-improvement system (Session Memory + Metric Tracking + Optimization Loop).
**Spec:** `docs/spec/self-improvement-guide.md`, `docs/spec/memory-system-guide.md`
**Research:** Completed 2026-03-24. Findings: `docs/spec/self-improvement-research.md`
```
P0 — Session Memory:
1. Rewrite maxsim-capture-learnings Stop hook (per-session commits, pattern extraction, pruning)
2. New maxsim-session-start SessionStart hook (MEMORY.md + TSV + git log injection)
3. Stop hook already captures learnings to MEMORY.md ✅ (needs improvement)

P1 — Metric Tracking:
4. TSV logging in execute workflow (7-column autoresearch format)
5. TaskCompleted hook for test-gate enforcement
6. Verify + Guard dual-command pattern in verification workflow

P2 — Quality & Detection:
7. Stuck detection (5 consecutive failures → 6-step escalation)
8. Iron Laws + Anti-Rationalization tables in agent prompts (from Superpowers)
9. <HARD-GATE> tags for non-negotiable verification rules

P3 — Optimization Loop:
10. /maxsim:improve command (optional autoresearch-style loop)
11. Plan wizard for /maxsim:improve setup
12. Noise handling for volatile metrics (median, min-delta)
```
**Commit:** `feat: self-improvement system (autoresearch + superpowers adapted)`

### Phase 9: Documentation & Website
**Goal:** All docs match the new v6 implementation.
**Spec:** All docs/spec/ documents
```
1. Rewrite USER-GUIDE.md for v6
2. Rewrite INTERNALS.md for v6
3. Update README.md
4. COMPLETELY REWRITE all 33 website documentation articles for v6
   - Remove references to .planning/, /maxsim:milestone, /maxsim:todos, dashboard
   - Only document features that exist in this spec
5. Fix CONTRIBUTING.md (correct lint command, etc.)
6. Update GitHub issue templates
7. Update global CLAUDE.md template
9. Verify all docs match actual code
```
**Commit:** `docs: complete documentation for v6`

### Release
```
1. semantic-release handles versioning (6.0.0 via breaking change commit)
2. CHANGELOG.md auto-updated by semantic-release
3. npm publish (automated via CI)
4. Deploy website (automated via GitHub Pages workflow)
5. Announce
```

> **Version strategy:** semantic-release is the single source of truth for versioning. The version in `core/types.ts`, `core/version.ts`, and `templates/templates/config.json` must be injected at build time from `packages/cli/package.json`. No hardcoded version strings.

---

## 20. Deep-Dive Specifications

Each section above has a corresponding deep-dive document in `docs/spec/` with full technical details, API references, and implementation guidance.

| # | Topic | Document | Lines | Key Content |
|---|-------|----------|-------|-------------|
| 1 | GitHub Projects v2 API | [`github-projects-v2-api.md`](docs/spec/github-projects-v2-api.md) | 2,374 | Complete REST + GraphQL + gh CLI reference, Sub-Issues API, authentication, pagination |
| 2 | GitHub Issue Structure | [`github-structure-design.md`](docs/spec/github-structure-design.md) | 1,855 | Board design, issue hierarchy, **6 labels in 2 namespaces** (update from 16/4), 9 comment types, IssueOps, GitHub Actions |
| 3 | Agent Teams Guide | [`agent-teams-guide.md`](docs/spec/agent-teams-guide.md) | 1,283 | TeamCreate, SendMessage, TeammateIdle/TaskCompleted hooks, 6 coordination patterns |
| 3b | Agent Teams Research | [`agent-teams-research.md`](docs/spec/agent-teams-research.md) | ~400 | **NEW** — Consolidated research (20 parallel agents, 2026-03-24): hybrid architecture decision, cost analysis, patterns catalog, community findings |
| 4 | Plan Mode Guide | [`plan-mode-guide.md`](docs/spec/plan-mode-guide.md) | 1,090 | EnterPlanMode/ExitPlanMode mechanics, permissionMode:plan, tool restrictions |
| 5 | Skills Writing Guide | [`skills-writing-guide.md`](docs/spec/skills-writing-guide.md) | 1,480 | Anthropic skill conventions, frontmatter spec, CSO rules, 12 anti-patterns |
| 6 | Skills Specification | [`skills-specification.md`](docs/spec/skills-specification.md) | 985 | All 14 target skills: name, description, structure, agent preloads |
| 7 | Memory System Guide | [`memory-system-guide.md`](docs/spec/memory-system-guide.md) | 1,340 | CLAUDE.md, auto memory, MEMORY.md, subagent memory, feedback loops |
| 8 | CLAUDE.md Guide | [`claude-md-guide.md`](docs/spec/claude-md-guide.md) | 961 | Best practices, template, 200-line limit, path-scoped rules |
| 9 | Self-Improvement Guide | [`self-improvement-guide.md`](docs/spec/self-improvement-guide.md) | 1,151 | autoresearch adaptation, 8-phase loop, Verify+Guard, Git-as-Memory |
| 9b | Self-Improvement Research | [`self-improvement-research.md`](docs/spec/self-improvement-research.md) | ~350 | **NEW** — Consolidated research (21 agents, 2026-03-24): 3-layer architecture, autoresearch + Superpowers analysis |
| 10 | Parallel Execution Guide | [`parallel-execution-guide.md`](docs/spec/parallel-execution-guide.md) | 1,043 | Agent tool parameters, batch pattern, worktree isolation, token costs |
| 11 | Wave Execution Design | [`wave-execution-design.md`](docs/spec/wave-execution-design.md) | 848 | Dependency analysis, Kahn's algorithm, adaptive waves, error recovery |
| 12 | Competitive Implementation | [`competitive-implementation-design.md`](docs/spec/competitive-implementation-design.md) | 1,136 | Best-of-N sampling, 7 scoring criteria, prompt variation, hybrid strategy. **Now optional**, not default. |
| 13 | Verification System | [`verification-system-design.md`](docs/spec/verification-system-design.md) | 1,432 | Gate framework, evidence blocks, anti-rationalization, Guard pattern |
| 14 | Init Process Design | [`init-process-design.md`](docs/spec/init-process-design.md) | 1,301 | 5-phase init, profile-based agent count (not fixed 30+), adaptive interview, GitHub setup |
| 15 | Hooks Reference | [`hooks-reference.md`](docs/spec/hooks-reference.md) | 2,319 | All 22 hook events, settings.json format, 4 handler types, 12 gotchas |
| 16 | Git Worktree Strategy | [`git-worktree-strategy.md`](docs/spec/git-worktree-strategy.md) | 2,007 | Worktree lifecycle, merge strategies, conflict resolution, cleanup |
| 17 | Claude Code SDK Guide | [`claude-code-sdk-guide.md`](docs/spec/claude-code-sdk-guide.md) | 1,331 | Claude Agent SDK, headless mode, programmatic sessions, @maxsim/sdk |

**Total specification volume: ~23,936 lines across 17 documents.**

---

*This document is the authoritative specification for MaxsimCLI. All code, templates, documentation, and workflows must conform to what is defined here. The deep-dive documents in `docs/spec/` provide the technical details for implementation. When in doubt, this document wins.*
