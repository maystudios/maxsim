---
id: commands-core
title: Core Commands
group: Commands Reference
---

MaxsimCLI provides 14 commands (13 primary + 1 alias), each mapped to a slash command inside Claude Code. Every command dispatches one or more subagents with fresh context windows, reads state from GitHub, and writes results back to GitHub.

### Command overview

{% doctable headers=["Command", "Description", "Key Flags"] rows=[["/maxsim:go", "Auto-dispatch: detects project state from GitHub and runs the right workflow", "---"], ["/maxsim:init", "Initialize project, onboard existing codebase, or manage milestones", "---"], ["/maxsim:plan", "Plan a phase through discussion, research, and task breakdown", "--force-research, --skip-verify"], ["/maxsim:execute", "Execute a phase plan with parallel agents in isolated worktrees", "--worktrees, --no-worktrees"], ["/maxsim:progress", "Show current phase and milestone progress from GitHub", "---"], ["/maxsim:quick", "Run a small standalone task outside the phase workflow", "---"], ["/maxsim:debug", "Start a structured debugging session with persistent state", "--hierarchical"], ["/maxsim:improve [metric]", "Autonomous optimization loop targeting a specific metric command", "---"], ["/maxsim:fix-loop [cmd]", "Autonomous error repair loop for a failing command", "---"], ["/maxsim:debug-loop [symptom]", "Autonomous bug hunting loop with hypothesis testing", "---"], ["/maxsim:security [scope]", "Security audit using STRIDE, OWASP, and red-team analysis (read-only)", "---"], ["/maxsim:settings", "View or modify MaxsimCLI configuration interactively", "---"], ["/maxsim:help", "Show all available commands and usage", "---"]] %}
{% /doctable %}

### How commands work

Each command maps to a workflow file in `.claude/maxsim/workflows/`. When you type `/maxsim:plan`, Claude Code loads `workflows/plan.md`, which orchestrates the discussion, research, and planning stages by dispatching subagents. The workflow file is a structured prompt, not executable code.

Commands that accept a phase number (like `/maxsim:plan 3` or `/maxsim:execute 2`) look up the corresponding GitHub Issue on the Project Board to load context. Commands without arguments (like `/maxsim:go` or `/maxsim:progress`) query the full Project Board state to determine what to do.

### Autonomous loops

The three autonomous commands (`/maxsim:improve`, `/maxsim:fix-loop`, `/maxsim:debug-loop`) run in a loop until they either reach a target metric, exhaust a retry budget, or confirm the issue is resolved. They use the `autoresearch` skill to drive hypothesis-test-iterate cycles. `/maxsim:security` is read-only and never modifies code.

{% callout type="tip" %}
Start with /maxsim:go if you are not sure which command to use. It reads the GitHub Project Board and dispatches to the appropriate workflow automatically.
{% /callout %}
