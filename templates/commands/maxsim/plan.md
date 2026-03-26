---
name: maxsim:plan
description: Plan a specific phase with discussion, research, and task breakdown
argument-hint: "[phase-number]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, WebFetch, EnterPlanMode, ExitPlanMode, LS, TodoRead, TodoWrite]
---

<objective>
Run the plan state machine for a phase: Discussion → Research → Planning. Each stage produces GitHub Issues/comments as artifacts, shows a gate summary, and waits for confirmation before advancing.
</objective>

<context>
Arguments: $ARGUMENTS

Phase number is required.

Flags:
- `--force-research` — Re-run research even if research notes already exist on the GitHub Issue
- `--skip-verify` — Skip plan verification loop after the planning stage

GitHub is the sole source of truth. Stage state is read from GitHub Issue labels and comments — no .planning/ files.

Re-entry: If phase is already planned, show status and offer options (view, re-plan, execute).
</context>

<process>
Plan Mode: This command uses EnterPlanMode during the Discussion and Planning stages. Call ExitPlanMode before executing the approved plan.
> **Tip:** Press **Ctrl+G** while reviewing the plan to edit it in your text editor before approving.

Follow @.claude/maxsim/workflows/plan.md end-to-end.

1. Detect current stage from GitHub Issue labels on the phase Issue
2. Start at earliest incomplete stage
3. Discussion stage: clarify scope with user via AskUserQuestion
4. Research stage: spawn Agent for domain/codebase research (skipped if notes exist and no --force-research)
5. Planning stage: spawn Agent to break phase into task Issues with acceptance criteria
6. Show gate summary after each stage — wait for confirmation before advancing
</process>
