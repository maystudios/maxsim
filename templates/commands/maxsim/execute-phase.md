---
name: maxsim:execute-phase
description: Execute all plans in a phase with parallel agents and auto-verification (alias for /maxsim:execute)
argument-hint: "[phase-number]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, EnterPlanMode, ExitPlanMode, LS, TodoRead, TodoWrite]
---

<objective>
Execute all task Issues in a phase using parallel Agents, auto-verify results, and retry on failure (max 3 retries, 4 total attempts). GitHub Issues track task state throughout.
</objective>

<context>
Arguments: $ARGUMENTS

Phase number is required (e.g., `/maxsim:execute-phase 3`).

GitHub is the sole source of truth. Task state (todo/in-progress/done) is read from GitHub Issue labels and Project Board columns — no .planning/ files.

Re-entry: If phase is already executed and verified, show status and offer options (view results, re-execute).
</context>

<process>
Follow @.claude/maxsim/workflows/execute.md end-to-end.

1. **Plan Mode:** Call `EnterPlanMode` before any execution
2. Detect phase state from GitHub Project Board (already done / partially executed / ready)
3. Group task Issues by wave — re-evaluate wave composition before each spawn against current GitHub state. Present the execution plan to the user for review.
4. Exit Plan Mode via `ExitPlanMode` — user reviews and approves the execution plan
> **Tip:** Press **Ctrl+G** while reviewing the plan to edit it in your text editor before approving.
5. Execute parallel Agents within each wave, sequential across waves
   - Tier 1 (default): each Agent uses `isolation: "worktree"` and `run_in_background: true`
   - Tier 2 (opt-in, `competition_strategy: deep`): Agent Teams with `SendMessage` debate — requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
   - Graceful degradation: if Tier 2 is unavailable, falls back to Tier 1 automatically
6. Each Agent updates its GitHub Issue label on start and completion
7. After all tasks complete, spawn a verifier Agent to check acceptance criteria
8. On verification failure, auto-retry with gap-closure context (max 3 retries, 4 total attempts)
9. On final failure, report what failed and surface options to user
</process>
</output>
