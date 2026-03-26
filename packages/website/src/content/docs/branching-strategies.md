---
id: branching-strategies
title: Branching Strategies
group: Configuration
---

MaxsimCLI manages git branches automatically. There is no user-configurable branching strategy -- branches are created per task, not per phase or milestone.

### Automatic worktree branches

Every task executed by `/maxsim:execute` gets its own git worktree and branch. The branch name follows a fixed template:

{% codeblock language="text" %}
maxsim/phase-{N}-task-{id}
{% /codeblock %}

For example, task 3 in phase 2 runs on branch `maxsim/phase-2-task-3` inside a worktree at `.claude/worktrees/agent-{id}/`. Parallel tasks in the same wave each get their own branch and worktree, so they never conflict.

### Automatic merge after verification

When verification passes for a task, MaxsimCLI merges the task branch into the base branch and removes the worktree automatically. You do not need to merge branches manually. If verification fails, the branch is retained so you can inspect the work and the executor can retry on the same branch.

### Branch naming configuration

The branch template is configurable in `.claude/maxsim/config.json` under the `worktrees` key:

{% codeblock language="json" %}
{
  "worktrees": {
    "branch_prefix": "maxsim/",
    "branch_template": "maxsim/phase-{N}-task-{id}",
    "path_template": ".claude/worktrees/agent-{id}/"
  }
}
{% /codeblock %}

{% doctable headers=["Key", "Default", "Description"] rows=[["branch_prefix", "maxsim/", "Prefix for all worktree branch names"], ["branch_template", "maxsim/phase-{N}-task-{id}", "Full branch name template. {N} = phase number, {id} = task ID."], ["path_template", ".claude/worktrees/agent-{id}/", "Directory template for worktree checkouts. {id} = agent ID."]] %}
{% /doctable %}

### Disabling worktrees

If your project setup requires all work to happen on the current branch (for example, due to symlinked dependencies or absolute path requirements), disable worktrees with the `--no-worktrees` flag:

{% codeblock language="bash" %}
/maxsim:execute --no-worktrees
{% /codeblock %}

When worktrees are disabled, all tasks execute sequentially on the current branch. Parallel wave execution is not available without worktrees.

{% callout type="note" %}
Worktree creation requires a clean working tree. MaxsimCLI will warn you if uncommitted changes would block worktree setup. Commit or stash your changes before running /maxsim:execute.
{% /callout %}
