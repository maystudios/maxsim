---
id: hook-system
title: Hook System
group: Advanced
---

MaxsimCLI installs hooks into your AI runtime's hook system via the `.claude/hooks/` directory. These run automatically without any command — they are background utilities that improve your development experience.

{% doctable headers=["Hook", "Event", "Description"] rows=[["check-update", "Session start", "Checks for new MaxsimCLI version on npm, notifies once per day"], ["statusline", "Every session", "Configures Claude Code status line to show model, task, directory, and context info"], ["notification-sound", "Task completion", "Plays a notification sound when a task completes"], ["stop-sound", "Session stop", "Plays a sound when the session stops"]] %}
{% /doctable %}

The statusline hook reads from STATE.md to show the current task and phase in your terminal prompt. This gives you a quick glance at where MaxsimCLI thinks you are without opening the dashboard.

The check-update hook runs once at session start and checks npm for a newer version of MaxsimCLI. If an update is available, it prints a one-line notification. It only checks once per day to avoid unnecessary network calls.

The notification-sound and stop-sound hooks provide audio feedback so you know when work finishes or a session ends, even if you've switched away from the terminal.

A `sync-reminder` hook also exists in the codebase but is currently a no-op.
