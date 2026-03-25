---
id: worktree-mode
title: Worktree Mode
group: Advanced
---

Worktree mode gives each agent an isolated git environment so multiple agents can work in parallel without stepping on each other's changes. Instead of sharing a single working directory, each agent operates in its own git worktree branched from the current state.

### Configuration

Configure worktrees under the `worktrees` key in your MaxsimCLI config:

{% codeblock language="json" %}
{
  "worktrees": {
    "auto_cleanup": true,
    "branch_prefix": "maxsim/",
    "path_template": ".claude/worktrees/agent-{id}/",
    "branch_template": "maxsim/phase-{N}-task-{id}"
  }
}
{% /codeblock %}

{% doctable headers=["Key", "Default", "Description"] rows=[["auto_cleanup", "true", "Automatically remove worktree directories after the agent completes and its branch is merged."], ["branch_prefix", "maxsim/", "Prefix for worktree branch names."], ["path_template", ".claude/worktrees/agent-{id}/", "Directory template for worktree checkouts. {id} is replaced with the agent ID."], ["branch_template", "maxsim/phase-{N}-task-{id}", "Branch name template. {N} is the phase number, {id} is the agent or task ID."]] %}
{% /doctable %}

### How it works

When worktree mode is active, MaxsimCLI creates a temporary git worktree for each dispatched agent. The agent checks out a branch, makes its changes, and commits. After the agent completes and its work passes verification, MaxsimCLI merges the worktree branch back into the main branch.

This avoids the most common problem with parallel AI agents: two agents editing the same file simultaneously and producing conflicting changes. With worktrees, conflicts are detected at merge time and can be resolved cleanly.

{% callout type="note" %}
Worktrees require a git repository. If your project is not a git repo, worktree mode is automatically disabled regardless of the setting.
{% /callout %}
