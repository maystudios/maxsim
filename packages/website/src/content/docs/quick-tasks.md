---
id: quick-tasks
title: Quick Tasks
group: Advanced
---

`/maxsim:quick` is MaxsimCLI's escape hatch for ad-hoc work. It runs a simplified workflow with atomic commits and GitHub tracking, but skips the researcher, plan-checker, and verifier agents. Use it for tasks that do not warrant a full phase: small bug fixes, one-off scripts, quick UI tweaks.

{% codeblock language="bash" %}
# Quick task with inline description
/maxsim:quick fix the border radius on the login button

# Quick task — MaxsimCLI prompts for a description
/maxsim:quick
{% /codeblock %}

### When to use quick vs. phase execution

{% doctable headers=["Use /maxsim:quick when", "Use /maxsim:execute when"] rows=[["The task fits in one sentence", "The task has multiple sub-tasks"], ["No dependencies on other planned work", "The task is part of a planned phase"], ["You want fast turnaround", "You want research, plan validation, and verification"], ["The change is small and self-contained", "The change touches multiple subsystems"]] %}
{% /doctable %}

### How quick tasks work

The quick workflow follows a streamlined path:

{% codeblock language="text" %}
1. Get task description (from argument or interactive prompt)
2. Create a GitHub Issue labeled type:quick
3. Move the Issue to In Progress on the Project Board
4. Spawn a planner agent in quick mode for a concise implementation plan
5. Spawn executor agent(s) to implement the plan
6. Commit atomically with a message referencing the GitHub Issue
7. Close the Issue with a completion summary
{% /codeblock %}

The planner in quick mode produces a lightweight plan -- typically a single task with 2-3 steps rather than the multi-task, multi-wave plans used in full phase execution.

### What quick tasks skip

Quick tasks skip three agents that full phase execution uses:

- **Researcher** -- no codebase analysis before planning
- **Plan-checker** -- no validation of the plan before execution
- **Verifier** -- no post-execution verification against success criteria

This makes quick tasks faster and cheaper but means you are responsible for verifying the result yourself. The executor still follows all deviation rules and commits atomically.

### Tracking quick tasks

Quick tasks appear on your GitHub Project Board alongside phase tasks. They use the `type:quick` label so you can filter them. Use `/maxsim:progress` to see all open quick tasks alongside phase work.

{% callout type="note" %}
Even in quick mode, the executor still commits after each task, updates the GitHub Issue status, and follows the deviation rules. It is "quick" because it skips optional planning agents, not because it cuts corners on execution quality.
{% /callout %}
