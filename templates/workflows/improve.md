<!-- GITHUB-ONLY: All state lives on GitHub. No local .planning/ directory. -->
<!-- CONSTRAINT: Use Agent tool (NOT Task). -->

<purpose>
Autonomous 8-phase optimization loop. Makes ONE atomic change per iteration, verifies against a user-defined metric, guards against regressions, keeps or discards via git revert. Loops until the target is met or the iteration budget is exhausted. Results are tracked in `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv` (7-column TSV). Git history is the memory — every iteration produces a commit or a revert.
</purpose>

<process>

## Step 1: Enter Plan Mode

Call `EnterPlanMode` to begin setup.

## Step 2: Gather Loop Parameters (Batch 1 — Required)

Ask 4 questions via `AskUserQuestion`:

1. **Metric command** — the command to run and extract a number from (e.g., `npm run benchmark`, `wc -l src/**/*.ts`, `npm test -- --coverage`). Pre-fill from `$ARGUMENTS` if provided.
2. **Guard command** — regression check that must stay green (e.g., `npm test`)
3. **Metric direction** — `lower_is_better` or `higher_is_better`
4. **Iteration budget** — max iterations before stopping (default: 20)

Store as `$METRIC_CMD`, `$GUARD_CMD`, `$DIRECTION`, `$BUDGET`.

## Step 3: Gather Loop Parameters (Batch 2 — Scope and Constraints)

Ask 3 questions via `AskUserQuestion`:

1. **Scope** — files/directories to modify (e.g., `src/core/`, `lib/*.ts`)
2. **Files to NEVER modify** — test files, guard files, config (e.g., `tests/`, `jest.config.ts`)
3. **Starting approach** — optional first idea to try (e.g., "try memoizing expensive lookups")

Store as `$SCOPE`, `$PROTECTED_FILES`, `$INITIAL_APPROACH`.

## Step 4: Establish Baseline

Run the metric command once to establish the baseline value:

```bash
$METRIC_CMD
```

Extract the numeric result. Store as `$BASELINE`.

Run the guard command to confirm it passes:

```bash
$GUARD_CMD
```

If either command fails, display the error and ask the user to fix before proceeding. Do not continue until both commands succeed.

## Step 5: Confirm Configuration

Display the proposed loop configuration:

```
## Optimization Loop Configuration

Metric command: $METRIC_CMD
Guard command: $GUARD_CMD
Direction: $DIRECTION
Iteration budget: $BUDGET
Baseline metric: $BASELINE
Scope: $SCOPE
Protected files: $PROTECTED_FILES
Starting approach: $INITIAL_APPROACH

Confirm to begin? (yes / edit)
```

**Handle user response:**
- **If user approves:** proceed to step 6
- **If user requests changes:** return to the relevant step to re-gather parameters. If the metric or guard command changed, re-run baseline (step 4). Re-show the revised configuration and confirm again.
- **If user cancels:** Exit Plan Mode via `ExitPlanMode` and stop.

## Step 6: Exit Plan Mode

Call `ExitPlanMode`. Begin the optimization loop.

Initialize: `$ITERATION = 0`, `$BEST_METRIC = $BASELINE`, `$CONSECUTIVE_DISCARDS = 0`.

## Step 7: Optimization Loop (8 Phases Per Iteration)

Repeat until `$ITERATION >= $BUDGET` or target reached or user interrupts (Ctrl+C):

Increment `$ITERATION`.

### Phase 1 — Review

Read current state:

```bash
git log --oneline -10
```

Read the TSV results file (`.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`) and recent diffs to understand what has been tried and what worked.

### Phase 2 — Ideate

Generate the next change idea:

- Exploit successful past approaches (from TSV log)
- Avoid approaches that have already failed (from TSV log)
- Try untried angles
- If `$INITIAL_APPROACH` is set and this is iteration 1, use it
- If stuck (see stuck detection below), use recovery strategies

State the idea explicitly: "I will try X because Y."

### Phase 3 — Modify

Make ONE atomic change to in-scope files (`$SCOPE`). Rules:

- **Never modify files in `$PROTECTED_FILES`** — these are the guard/test files
- **One change only** — multiple changes make attribution impossible
- Keep changes minimal and focused

### Phase 4 — Commit

Commit the change BEFORE verification:

```bash
git add -A
git commit -m "experiment($SCOPE): $DESCRIPTION"
```

This ensures every experiment is captured in git history and can be cleanly reverted.

### Phase 5 — Verify

Run the metric command:

```bash
$METRIC_CMD
```

Extract the numeric result. Store as `$CURRENT_METRIC`. Compare to `$BEST_METRIC` using `$DIRECTION`:

- If `lower_is_better`: improved when `$CURRENT_METRIC < $BEST_METRIC`
- If `higher_is_better`: improved when `$CURRENT_METRIC > $BEST_METRIC`

Calculate `$DELTA = $CURRENT_METRIC - $BEST_METRIC`.

**Noise handling:** For volatile metrics:
- 1-5% variance across runs: use 3-run median instead of single run
- Greater than 5% variance: use 5-run median
- Apply a minimum-delta threshold to filter noise (ignore improvements smaller than the observed variance)

### Phase 6 — Guard

Run the guard command:

```bash
$GUARD_CMD
```

- **Guard passes:** continue to Decide
- **Guard fails + metric improved:** attempt rework (max 2 attempts). Modify the change to fix the guard regression while preserving the metric improvement. If rework fails after 2 attempts, proceed to Decide as a failure.
- **Guard fails + metric not improved:** proceed to Decide as a failure.

### Phase 7 — Decide

