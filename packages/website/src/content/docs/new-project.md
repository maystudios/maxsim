---
id: new-project
title: Initialize Project
group: Workflow
---

`/maxsim:init` is the unified entry point for setting up MAXSIM in any project. It acts as a router that detects your project's current state and dispatches to the right workflow: new project setup, existing project onboarding, or milestone lifecycle management.

{% codeblock language="bash" %}
/maxsim:init
{% /codeblock %}

When you run `/maxsim:init`, MAXSIM inspects the project directory to determine what to do:

- **No `.planning/` directory** — starts the new-project workflow. Runs an interactive session that asks about your project vision, constraints, non-goals, and target users. Spawns a project researcher and roadmapper to create PROJECT.md, REQUIREMENTS.md, ROADMAP.md, and STATE.md.
- **Existing codebase without `.planning/`** — starts the init-existing workflow. Analyzes the existing code, infers architecture and conventions, then creates .planning/ artifacts that reflect the project's current state.
- **`.planning/` already exists** — starts the new-milestone workflow. Lets you add a new milestone and its phases to an existing roadmap without recreating the project from scratch.

The project researcher agent uses web search (if available) to analyze the technology ecosystem — frameworks, libraries, known pitfalls — before the roadmapper creates the phase breakdown. This prevents phases that are sized wrong or ordered incorrectly.

{% callout type="tip" %}
Be specific when the researcher asks questions. Vague answers produce vague phases. If you already have a stack decision, say so. If you have deadline constraints, mention them. The more context you give during init, the better every subsequent plan will be.
{% /callout %}
