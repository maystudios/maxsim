---
id: codebase-mapping
title: Codebase Mapping
group: Advanced
---

Codebase mapping analyzes an existing codebase using parallel mapper agents. It produces structured analysis that subsequent planning agents use as context when working in the project.

Codebase mapping runs automatically as part of the `/maxsim:init --existing` workflow. When you onboard MaxsimCLI to a project that already has code, the init process dispatches mapper agents to understand the codebase before any planning begins.

{% codeblock language="bash" %}
# Initialize MaxsimCLI in an existing project — triggers codebase mapping automatically
/maxsim:init --existing
{% /codeblock %}

Multiple codebase-mapper agents run in parallel, each covering a different area of the codebase. One covers data models, another covers API routes, another covers frontend components, another covers infrastructure. Their outputs are synthesized into a unified analysis stored in the GitHub Wiki and cached in `.claude/agent-memory/` for fast agent access.

The codebase analysis is loaded automatically by phase-researcher agents. When planning a phase in an existing codebase, the researcher reads the analysis to understand existing patterns, conventions, and potential integration points instead of re-discovering them from scratch.

{% callout type="note" %}
Codebase mapping is not a standalone command. It is triggered as part of project initialization with `/maxsim:init --existing`. If you need to re-map the codebase after significant changes, run the init workflow again.
{% /callout %}
