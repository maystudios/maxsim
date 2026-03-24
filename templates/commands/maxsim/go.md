---
name: maxsim:go
description: Auto-detect project state and execute the right action
argument-hint: ""
allowed-tools: [Read, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode]
---

<objective>
Auto-detect project state from GitHub and dispatch to the right action. No arguments — pure auto-detection. Show detection reasoning, enter Plan Mode, propose the action, then execute after user approval.
</objective>

<context>
GitHub is the sole source of truth. Read the GitHub Project Board, open Issues, and Milestones to determine current state. Do NOT read .planning/ files.

Detection priority:
1. No CLAUDE.md or GitHub Milestone → init needed
2. Active Milestone with no planned phase → plan next phase
3. Active Milestone with planned phase not executed → execute that phase
4. Open bug/issue labeled `bug` → debug workflow
5. All phases done → offer milestone completion
</context>

<process>
Follow @.claude/maxsim/workflows/go.md end-to-end.

1. Read GitHub Project Board state via `gh` CLI
2. Detect what's next using the priority list above
3. Enter Plan Mode — show detection reasoning and proposed action
4. Wait for user approval (Ctrl+C cancels)
5. Execute approved action by spawning the appropriate Agent
</process>
