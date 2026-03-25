---
name: maxsim:fix-loop
description: Autonomous error repair — iteratively fix until zero errors remain
argument-hint: "[error-command]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode]
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
Invoke the `autoresearch` skill (fix workflow) to drive the repair loop. Invoke the `systematic-debugging` skill when root-cause analysis is needed for non-obvious errors.

**Phase 1 — Setup (Plan Mode)**

1. Enter Plan Mode via EnterPlanMode
2. Gather loop parameters via AskUserQuestion:
   - **Error command** — the command that reports errors (from $ARGUMENTS or ask)
   - **Guard command** — optional regression check that must stay green (e.g., `npm test` when fixing lint errors)
   - **Iteration budget** — max fix attempts before stopping (default: 30)
   - **Scope** — which files/directories are in-scope for modification (default: auto-detect from errors)
3. Run the error command once to establish the baseline error count
4. Show the proposed loop configuration, baseline error count, and ask user to confirm
5. **Handle user response:**
   - **If user approves:** proceed to step 6
   - **If user requests changes:** return to step 2 to re-gather the modified parameters (stay in Plan Mode). If the error command changed, re-run it for a new baseline (step 3). Re-show the revised configuration and confirm again.
   - **If user cancels:** Exit Plan Mode via ExitPlanMode and stop — do not start the fix loop.
6. Exit Plan Mode via ExitPlanMode

**Phase 2 — Fix Loop**

Repeat until zero errors or budget exhausted:

1. **Run** — execute the error command, capture full output
2. **Parse** — extract individual errors with file paths, line numbers, and messages
3. **Prioritize** — pick ONE error to fix (prefer: blocking errors first, then cascading errors that may resolve others, then simplest)
4. **Analyze** — read the relevant code, understand the root cause (invoke `systematic-debugging` skill if non-obvious)
5. **Fix** — make the minimal change to resolve the error (never modify test/guard files)
6. **Commit** — atomic commit with message `fix(<scope>): <error-description>`
7. **Verify** — re-run the error command, confirm the targeted error is gone
   - If the fix introduced new errors → `git revert HEAD --no-edit`, log failure, try a different approach
   - If the fix resolved the error → proceed
8. **Guard** — if a guard command is configured, run it to check for regressions
   - Guard failure → rework (max 2 attempts), then revert and skip this error
9. **Log** — append result to TSV (date, iteration, error-fixed, error-count-before, error-count-after, commit-hash, notes)
10. **Progress** — display: errors remaining, errors fixed this session, iteration count

**Stuck Detection:**
If the same error persists after 3 fix attempts with different approaches:
1. Log the error as resistant
2. Skip it and move to the next error
3. After all other errors are addressed, revisit resistant errors with full context
4. If still stuck → create a GitHub Issue describing the resistant error and escalate to user

**Termination:**
Stop when zero errors remain, iteration budget is exhausted, all remaining errors are resistant, or user interrupts (Ctrl+C).

**Final Report:**
Display a summary: total errors at start, errors fixed, errors remaining (with details), iterations used, resistant errors (if any).
</process>
