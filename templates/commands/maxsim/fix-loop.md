---
name: maxsim:fix-loop
description: Autonomous error repair — iteratively fix until zero errors remain
argument-hint: "[error-command]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, LS, TodoRead, TodoWrite]
---

<objective>
Autonomously fix all errors reported by a user-specified command. Loop: run the command, parse errors, fix one error at a time, verify the fix, repeat until zero errors remain or the iteration budget is exhausted.
</objective>

<context>
Arguments: $ARGUMENTS

If $ARGUMENTS is provided, treat it as the error command (e.g., `npm run build`, `npm test`, `npm run lint`, `tsc --noEmit`).

GitHub is the sole source of truth. Each fix iteration produces an atomic commit. Results are tracked in `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`.

This command uses Plan Mode to configure the loop parameters before execution begins.
</context>

<process>
Follow @.claude/maxsim/workflows/fix-loop.md end-to-end.

1. **Plan Mode:** Call `EnterPlanMode` before any execution
2. Gather loop parameters via AskUserQuestion (error command, guard command, budget, scope)
3. Run the error command once to establish baseline error count
4. Show proposed loop configuration, baseline error count, and confirm with user
5. Exit Plan Mode via `ExitPlanMode` — user reviews and approves the configuration
> **Tip:** Press **Ctrl+G** while reviewing the plan to edit it in your text editor before approving.
6. Run the 10-phase fix loop: Run → Parse → Prioritize → Analyze → Fix → Commit → Verify → Guard → Log → Progress
   - One error fixed per iteration; failed fixes are always reverted
   - Never modify test/guard files
7. Stuck detection: same error persists after 3 attempts → skip → revisit → escalate via GitHub Issue
8. On termination: display summary with errors fixed, errors remaining, and resistant errors
</process>
