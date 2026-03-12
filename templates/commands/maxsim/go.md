---
name: maxsim:go
description: Auto-detect project state and dispatch to the right command
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
  - SlashCommand
---
<objective>
Auto-detect project state through deep context gathering, surface any problems, and dispatch to the appropriate MAXSIM command.

**How it works:**
1. Gather deep context (project state, git status, recent commits, blockers)
2. Surface any problems and block until resolved
3. Show detection reasoning (what was found)
4. Act immediately by dispatching to the right command

Show + Act pattern: display detection reasoning, then act. No arguments -- pure auto-detection. User can Ctrl+C if the detection is wrong.
</objective>

<execution_context>
@~/.claude/maxsim/workflows/go.md
</execution_context>

<process>
Execute the go workflow from @~/.claude/maxsim/workflows/go.md end-to-end.
</process>
