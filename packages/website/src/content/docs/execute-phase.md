---
id: execute-phase
title: Execute Phase
group: Workflow
---

`/maxsim:execute` is the core execution engine. It reads task sub-Issues from the GitHub phase Issue, groups them by wave, and runs each wave's tasks in parallel using isolated worktrees.

{% codeblock language="bash" %}
/maxsim:execute

# Disable worktree isolation (run in main working tree)
/maxsim:execute --no-worktrees

# Explicitly enable worktrees (default behavior)
/maxsim:execute --worktrees
{% /codeblock %}

### Plan Mode approval gate

Before any code is written, `/maxsim:execute` enters Plan Mode (`EnterPlanMode`). The orchestrator presents the full execution plan — tasks, wave grouping, file targets — and waits for your approval. Only after you approve does execution begin (`ExitPlanMode`). This gate prevents agents from taking actions you did not intend.

### Worktree branches

By default, execution runs parallel agents in isolated git worktrees. Each worktree is created at `.maxsim-worktrees/{taskId}/` with a dedicated branch named `maxsim/phase-{N}-task-{id}`. Agents never conflict with each other or your main checkout. After verification passes, the branch is merged automatically and the worktree removed. Use `--no-worktrees` if your project setup requires all work to happen in the main tree.

Each executor agent works atomically: it commits after every completed task, posts a progress comment on the task's GitHub Issue, and updates the phase Issue with decisions and metrics. Auto-verify runs at the end of execution to validate deliverables against success criteria.

### Retry logic

If a task fails, the executor retries up to 3 times before escalating. Each retry is logged as a comment on the task's GitHub Issue. After 3 failed attempts, the task is flagged for human review and execution continues with the remaining tasks in the wave.

Deviation handling is built into the executor. When it encounters bugs, missing error handling, or blocking issues, it auto-fixes them (Rules 1-3) without asking for permission. When it encounters architectural decisions or new tables, it pauses and returns a structured checkpoint for you to review (Rule 4). All deviations are documented in a comment on the phase GitHub Issue.

### Deviation rules

{% doctable headers=["Rule", "Trigger", "Action"] rows=[["Rule 1", "Code doesn't work as intended", "Auto-fix inline, log in phase Issue comment"], ["Rule 2", "Missing critical functionality (auth, validation)", "Auto-add, log in phase Issue comment"], ["Rule 3", "Something blocks task completion", "Auto-fix blocker, log in phase Issue comment"], ["Rule 4", "Architectural change required", "STOP — return checkpoint for human decision"]] %}
{% /doctable %}

{% callout type="note" %}
Wave parallelization requires Claude's subagent features. If your runtime doesn't support parallel subagents, tasks execute sequentially in wave order.
{% /callout %}
