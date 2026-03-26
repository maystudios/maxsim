---
id: workflows-reference
title: Workflows Reference
group: Advanced
---

Workflows are the orchestration layer of MaxsimCLI. Each workflow is a structured prompt file in `.claude/maxsim/workflows/` that defines a multi-step process: which agents to dispatch, in what order, what state to read and write, and how to handle errors and user confirmations.

### How workflows run

When you type a slash command like `/maxsim:plan`, Claude Code loads the corresponding workflow file (`workflows/plan.md`). The workflow prompt guides the AI through a sequence of steps, dispatching subagents, reading GitHub state, and writing results back. Workflows are not executable code -- they are structured instructions that the AI follows.

### Core workflows

These workflows power the main MaxsimCLI commands that most users interact with daily.

#### `/maxsim:go` -- Auto-dispatch (go.md)

Reads the GitHub Project Board to detect current project state, then dispatches to the appropriate workflow. If a phase needs planning, it routes to the plan workflow. If a phase has plans ready, it routes to execution. If gaps exist, it routes to gap closure. This is the recommended starting point for any session.

#### `/maxsim:init` -- Initialization router (init.md)

A thin router that detects whether the project is new, existing, or already initialized, then delegates to one of three sub-workflows:

{% doctable headers=["Sub-workflow", "File", "Trigger Condition"] rows=[["New project", "new-project.md", "No existing code, empty or no GitHub repo"], ["Existing project", "init-existing.md", "Existing codebase detected without MaxsimCLI structure"], ["New milestone", "new-milestone.md", "MaxsimCLI already initialized"]] %}
{% /doctable %}

**new-project.md** runs a five-phase setup: prerequisites gate, user interview, project research (with web search), GitHub structure creation (repo, labels, Project Board), and roadmap generation (Milestones and Phase Issues).

**init-existing.md** dispatches parallel codebase-mapper agents that analyze different areas of the codebase (data models, APIs, frontend, infrastructure, testing). Findings are synthesized and stored in the GitHub Wiki and agent memory.

**new-milestone.md** gathers milestone details from the user and creates a GitHub Milestone with linked Phase Issues on the Project Board.

#### `/maxsim:plan` -- Planning orchestrator (plan.md)

A state machine that detects the current planning stage from GitHub Issue comment markers and delegates to three sub-workflows in sequence:

{% doctable headers=["Stage", "Sub-workflow", "Marker", "What Happens"] rows=[["Discussion", "plan-discuss.md", "<!-- maxsim:type=context -->", "Adaptive questioning to capture decisions. Posts context as a GitHub Issue comment."], ["Research", "plan-research.md", "<!-- maxsim:type=research -->", "Spawns 5-10 parallel researcher agents. Each investigates a different aspect of the phase. Posts consolidated findings."], ["Planning", "plan-create.md", "<!-- maxsim:type=plan -->", "Creates task breakdown with wave assignments, type annotations, and acceptance criteria. Optionally runs plan-checker for validation."]] %}
{% /doctable %}

Each stage has its own Plan Mode approval gate. The user must approve before the workflow advances to the next stage. Re-entering `/maxsim:plan` on an already-planned phase shows current status and offers to view, re-plan, or proceed to execution.

#### `/maxsim:execute` -- Execution engine (execute.md)

The most complex workflow. It reads task sub-Issues from the GitHub phase Issue, groups them by wave (from plan frontmatter), and runs each wave's tasks in parallel using isolated worktrees.

{% codeblock language="text" %}
1. Initialize — resolve models, load phase state from GitHub
2. Load inventory — fetch phase Issue, sub-Issues, parse plan comments
3. Plan Mode gate — present execution plan, wait for user approval
4. Wave execution — for each wave, spawn parallel executor agents
5. Post-execution — run verify-phase workflow automatically
6. Gap handling — if verification fails, create gap-closure phase Issues
{% /codeblock %}

Each executor agent runs in its own git worktree with the `execute-plan.md` template. The template defines what context the executor receives (plan, phase Issue, config) and what output it must produce (commits, Issue comments, progress updates).

#### `/maxsim:execute` -- Verification (verify-phase.md)

Spawned automatically after execution completes. Checks the codebase against the phase success criteria using parallel reviewer agents:

{% doctable headers=["Check", "What It Verifies"] rows=[["Tests pass", "All test suites exit 0"], ["Build succeeds", "Production build completes without errors"], ["Lint clean", "No lint errors"], ["Spec compliance", "All deliverables from the phase Issue are implemented"], ["Code review", "No blocking issues found by reviewer agents"], ["Evidence block", "Structured CLAIM/EVIDENCE/OUTPUT/VERDICT posted as Issue comment"]] %}
{% /doctable %}

### Utility workflows

#### `/maxsim:quick` (quick.md)

Simplified task flow for ad-hoc work. Creates a GitHub Issue, spawns a lightweight planner and executor, commits, and closes the Issue. Skips research, plan-checker, and verifier.

#### `/maxsim:debug` (debug.md)

Structured debugging using a reproduce-hypothesize-isolate-verify-fix-confirm cycle. Persists state to a GitHub Issue after each step. Supports hierarchical debugging for multi-layer bugs.

#### `/maxsim:progress` (progress.md)

Queries the GitHub Project Board and Milestones API. Displays phase status, task counts, milestone progress, and open blockers. Recommends the next action based on board state.

#### `/maxsim:settings` (settings.md)

Interactive configuration viewer and editor. Reads and writes `.claude/maxsim/config.json`. Supports model profile switching, workflow toggle changes, and parallelism configuration.

#### `/maxsim:help` (help.md)

Displays the full command reference with descriptions, syntax, and examples. Output-only workflow with no state changes.

#### Health check (health.md)

Internal workflow that verifies MaxsimCLI installation integrity and GitHub connectivity. Checks for required files, `gh` CLI authentication, and git repository status.

### Workflow extensibility

Workflows are plain markdown files. To customize a workflow, copy the built-in file from `.claude/maxsim/workflows/` and modify it. Custom workflows with the same filename override the built-in version on the next command invocation.

{% callout type="note" %}
Workflows coordinate agents but do not execute code themselves. All code execution happens inside agent sessions. The workflow's job is to dispatch the right agents in the right order with the right context.
{% /callout %}
