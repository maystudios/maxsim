---
id: new-project
title: Initialize Project
group: Workflow
---

`/maxsim:init` is the unified entry point for setting up MaxsimCLI in any project. It detects your project's current state and dispatches to the right workflow: new project setup, existing project onboarding, or milestone lifecycle management.

{% codeblock language="bash" %}
/maxsim:init
{% /codeblock %}

### Auto-detection

When you run `/maxsim:init`, MaxsimCLI inspects the project to determine what to do:

{% doctable headers=["Detected State", "Workflow", "What Happens"] rows=[["No existing project structure", "new-project", "Interactive session: gathers project vision, constraints, non-goals, and target users. Spawns project researcher and roadmapper. Creates GitHub repository, Project Board, Milestones, and Phase Issues."], ["Existing codebase without MaxsimCLI", "init-existing", "Parallel codebase mapping: analyzes data models, APIs, frontend, infrastructure, and testing. Creates GitHub artifacts that reflect the project's current state."], ["Project already initialized", "new-milestone", "Milestone management: add a new milestone with phases to an existing Project Board."]] %}
{% /doctable %}

### New project workflow

For projects starting from scratch, the init workflow runs five stages:

{% codeblock language="text" %}
1. Prerequisites gate — verify GitHub CLI auth and git remote
2. Interview — gather project vision, tech stack preferences, constraints
3. Research — project researcher uses web search to evaluate the ecosystem
4. GitHub setup — create repo, labels, Project Board, config.json
5. Roadmap — roadmapper creates Milestones and Phase Issues
{% /codeblock %}

The project researcher agent uses web search (if available) to analyze the technology ecosystem, including frameworks, libraries, and known pitfalls, before the roadmapper creates the phase breakdown. This prevents phases that are sized wrong or ordered incorrectly.

### Existing project onboarding

For projects that already have code, the init-existing workflow runs parallel codebase-mapper agents that analyze different areas of the codebase (data models, API routes, frontend components, infrastructure, testing). The analysis is synthesized and stored in the GitHub Wiki and agent memory. Subsequent planning agents use this analysis as context.

### After initialization

Once init completes, your project has:

- A GitHub Project Board with Kanban columns (Backlog, To Do, In Progress, In Review, Done)
- GitHub Milestones grouping related phase Issues
- Phase Issues with descriptions, deliverables, and success criteria
- Labels for issue classification (type:phase, type:task, type:bug, type:quick)
- A `.claude/maxsim/config.json` with project settings

You are ready to plan your first phase with `/maxsim:plan 1`.

{% callout type="tip" %}
Be specific when the researcher asks questions. Vague answers produce vague phases. If you already have a stack decision, say so. If you have deadline constraints, mention them. The more context you provide during init, the better every subsequent plan will be.
{% /callout %}
