---
id: quick-tasks
title: Quick Tasks
group: Advanced
---

`/maxsim:quick` is MaxsimCLI's escape hatch for ad-hoc work. It runs a single executor with atomic commits and state tracking, but skips the researcher, plan-checker, and verifier agents. Use it for tasks that do not warrant a full phase: small bug fixes, one-off scripts, quick UI tweaks.

{% codeblock language="bash" %}
# Quick task — minimal agents, fast execution
/maxsim:quick

# Quick task with inline description
/maxsim:quick fix the border radius on the login button
{% /codeblock %}

The command accepts an optional description argument. If omitted, MaxsimCLI prompts you for a task description interactively.

When to use quick vs execute-phase: use quick for tasks you could describe in one sentence that have no dependencies on other planned work. Use execute-phase when the task is part of a planned phase, has multiple sub-tasks, or needs the plan-checker's validation.

{% callout type="note" %}
Even in quick mode, the executor still commits after each task, updates the GitHub Issue status, and follows the deviation rules. It's "quick" because it skips optional planning agents, not because it cuts corners on execution quality.
{% /callout %}
