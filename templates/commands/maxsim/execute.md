---
name: maxsim:execute
description: Execute all plans in a phase with auto-verification and retry
argument-hint: "<phase-number> [--worktrees|--no-worktrees]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - TodoWrite
---
<objective>
Execute the phase state machine: Execute all plans in wave order, auto-verify, retry on failure (max 2 retries).

**How it works:**
1. Detect phase state (already done, partially executed, ready to execute)
2. Execute all plans grouped by wave — parallel within waves, sequential across waves
3. Auto-verify after all plans complete — spawn verifier agent
4. If verification fails, auto-retry with gap closure (max 2 retries, 3 total attempts)
5. On final failure, report what failed and let user decide
6. Supports worktree-based parallel execution: --worktrees forces worktree isolation, --no-worktrees forces standard mode

**Re-entry:** If phase is already executed and verified, show status and offer options (view results, re-execute, view verification).

**Phase-level only:** Operates on the entire phase — no plan-level granularity.
</objective>

<execution_context>
@~/.claude/maxsim/workflows/execute.md
@~/.claude/maxsim/references/ui-brand.md
</execution_context>

<context>
Phase number: $ARGUMENTS (required — e.g., `/maxsim:execute 3`)

Context files are resolved inside the workflow via `maxsim-tools init execute-phase` and per-subagent context assembly.
</context>

<process>
Execute the execute workflow from @~/.claude/maxsim/workflows/execute.md end-to-end.
Preserve all workflow gates (state detection, wave execution, verification, retry loop, re-entry flow).
</process>
