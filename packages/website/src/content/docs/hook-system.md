---
id: hook-system
title: Hook System
group: Advanced
---

MaxsimCLI installs hooks into your AI runtime's hook system via the `.claude/hooks/` directory. These run automatically without any command. They are background utilities that improve your development experience.

{% doctable headers=["Hook", "Event", "Description"] rows=[["maxsim-check-update", "SessionStart", "Checks for new MaxsimCLI version on npm, notifies once per day"], ["maxsim-statusline", "SessionStart", "Configures Claude Code status line to show model, task, directory, and context info"], ["maxsim-notification-sound", "Notification", "Plays a notification sound when a task completes"], ["maxsim-stop-sound", "Stop", "Plays a sound when the session stops"], ["maxsim-capture-learnings", "Stop", "Captures session learnings to agent memory"]] %}
{% /doctable %}

The maxsim-statusline hook shows the current task and phase in your terminal prompt. This gives you a quick glance at where MaxsimCLI thinks you are without switching context.

The maxsim-check-update hook runs once at session start and checks npm for a newer version of MaxsimCLI. If an update is available, it prints a one-line notification. It checks only once per day to avoid unnecessary network calls.

The maxsim-notification-sound and maxsim-stop-sound hooks provide audio feedback so you know when work finishes or a session ends, even if you have switched away from the terminal.

The maxsim-capture-learnings hook runs at session stop and writes any notable findings or decisions from the session into agent memory for future context.
