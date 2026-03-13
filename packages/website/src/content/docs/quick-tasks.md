---
id: quick-tasks
title: Quick Tasks
group: Advanced
---

`/maxsim:quick` is MaxsimCLI's escape hatch for ad-hoc work. It runs a single executor with atomic commits and state tracking, but skips the researcher, plan-checker, and verifier agents. Use it for tasks that don't warrant a full phase: small bug fixes, one-off scripts, quick UI tweaks.

{% codeblock language="bash" %}
# Quick task — minimal agents, fast execution
/maxsim:quick

# Full agents — same as execute-phase for a single task
/maxsim:quick --full

# Manage todos as GitHub Issues
/maxsim:quick --todo
{% /codeblock %}

The `--todo` flag integrates with GitHub Issues. It lets you create, view, and resolve todos directly from the CLI, with each todo tracked as a GitHub Issue in your repository.

When to use quick vs execute-phase: use quick for tasks you could describe in one sentence and that have no dependencies on other planned work. Use execute-phase when the task is part of a planned phase, has multiple sub-tasks, or needs the plan-checker's validation.

{% callout type="note" %}
Even in quick mode, the executor still commits after each task, updates STATE.md, and follows the deviation rules. It's "quick" because it skips optional planning agents — not because it cuts corners on execution quality.
{% /callout %}
