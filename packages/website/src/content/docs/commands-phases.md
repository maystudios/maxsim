---
id: commands-phases
title: Phase Commands
group: Commands Reference
---

Phase lifecycle is managed through two commands: `/maxsim:plan` for planning and `/maxsim:execute` for execution.

### Planning with `/maxsim:plan`

`/maxsim:plan` walks through three sequential stages to produce an executable plan:

{% doctable headers=["Stage", "What Happens"] rows=[["Discussion", "Adaptive questioning to gather context — writes CONTEXT.md"], ["Research", "Studies the codebase and domain to inform planning decisions"], ["Planning", "Creates task breakdowns with wave assignments, type annotations, and verification criteria"]] %}
{% /doctable %}

{% codeblock language="bash" %}
/maxsim:plan
{% /codeblock %}

Each PLAN.md is a structured document with frontmatter (phase, plan number, type, wave, dependencies), an objective, task breakdown with type annotations, verification criteria, and success conditions.

### Execution with `/maxsim:execute`

`/maxsim:execute` reads all PLAN.md files for a phase, groups them by wave, and runs each wave's plans in parallel using isolated worktrees. Auto-verify runs after execution completes, and gap closure is handled automatically.

{% codeblock language="bash" %}
/maxsim:execute

# Run without worktree isolation
/maxsim:execute --no-worktrees
{% /codeblock %}

Plans support wave-based parallelization via the `wave` frontmatter field. Plans in wave 1 run in parallel, then wave 2 runs after all wave 1 plans complete, and so on.
