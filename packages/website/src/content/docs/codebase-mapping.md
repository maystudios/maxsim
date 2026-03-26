---
id: codebase-mapping
title: Codebase Mapping
group: Advanced
---

Codebase mapping analyzes an existing codebase using parallel mapper agents. It produces structured analysis that subsequent planning agents use as context when working in the project.

### When mapping runs

Codebase mapping runs automatically as part of the `/maxsim:init` workflow when MaxsimCLI detects an existing codebase. When you onboard MaxsimCLI to a project that already has code, the init process dispatches mapper agents to understand the codebase before any planning begins.

{% codeblock language="bash" %}
# Initialize MaxsimCLI in an existing project — triggers codebase mapping automatically
/maxsim:init
{% /codeblock %}

### Parallel mapper agents

Multiple codebase-mapper agents run in parallel, each covering a different area of the codebase:

{% doctable headers=["Mapper Focus", "What It Analyzes"] rows=[["Data models", "Database schemas, ORM models, type definitions, and data flow patterns"], ["API routes", "REST endpoints, GraphQL resolvers, middleware chains, and authentication flows"], ["Frontend components", "Component hierarchy, state management, routing, and UI patterns"], ["Infrastructure", "Build configuration, deployment scripts, CI/CD pipelines, and environment setup"], ["Testing", "Test frameworks, coverage patterns, fixture setup, and testing conventions"]] %}
{% /doctable %}

Each mapper agent operates independently with its own context window, avoiding context rot from trying to analyze the entire codebase in a single pass.

### Output and storage

Mapper outputs are synthesized into a unified analysis stored in the GitHub Wiki and cached in `.claude/agent-memory/` for fast agent access. The analysis covers:

- Project structure and directory layout
- Technology stack and framework versions
- Coding conventions and patterns in use
- Integration points between subsystems
- Potential areas of technical debt

### How subsequent agents use the analysis

The codebase analysis is loaded automatically by phase-researcher agents. When planning a phase in an existing codebase, the researcher reads the analysis to understand existing patterns, conventions, and potential integration points instead of re-discovering them from scratch. This means the first phase planned after codebase mapping benefits from a deep understanding of the existing code without the researcher spending time re-reading every file.

### Re-mapping after changes

Codebase mapping is not a standalone command. It is triggered as part of project initialization with `/maxsim:init` when an existing codebase is detected. If you need to re-map the codebase after significant changes (such as a major refactor or new subsystem), run the init workflow again. The new mapping will overwrite the previous analysis.

{% callout type="note" %}
Codebase mapping is most valuable for medium-to-large projects. For small projects with fewer than 20 files, the overhead of parallel mapping agents is unnecessary -- the researcher agent can read the entire codebase directly during phase planning.
{% /callout %}
