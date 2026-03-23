---
id: branching-strategies
title: Branching Strategies
group: Configuration
---

MaxsimCLI manages git branches automatically. There is no user-configurable branching strategy — branches are created per task, not per phase or milestone.

### Automatic worktree branches

Every task executed by `/maxsim:execute` gets its own git worktree and branch. The branch name follows a fixed template:

{% codeblock language="text" %}
maxsim/phase-{N}-task-{id}
{% /codeblock %}

For example, task 3 in phase 2 runs on branch `maxsim/phase-2-task-3` inside a worktree at `.maxsim-worktrees/{taskId}/`. Parallel tasks in the same wave each get their own branch and worktree, so they never conflict.

### Automatic merge after verification

When verification passes for a task, MaxsimCLI merges the task branch into the base branch and removes the worktree automatically. You do not need to merge branches manually. If verification fails, the branch is retained so you can inspect the work.

### No configuration required

There is no `branching_strategy` field in config.json. The worktree-per-task model is always active unless you pass `--no-worktrees` to `/maxsim:execute`, in which case all work runs on the current branch.

{% callout type="note" %}
Worktree creation requires a clean working tree. MaxsimCLI will warn you if uncommitted changes would block worktree setup.
{% /callout %}
