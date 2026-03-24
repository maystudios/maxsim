---
name: maxsim:quick
description: Quick task - create GitHub Issue and execute in simplified flow
argument-hint: "[task description]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode]
---

<objective>
Execute small, ad-hoc tasks with MaxsimCLI guarantees (atomic commits, GitHub tracking). Skips research and plan-checker for speed; runs a verifier after execution.
</objective>

<context>
Arguments: $ARGUMENTS

If $ARGUMENTS is provided, treat it as the task description.

Quick tasks are tracked as GitHub Issues (label: `type:quick`) — separate from planned phase Issues. GitHub is the sole source of truth — no .planning/ files.
</context>

<process>
Follow @.claude/maxsim/workflows/quick.md end-to-end.

1. Get task description from $ARGUMENTS or via AskUserQuestion
2. Clarify scope if ambiguous (one focused question)
3. Create a GitHub Issue labeled `type:quick` for the task
4. Spawn a planner Agent (quick mode) to produce a concise implementation plan
5. Spawn executor Agent(s) to implement the plan
6. Spawn a verifier Agent to check the result (tests pass, build succeeds, lint clean)
7. If verification fails, spawn a fix agent (max 2 retries)
8. Commit with atomic message referencing the GitHub Issue
9. Close the GitHub Issue with completion summary
</process>
