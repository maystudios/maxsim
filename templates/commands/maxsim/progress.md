---
name: maxsim:progress
description: Show project status from GitHub Project Board with next-action recommendation
allowed-tools: [Read, Bash, Grep, Glob]
---

<objective>
Show current project progress from GitHub and recommend the next action. Provides situational awareness, detects gaps, and routes to the appropriate next command.
</objective>

<context>
GitHub is the sole source of truth. Read the GitHub Project Board, Milestone progress, and open Issues to build the status view — no .planning/ or ROADMAP.md files.
</context>

<process>
Follow @~/.claude/maxsim/workflows/progress.md end-to-end.

1. Read active GitHub Milestone and its completion percentage
2. Read GitHub Project Board columns to get phase/task states
3. List open Issues by label (bug, quick, debug, blocked)
4. Render a status table: phases with planned/executed/verified state
5. Detect gaps (planned but not executed, executed but not verified)
6. Recommend next action with the exact command to run
</process>
