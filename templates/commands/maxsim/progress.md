---
name: maxsim:progress
description: Check project progress, milestone status, and route to next action
allowed-tools:
  - Read
  - Bash
  - Grep
  - Glob
  - Task
  - SlashCommand
---
<objective>
Check project progress, milestone status, and offer milestone completion when all phases are done. Shows GitHub Issues-based progress alongside local ROADMAP.md progress for cross-validation.

Provides situational awareness before continuing work, detects phase gaps, and intelligently routes to the next action.
</objective>

<execution_context>
@~/.claude/maxsim/workflows/progress.md
</execution_context>

<process>
Execute the progress workflow from @~/.claude/maxsim/workflows/progress.md end-to-end.
Preserve all routing logic (Routes A through F) and edge case handling.
</process>
