---
name: maxsim:execute
description: Execute all plans in a phase with parallel agents and auto-verification
argument-hint: "<phase-number>"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, EnterPlanMode, ExitPlanMode]
---

<objective>
Execute all task Issues in a phase using parallel Agents, auto-verify results, and retry on failure (max 3 retries). GitHub Issues track task state throughout.
</objective>

<context>
Arguments: $ARGUMENTS

Phase number is required (e.g., `/maxsim:execute 3`).

GitHub is the sole source of truth. Task state (todo/in-progress/done) is read from GitHub Issue labels and Project Board columns — no .planning/ files.

Re-entry: If phase is already executed and verified, show status and offer options (view results, re-execute).
</context>

<process>
Follow @.claude/maxsim/workflows/execute.md end-to-end.

1. Detect phase state from GitHub Project Board (already done / partially executed / ready)
2. Group task Issues by wave — execute parallel Agents within each wave, sequential across waves
3. Each Agent updates its GitHub Issue label on start and completion
4. After all tasks complete, spawn a verifier Agent to check acceptance criteria
5. On verification failure, auto-retry with gap-closure context (max 3 retries)
6. On final failure, report what failed and surface options to user
</process>
