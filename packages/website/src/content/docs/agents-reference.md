---
id: agents-reference
title: Agent Reference
group: Agents
---

{% doctable headers=["Agent", "Role", "Preloaded Skills"] rows=[["executor", "Implements code changes according to the phase plan", "commit-conventions, verification, handoff-contract"], ["planner", "Creates detailed phase plans from research findings", "brainstorming, roadmap-writing, handoff-contract"], ["researcher", "Investigates codebase and gathers context for planning", "research, handoff-contract"], ["verifier", "Reviews completed work against spec and quality gates", "code-review, verification, handoff-contract"]] %}
{% /doctable %}

All agents follow the same pattern: receive a handoff contract, do focused work with their preloaded skills, produce a structured output, and hand control back to the orchestrator. Agents run in isolation using worktree mode. They never communicate directly with each other. The orchestrator manages all dispatch and sequencing.
