# AGENTS.md -- Agent Registry

This document is a reference for orchestrators. It describes the 4 agent types available in MaxsimCLI v6, how to spawn them, and how they communicate.

## Agent Overview

| Agent | Role | Tools | Preloaded Skills |
|-------|------|-------|-----------------|
| `executor` | Implements plans with atomic commits, test verification, and deviation handling | Read, Write, Edit, Bash, Grep, Glob | handoff-contract, commit-conventions |
| `planner` | Creates detailed plans with task breakdowns, wave assignments, and dependency graphs | Read, Write, Bash, Grep, Glob | handoff-contract, roadmap-writing |
| `researcher` | Investigates codebase patterns, evaluates technologies, and gathers information with confidence levels | Read, Bash, Grep, Glob, WebFetch, WebSearch | handoff-contract, research |
| `verifier` | Reviews completed work for correctness, quality, security, and spec compliance with evidence-based verification | Read, Bash, Grep, Glob | handoff-contract, verification, code-review |

## Model Profiles

Config `model_profile` (quality/balanced/budget) sets baseline model per agent type. Orchestrators can override per-spawn for complex tasks.

| Agent | quality | balanced | budget |
|-------|---------|----------|--------|
| executor | opus | sonnet | sonnet |
| planner | opus | opus | sonnet |
| researcher | sonnet | sonnet | haiku |
| verifier | opus | sonnet | sonnet |

All agents use `model: inherit` in their frontmatter, meaning they run on the session model unless the orchestrator specifies an explicit model at spawn time.

## Spawn Format

Orchestrators use the `Agent` tool to spawn agents. Pass a structured natural-language prompt:

```markdown
## Task
[What the agent should do -- specific, actionable, scoped]

## Context
[Phase name, plan reference, prior work summary, relevant constraints]

## Files to Read
- [absolute paths the agent should load before starting]

## Suggested Skills
- [on-demand skills the orchestrator recommends the agent invoke]

## Success Criteria
- [measurable criteria the agent must verify before returning]
```

**Spawn example (executor):**

```
Agent(
  subagent_type: "executor",
  prompt: "## Task\nImplement the authentication middleware...\n\n## Context\n..."
)
```

## Communication

Agents do not communicate directly with each other. All inter-agent communication is mediated by the orchestrator:

- Agents return results via the **handoff contract** (see below)
- The orchestrator reads the handoff result and decides next steps
- The orchestrator passes prior agent output to subsequent agents in the spawn prompt
- Use Agent Teams (multi-agent orchestration) when parallel agent execution is needed

## Handoff Contract

Every agent return MUST include these sections, enforced by the `handoff-contract` skill:

| Section | Content |
|---------|---------|
| Key Decisions | Decisions made during execution that affect downstream agents |
| Artifacts | Files created or modified (absolute paths) |
| Status | `PASS`, `FAIL`, or `PARTIAL` with explanation |
| Deferred Items | Work discovered but not implemented, categorized by type |

Agents load this format via the `handoff-contract` preloaded skill. Orchestrators parse these sections to determine board transitions, next agent spawns, and GitHub comment posting.

## Available Skills (On-Demand)

Agents can invoke these skills when their trigger condition is met:

| Skill | Trigger |
|-------|---------|
| github-operations | When reading from or writing to GitHub Issues |
| tdd | When implementing features with a test-first approach (executor) |
| brainstorming | When exploring multiple implementation approaches (planner) |
| systematic-debugging | When investigating test failures or unexpected behavior (verifier) |
| project-memory       | When persisting or reading learned patterns and decisions            |
| using-maxsim         | When providing MaxsimCLI command guidance to the user               |
| maxsim-simplify      | When reducing complexity or removing dead code                       |
| autoresearch         | When running autonomous optimization, error repair, or debug loops   |

All skills use `user-invocable: false` -- agents auto-invoke them based on description matching, not explicit user commands.

## Planner Read-Only Enforcement

The `planner` agent runs with `permissionMode: plan`. This enforces read-only access to the filesystem -- the planner can analyze the codebase and return plan content, but cannot execute commands that modify source files or run builds. This prevents the planner from accidentally beginning execution during the planning phase.

## Session Start Enrichment

The `maxsim-session-start` hook (SessionStart event) injects orientation context at the beginning of every session. All signals are best-effort -- if any signal fails to resolve, it is silently skipped and never blocks session start.

| Signal | Source | Description |
|--------|--------|-------------|
| Recent git history | `git log --oneline -20` | Last 20 commits for instant orientation on recent work |
| Learned patterns | `.claude/agent-memory/maxsim-learner/MEMORY.md` (first 200 lines) | Persistent learnings from previous sessions |
| Metric trends | `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv` (last 10 lines) | Recent autoresearch metric measurements |
| Context freshness | `git log -1 --format=%ct` on current branch | Warns when last commit is older than 7 days |
| Memory size | `MEMORY.md` file size check | Warns when MEMORY.md exceeds 50 KB |
| CI/CD status | `gh run list --limit 3 --json status,conclusion,name` | Detects failing CI workflows (P0 priority) |
| Proactive suggestions | Metric trend analysis (3+ consecutive declines) | Suggests `/maxsim:improve` for regressing metrics |

All signals are injected as `additionalContext` in the hook output. The CI/CD status section appears first when failures are detected (highest priority). Context freshness and proactive suggestions appear after the standard sections.

## Tier 2 -- Agent Teams

When `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set and Claude Code supports it, MaxsimCLI can use multi-agent orchestration via Agent Teams.

### Activation

Tier 2 activates when:
1. Environment variable `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set to `1`
2. A `TeamCreate` probe succeeds (feature is available in the runtime)

If either condition fails, all workflows gracefully degrade to Tier 1 (subagents via the `Agent` tool).

### Communication

Teams coordinate exclusively through:
- **Task lists** — `.claude/tasks/{team-name}/` for pending work
- **GitHub Issues** — Phase tracking, task sub-issues, plan comments
- **Handoff contracts** — Structured output posted as GitHub Issue comments
- **SendMessage** — Direct inter-agent messages within the same team

### Hooks

Two hooks support Tier 2 operations:
- `maxsim-teammate-idle` (TeammateIdle) — Checks for pending tasks and assigns idle teammates
- `maxsim-task-completed` (TaskCompleted) — Runs verification gates (test, build, lint) before allowing task completion

### Architecture

| Component | Role | Storage |
|-----------|------|---------|
| Team lead | Creates team, spawns teammates, coordinates | Main session |
| Teammates | Independent Claude Code instances | `~/.claude/teams/{team-name}/config.json` |
| Task list | Shared work items with dependency tracking | `~/.claude/tasks/{team-name}/{id}.json` |
| Mailbox | Per-agent message queues | `~/.claude/teams/{team-name}/inboxes/{name}.json` |

### Key Constraints

- One team per session, no nested teams
- Lead is fixed (no promotion/transfer)
- Teammates load CLAUDE.md + MCP + skills at spawn, but NOT lead's conversation history
- 3-5 teammates recommended, 5-6 tasks per teammate
- File locking prevents race conditions on task claiming
- Avoid two teammates editing the same file (causes overwrites)
