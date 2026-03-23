---
id: quick-start
title: Quick Start
group: Introduction
---

The fastest way to start is `/maxsim:go`. It auto-detects where your project is in the workflow and does the right thing. For a new project, it walks you through initialization. For an existing project, it picks up where you left off.

The core MaxsimCLI workflow follows four steps. Each step is a slash command that spawns one or more focused subagents with fresh context.

{% codeblock language="bash" %}
# 0. Let MaxsimCLI figure out what to do next
/maxsim:go

# 1. Initialize project — sets up GitHub Issues, roadmap, and milestones
/maxsim:init

# 2. Research + plan — spawns researcher, planner, and plan-checker agents
/maxsim:plan 1

# 3. Execute — implements the plan with atomic commits and deviation tracking
/maxsim:execute 1
{% /codeblock %}

After execution, phase state and decisions are tracked as GitHub Issue comments. You can run `/maxsim:progress` any time to see where you are and what to do next.

{% callout type="tip" %}
Run /maxsim:plan before /maxsim:execute. The plan command manages discussion, research, and planning stages, surfacing assumptions and gray areas before you start building.
{% /callout %}
