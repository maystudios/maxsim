---
name: maxsim:improve
description: Autonomous optimization loop — modify→verify→keep/discard cycle against any metric
argument-hint: "[metric-command]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode]
---

<objective>
Run the autoresearch 8-phase optimization loop: make ONE atomic change per iteration, verify against a user-defined metric, guard against regressions, keep or discard via git revert. Loop until the target is met or the iteration budget is exhausted.
</objective>

<context>
Arguments: $ARGUMENTS

If $ARGUMENTS is provided, treat it as the metric command (e.g., `npm run benchmark`, `wc -l src/**/*.ts`, `npm test -- --coverage`).

GitHub is the sole source of truth. Results are tracked in `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv` (7-column TSV). Git history is the memory — every iteration produces a commit or a revert.

This command uses Plan Mode to configure the loop parameters before execution begins.
</context>

<process>
Invoke the `autoresearch` skill to drive the optimization loop. Invoke the `verification` skill for evidence-based confirmation at each iteration.

**Phase 1 — Setup (Plan Mode)**

1. Enter Plan Mode via EnterPlanMode
2. Gather loop parameters via two AskUserQuestion calls:
   **Batch 1** (required — 4 questions):
   - Metric command (the command to run and extract a number from)
   - Guard command (regression check, e.g., `npm test`)
   - Metric direction (`lower_is_better` or `higher_is_better`)
   - Iteration budget (default: 20)

   **Batch 2** (scope and constraints — 3 questions):
   - Scope (files/directories to modify)
   - Files to NEVER modify (test files, guard files, config)
   - Starting approach (optional — first idea to try)
3. Dry-run: Execute the metric command once to establish baseline. Execute the guard command to confirm it passes. If either fails, ask the user to fix before proceeding.
4. Show the proposed loop configuration and confirm with user
5. Exit Plan Mode via ExitPlanMode
> **Tip:** Press **Ctrl+G** while reviewing the plan to edit it in your text editor before approving.

**Phase 2 — Optimization Loop**

Run the 8-phase autoresearch loop, one iteration at a time:

1. **Review** — read `git log --oneline -10`, the TSV results file, and recent diffs to understand current state
2. **Ideate** — exploit successful past approaches, avoid repeated failures, try untried angles
3. **Modify** — make ONE atomic change to in-scope files (never modify guard/test files)
4. **Commit** — commit before verification with prefix `experiment(<scope>):`
5. **Verify** — run the metric command, extract the numeric result, compare to previous best
6. **Guard** — run the guard command to check for regressions
   - Guard failure + verify pass → rework (max 2 attempts), then discard
7. **Decide** — metric improved AND guard passed → keep; otherwise → `git revert HEAD --no-edit`
8. **Log** — append iteration result to the TSV file (iteration, commit, metric, delta, guard, status, description)

**Stuck Detection:**
After 5 consecutive discards or crashes:
1. Re-read ALL in-scope files (full context reload)
2. Re-read original goal and review entire TSV log for patterns
3. Try combining 2-3 successful past changes
4. Try the OPPOSITE approach
5. Try a radical architectural change
6. If still stuck → create a diagnostic GitHub Issue and escalate to user

**Noise Handling:**
For volatile metrics: 3-run median for 1-5% variance, 5-run median for >5% variance. Apply a minimum-delta threshold to filter noise.

**Termination:**
Stop when iteration budget is exhausted, target metric is reached, or user interrupts (Ctrl+C).

**Final Report:**
Display a summary: iterations run, best metric achieved, total improvements kept, approaches that worked vs. failed.
</process>
