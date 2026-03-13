---
id: dashboard-features
title: Worktree Mode
group: Advanced
---

Worktree mode gives each agent an isolated git environment so multiple agents can work in parallel without stepping on each other's changes. Instead of sharing a single working directory, each agent operates in its own git worktree branched from the current state.

### Configuration

Set `worktree_mode` in `.claude/settings.json`:

{% codeblock language="json" %}
{
  "worktree_mode": "auto"
}
{% /codeblock %}

{% doctable headers=["Value", "Behavior"] rows=[["auto", "MaxsimCLI decides based on the number of agents dispatched. Single-agent tasks skip worktrees; multi-agent tasks use them. This is the default."], ["always", "Every agent gets its own worktree, even for single-agent tasks."], ["never", "All agents share the main working directory. Use this if your project has issues with worktrees or you prefer sequential execution."]] %}
{% /doctable %}

### How it works

When worktree mode is active, MaxsimCLI creates a temporary git worktree for each dispatched agent. The agent checks out a branch, makes its changes, and commits. After the agent completes and its work passes verification, MaxsimCLI merges the worktree branch back into the main branch.

This avoids the most common problem with parallel AI agents: two agents editing the same file simultaneously and producing conflicting changes. With worktrees, conflicts are detected at merge time and can be resolved cleanly.

{% callout type="note" %}
Worktrees require a git repository. If your project is not a git repo, worktree mode is automatically disabled regardless of the setting.
{% /callout %}
