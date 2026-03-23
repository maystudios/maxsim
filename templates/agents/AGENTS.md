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
  agent: "executor",
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
| Status | `complete`, `blocked`, or `partial` with explanation |
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

All skills use `user-invocable: false` -- agents auto-invoke them based on description matching, not explicit user commands.

## Planner Read-Only Enforcement

The `planner` agent runs with `permissionMode: plan`. This enforces read-only access to the filesystem -- the planner can analyze the codebase and write plan files, but cannot execute commands that modify source files or run builds. This prevents the planner from accidentally beginning execution during the planning phase.