| Metric Improved | Guard Passed | Action |
|-----------------|--------------|--------|
| Yes | Yes | **KEEP** — update `$BEST_METRIC = $CURRENT_METRIC`, reset `$CONSECUTIVE_DISCARDS = 0` |
| Yes | No (rework failed) | **DISCARD** — `git revert HEAD --no-edit`, increment `$CONSECUTIVE_DISCARDS` |
| No | Yes | **DISCARD** — `git revert HEAD --no-edit`, increment `$CONSECUTIVE_DISCARDS` |
| No | No | **DISCARD** — `git revert HEAD --no-edit`, increment `$CONSECUTIVE_DISCARDS` |

### Phase 8 — Log

Append the iteration result to the TSV file:

```
$ITERATION	$COMMIT_HASH	$CURRENT_METRIC	$DELTA	$GUARD_RESULT	$STATUS	$DESCRIPTION
```

Where:
- `$COMMIT_HASH` = the commit hash (or the revert commit hash if discarded)
- `$GUARD_RESULT` = `pass` or `fail`
- `$STATUS` = `keep` or `discard`

Display iteration summary:

```
Iteration $ITERATION/$BUDGET: $STATUS
  Metric: $CURRENT_METRIC (delta: $DELTA)
  Guard: $GUARD_RESULT
  Best so far: $BEST_METRIC
```

Continue to next iteration.

---

## Step 8: Stuck Detection

> **Reference:** See `.claude/maxsim/references/self-improvement.md` for detailed recovery strategies and anti-patterns.

After 5 consecutive discards (`$CONSECUTIVE_DISCARDS >= 5`):

1. **Full context reload** — re-read ALL in-scope files (complete refresh of understanding)
2. **Pattern review** — re-read the original goal and review the entire TSV log. Identify patterns: what has been tried, what worked partially, what failed completely
3. **Combination strategy** — try combining 2-3 elements from successful past changes
4. **Opposite strategy** — try the OPPOSITE approach of what has been tried
5. **Radical strategy** — try a fundamentally different architectural approach
6. **Escalation** — if still stuck after trying strategies 1-5, create a diagnostic GitHub Issue with all findings and escalate to the user:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github create-issue \
  --title "improve: stuck after $CONSECUTIVE_DISCARDS consecutive failures" \
  --label "type:bug" --label "maxsim:auto" \
  --body "## Stuck Detection\n\nMetric: $METRIC_CMD\nBaseline: $BASELINE\nBest achieved: $BEST_METRIC\nConsecutive failures: $CONSECUTIVE_DISCARDS\n\n## Approaches Tried\n{summary from TSV log}\n\n## Suggested Investigation\n- Review scope constraints\n- Consider if metric is hitting a ceiling\n- Check for environmental factors"
```

Reset `$CONSECUTIVE_DISCARDS = 0` after any recovery attempt (regardless of success).

---

## Step 9: Termination

Stop the loop when any of these conditions is met:

- **Budget exhausted:** `$ITERATION >= $BUDGET`
- **Target reached:** user-specified target metric achieved (if provided)
- **User interrupt:** Ctrl+C

## Step 10: Final Report

Display a summary of the optimization session:

```
## Optimization Complete

Iterations: $ITERATION / $BUDGET
Baseline metric: $BASELINE
Best metric achieved: $BEST_METRIC
Total improvement: {$BEST_METRIC - $BASELINE}
Improvements kept: {count of 'keep' rows in TSV}
Experiments discarded: {count of 'discard' rows in TSV}

### Approaches That Worked
{list successful changes from TSV log}

### Approaches That Failed
{list failed changes from TSV log}

### TSV Log
File: .claude/agent-memory/maxsim-learner/autoresearch-results.tsv
```

</process>

<hard_gates>

<HARD-GATE name="improve-loop-invariants">

These rules are non-negotiable during the optimization loop:

- **Never modify guard or test files.** The guard command and its associated test files are the regression safety net. Changing them to make a metric pass invalidates the entire loop.
- **Never use `--no-verify` on any git command.** Pre-commit hooks exist for a reason. Bypassing them defeats safety checks.
- **Always `git revert HEAD --no-edit` on failure.** If the metric did not improve OR the guard failed, the commit MUST be reverted. Do not carry forward a failed experiment.
- **One atomic change per iteration.** Multiple changes in a single iteration make it impossible to attribute metric movement. Make one change, measure, decide.
- **Commit before verification.** The commit happens at Phase 4, before the metric and guard runs. This ensures every experiment is captured in git history and can be cleanly reverted.

If you find yourself rationalizing an exception to any of these rules, STOP. The rule applies without exception.

</HARD-GATE>

</hard_gates>

<success_criteria>
- [ ] Plan Mode entered before setup
- [ ] Two batches of AskUserQuestion used to gather parameters
- [ ] Baseline established by running both metric and guard commands
- [ ] Configuration confirmed by user before loop starts
- [ ] Plan Mode exited before loop execution
- [ ] Each iteration follows all 8 phases: Review, Ideate, Modify, Commit, Verify, Guard, Decide, Log
- [ ] ONE atomic change per iteration — never multiple
- [ ] Commit happens before verification (Phase 4 before Phase 5)
- [ ] Failed experiments are always reverted with `git revert HEAD --no-edit`
- [ ] Guard/test/protected files are never modified
- [ ] `--no-verify` is never used on git commands
- [ ] TSV log appended after each iteration
- [ ] Stuck detection triggers after 5 consecutive discards
- [ ] Noise handling applies median runs for volatile metrics
- [ ] Loop terminates on budget exhaustion, target reached, or user interrupt
- [ ] Final report displays summary with approaches that worked vs. failed
</success_criteria>
</output>
