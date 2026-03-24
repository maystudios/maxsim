---
id: planning-directory
title: GitHub Project Board
group: Core Concepts
---

The GitHub Project Board is MaxsimCLI's persistent memory. There are no local planning files. GitHub is the sole source of truth for project state, phase plans, research findings, decisions, and progress.

### Kanban columns

The Project Board uses a five-column Kanban layout that mirrors the phase lifecycle:

{% doctable headers=["Column", "Meaning"] rows=[["Backlog", "Phases defined but not yet started"], ["To Do", "Phases ready to execute — plan approved"], ["In Progress", "Phases currently being executed by agents"], ["In Review", "Execution complete — verification running or awaiting review"], ["Done", "Verification passed — phase closed"]] %}
{% /doctable %}

Moving an Issue between columns is how MaxsimCLI tracks progress. Agents update column position automatically as they work. You can move Issues manually in GitHub when you make decisions outside the normal flow.

### Issues as phase and task records

Each phase is a GitHub Issue with label `type:phase`. Each task within a phase is a sub-Issue linked to the phase Issue. The Issue body holds the phase description, deliverables, and success criteria. Labels carry type metadata (`type:phase`, `type:task`, `type:bug`, `type:quick`) and origin tracking (`maxsim:auto`, `maxsim:user`).

### Comments as persistent context

All agent-written context lives in Issue comments. A phase Issue accumulates comments over its lifetime:

{% codeblock language="markdown" %}
<!-- Discussion agent writes: -->
## Discussion — Phase 02

Q: Will the API require authentication on all routes?
A: Yes, JWT with refresh tokens.

---

<!-- Research agent writes: -->
## Research Findings — Phase 02

Existing auth middleware at src/middleware/auth.ts uses jose 4.x.
Recommend extending rather than replacing.

---

<!-- Executor agent writes: -->
## Session Update — 2026-02-15

**Current Position:** task 3 of 7
**Completed:** JWT middleware
**Next:** refresh endpoint
{% /codeblock %}

Each new agent session reads the full comment thread before starting. This is how context survives across sessions, context-window resets, and team handoffs.

### Milestones group phases

GitHub Milestones group related phase Issues into shippable deliverables. The Milestone completion percentage (open vs. closed Issues) is the roadmap progress indicator. When all phase Issues in a Milestone are closed and verified, the Milestone is marked complete.

{% callout type="tip" %}
You never need to create or edit local planning files. Any local planning directory left over from a previous version of MaxsimCLI should be removed. GitHub is the only place project state lives.
{% /callout %}
