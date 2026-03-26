---
id: agents-reference
title: Agent Reference
group: Agents
---

MaxsimCLI uses four agent types. Each agent is a markdown prompt file in `.claude/agents/` that receives a handoff contract, performs focused work, and returns structured output to the orchestrator.

### Agent table

{% doctable headers=["Agent", "Role", "Preloaded Skills", "Typical Model"] rows=[["executor", "Implements code changes according to the phase plan", "commit-conventions, verification, handoff-contract", "sonnet (balanced), opus (quality)"], ["planner", "Creates detailed phase plans from research findings", "brainstorming, roadmap-writing, handoff-contract", "opus (balanced and quality)"], ["researcher", "Investigates codebase and gathers context for planning", "research, handoff-contract", "sonnet (balanced), haiku (budget)"], ["verifier", "Reviews completed work against spec and quality gates", "code-review, verification, handoff-contract", "sonnet (balanced), opus (quality)"]] %}
{% /doctable %}

### Executor

The executor is the most frequently dispatched agent. It receives a plan comment from a GitHub Issue, implements each task in the plan, commits atomically after each task, and posts progress updates as GitHub Issue comments. Executors follow four deviation rules: auto-fix bugs (Rule 1), auto-add missing critical functionality (Rule 2), auto-fix blockers (Rule 3), and stop for architectural decisions (Rule 4). Multiple executors run in parallel during wave-based execution, each in its own git worktree.

### Planner

The planner consumes discussion context and research findings, then produces a task breakdown with wave assignments, type annotations, acceptance criteria, and dependency declarations. A plan-checker agent (also using the planner prompt) optionally reviews the plan before it is finalized. Plans are posted as GitHub Issue comments with structured frontmatter.

### Researcher

The researcher investigates the codebase, dependencies, and technical landscape relevant to a phase. It reads existing code, identifies patterns and conventions, evaluates library options, and produces findings as a GitHub Issue comment. Multiple researcher agents can run in parallel, each covering a different aspect of the phase (data models, APIs, frontend, infrastructure).

### Verifier

The verifier runs after execution completes. It checks each deliverable against the original success criteria from the phase GitHub Issue. Checks include test suite pass, build success, lint cleanliness, spec compliance, and code review. Each verdict is recorded as a structured CLAIM/EVIDENCE/OUTPUT/VERDICT block in a GitHub Issue comment. Failed checks trigger retry cycles or gap-closure sub-phases.

### Agent isolation

All agents run in isolation. They do not share context windows or communicate directly. The orchestrator manages dispatch, sequencing, and handoff contracts between agents. When worktree mode is active, each agent also gets its own git worktree for file-level isolation.

{% callout type="note" %}
Agent model assignments are controlled by the active model profile. Use /maxsim:settings to switch profiles, or set per-agent overrides in config.json under execution.model_overrides.
{% /callout %}
