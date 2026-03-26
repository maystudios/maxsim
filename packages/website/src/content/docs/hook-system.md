---
id: hook-system
title: Hook System
group: Advanced
---

MaxsimCLI installs hooks into Claude Code's hook system via the `.claude/hooks/` directory. Hooks run automatically at specific lifecycle events without any command. They are background utilities that improve your development experience.

### Installed hooks

{% doctable headers=["Hook", "Event", "Description"] rows=[["maxsim-check-update", "SessionStart", "Checks for a new MaxsimCLI version on npm. Notifies once per day if an update is available."], ["maxsim-statusline", "SessionStart", "Configures the Claude Code status line to show the active model, current task, working directory, and context info."], ["maxsim-notification-sound", "Notification", "Plays a notification sound when a task completes, so you know work is done even if you switched away from the terminal."], ["maxsim-stop-sound", "Stop", "Plays a sound when the session stops, providing audio feedback for session end."], ["maxsim-capture-learnings", "Stop", "Captures session learnings and notable decisions to agent memory for future context."]] %}
{% /doctable %}

### How hooks work

Hooks are scripts that Claude Code executes at specific lifecycle events. MaxsimCLI's hooks are installed during `npx maxsimcli@latest` and placed in `.claude/hooks/`. Each hook is a small script (typically a Node.js one-liner or shell command) that runs in the background.

Hooks do not interfere with your workflow. They run at session boundaries (start and stop) or on notification events, not during active coding. If a hook fails, it fails silently and does not block your session.

### Status line

The `maxsim-statusline` hook shows the current task and phase in your terminal prompt. This gives you a quick glance at where MaxsimCLI thinks you are without switching context. The status line updates automatically as you move between phases and tasks.

### Update checking

The `maxsim-check-update` hook runs once at session start and checks npm for a newer version of MaxsimCLI. If an update is available, it prints a one-line notification. It checks only once per day to avoid unnecessary network calls. The check result is cached locally so subsequent sessions on the same day skip the network call.

### Learning capture

The `maxsim-capture-learnings` hook runs at session stop and writes any notable findings or decisions from the session into `.claude/agent-memory/`. This memory is available to future agents, giving them access to patterns and decisions discovered in previous sessions.

### Disabling hooks

To disable all MaxsimCLI hooks, set `hooks.enabled` to `false` in `.claude/maxsim/config.json`:

{% codeblock language="json" %}
{
  "hooks": {
    "enabled": false
  }
}
{% /codeblock %}

Individual hooks can be disabled by removing or renaming the corresponding file in `.claude/hooks/`.

{% callout type="note" %}
Hooks are optional quality-of-life features. Disabling them does not affect MaxsimCLI's core functionality — commands, agents, workflows, and GitHub integration all work without hooks.
{% /callout %}
