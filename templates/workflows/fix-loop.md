<!-- GITHUB-ONLY: All state lives on GitHub. No local .planning/ directory. -->
<!-- CONSTRAINT: Use Agent tool (NOT Task). -->

<purpose>
Autonomous error repair loop. Runs a user-specified error command, parses errors, fixes one error at a time, verifies the fix, and repeats until zero errors remain or the iteration budget is exhausted. Each fix iteration produces an atomic commit. Results are tracked in `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`.
</purpose>

<process>

## Step 1: Enter Plan Mode

Call `EnterPlanMode` to begin setup.

## Step 2: Gather Loop Parameters

Ask via `AskUserQuestion`:

1. **Error command** — the command that reports errors (from `$ARGUMENTS` or ask). Examples: `npm run build`, `npm test`, `npm run lint`, `tsc --noEmit`
2. **Guard command** — optional regression check that must stay green (e.g., `npm test` when fixing lint errors). Can be empty if the error command IS the test suite.
3. **Iteration budget** — max fix attempts before stopping (default: 30)
4. **Scope** — which files/directories are in-scope for modification (default: auto-detect from error output)

Store as `$ERROR_CMD`, `$GUARD_CMD`, `$BUDGET`, `$SCOPE`.

## Step 3: Establish Baseline

Run the error command once to establish the baseline error count:

```bash
$ERROR_CMD
```

Parse the output to count individual errors. Store as `$BASELINE_ERRORS`. Store the full output for reference.

If the error command exits cleanly with no errors, display:
```
No errors found. Nothing to fix.
```
Exit Plan Mode and stop.

## Step 4: Confirm Configuration

Display the proposed loop configuration:

```
## Fix Loop Configuration

Error command: $ERROR_CMD
Guard command: $GUARD_CMD (or "none")
Iteration budget: $BUDGET
Scope: $SCOPE
Baseline errors: $BASELINE_ERRORS

Confirm to begin? (yes / edit / cancel)
```

**Handle user response:**
- **If user approves:** proceed to step 5
- **If user requests changes:** return to step 2 to re-gather the modified parameters (stay in Plan Mode). If the error command changed, re-run it for a new baseline (step 3). Re-show the revised configuration and confirm again.
- **If user cancels:** Exit Plan Mode via `ExitPlanMode` and stop — do not start the fix loop.

## Step 5: Exit Plan Mode

Call `ExitPlanMode`. Begin the fix loop.

Initialize: `$ITERATION = 0`, `$ERRORS_FIXED = 0`, `$RESISTANT_ERRORS = []`, `$CURRENT_ERRORS = $BASELINE_ERRORS`.

## Step 6: Fix Loop

Repeat until zero errors remain, budget exhausted, or all remaining errors are resistant:

Increment `$ITERATION`.

### Phase 1 — Run

Execute the error command, capture full output:

```bash
$ERROR_CMD 2>&1
```

Store the complete output.

### Phase 2 — Parse

Extract individual errors from the output. For each error, capture:
- File path
- Line number
- Error message / code
- Error type (if available)

Store as a list of structured errors.

### Phase 3 — Prioritize

Pick ONE error to fix. Priority order:

1. **Blocking errors** — errors that prevent other code from being parsed/compiled (syntax errors, import failures)
2. **Cascading errors** — errors that likely cause multiple downstream errors (fixing one may resolve several)
3. **Simplest errors** — errors with clear, mechanical fixes (missing imports, type mismatches, unused variables)
4. **Skip resistant errors** — errors already in `$RESISTANT_ERRORS` list (revisit later)

Store the selected error as `$TARGET_ERROR`.

### Phase 4 — Analyze

Read the relevant code around `$TARGET_ERROR`:
- The file and surrounding lines
- Related imports, types, and dependencies

Understand the root cause. If the error is non-obvious, invoke the `systematic-debugging` skill to trace the root cause.

### Phase 5 — Fix

Make the minimal change to resolve `$TARGET_ERROR`:
- Never modify test files or guard files
- Prefer the smallest correct fix over a comprehensive refactor
- Stay within `$SCOPE`

### Phase 6 — Commit

Create an atomic commit:

```bash
git add -A
git commit -m "fix($SCOPE): $ERROR_DESCRIPTION"
```

### Phase 7 — Verify

Re-run the error command:

```bash
$ERROR_CMD 2>&1
```

Parse the new error count. Store as `$NEW_ERROR_COUNT`.

- **If the targeted error is gone AND no new errors introduced:** proceed to Phase 8
- **If the fix introduced new errors:** revert and log failure:
  ```bash
  git revert HEAD --no-edit
  ```
  Record the attempt in `$ATTEMPT_TRACKER[$TARGET_ERROR]`. Increment attempt count. Try a different approach on the next iteration.
- **If the targeted error persists:** revert and log failure:
  ```bash
  git revert HEAD --no-edit
  ```
  Record the attempt in `$ATTEMPT_TRACKER[$TARGET_ERROR]`. Increment attempt count.

### Phase 8 — Guard

If a guard command is configured, run it:

```bash
$GUARD_CMD
```

- **Guard passes:** proceed to Phase 9
- **Guard fails:** attempt rework (max 2 attempts). Modify the fix to resolve the guard regression while still fixing the original error.
  - If rework succeeds: proceed to Phase 9
  - If rework fails after 2 attempts: revert the fix and skip this error:
    ```bash
    git revert HEAD --no-edit
    ```
    Add `$TARGET_ERROR` to `$RESISTANT_ERRORS`.

### Phase 9 — Log

Append result to TSV file (`.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`):

```
{date}	$ITERATION	$TARGET_ERROR	$CURRENT_ERRORS	$NEW_ERROR_COUNT	$COMMIT_HASH	$NOTES
```

Update counters:
- If fix was kept: `$ERRORS_FIXED++`, `$CURRENT_ERRORS = $NEW_ERROR_COUNT`
- If fix was reverted: `$CURRENT_ERRORS` unchanged

### Phase 10 — Progress

Display current progress:

```
Iteration $ITERATION/$BUDGET
  Error fixed: $TARGET_ERROR
  Errors remaining: $CURRENT_ERRORS (started at $BASELINE_ERRORS)
  Fixed this session: $ERRORS_FIXED
  Resistant errors: {count of $RESISTANT_ERRORS}
```

Continue to next iteration.

---

## Step 7: Stuck Detection

If the same error persists after 3 fix attempts with different approaches (`$ATTEMPT_TRACKER[$TARGET_ERROR] >= 3`):

1. **Log as resistant** — add to `$RESISTANT_ERRORS` list with all attempted approaches
2. **Skip** — move to the next error in the priority queue
3. **Revisit** — after all other errors are addressed, revisit resistant errors with full context:
   - Re-read the entire file and its dependencies
   - Consider if earlier fixes changed the context enough to make the error fixable now
   - Try one more approach per resistant error
4. **Escalate** — if still stuck, create a GitHub Issue for each resistant error:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github create-issue \
  --title "fix-loop: resistant error in $FILE:$LINE" \
  --label "type:bug" --label "maxsim:auto" \
  --body "## Resistant Error\n\n**Error:** $ERROR_MESSAGE\n**File:** $FILE:$LINE\n\n## Approaches Tried\n{list of 3+ approaches attempted}\n\n## Context\nThis error persisted after $ATTEMPT_COUNT fix attempts during an autonomous fix-loop session."
```

---

## Step 8: Termination

Stop the loop when any of these conditions is met:

- **Zero errors:** `$CURRENT_ERRORS == 0`
- **Budget exhausted:** `$ITERATION >= $BUDGET`
- **All resistant:** all remaining errors are in `$RESISTANT_ERRORS` and have been revisited
- **User interrupt:** Ctrl+C

## Step 9: Final Report

Display a summary:

```
## Fix Loop Complete

Error command: $ERROR_CMD
Total errors at start: $BASELINE_ERRORS
Errors fixed: $ERRORS_FIXED
Errors remaining: $CURRENT_ERRORS
Iterations used: $ITERATION / $BUDGET

### Resistant Errors (if any)
{For each resistant error: file, line, message, approaches tried}

### Fix Log
File: .claude/agent-memory/maxsim-learner/autoresearch-results.tsv
```

</process>

<success_criteria>
- [ ] Plan Mode entered before setup
- [ ] Error command, guard command, budget, and scope gathered via AskUserQuestion
- [ ] Baseline error count established by running the error command
- [ ] Configuration confirmed by user before loop starts
- [ ] Plan Mode exited before loop execution
- [ ] Each iteration follows all 10 phases: Run, Parse, Prioritize, Analyze, Fix, Commit, Verify, Guard, Log, Progress
- [ ] ONE error fixed per iteration
- [ ] Failed fixes are always reverted with `git revert HEAD --no-edit`
- [ ] Guard/test files are never modified
- [ ] TSV log appended after each iteration
- [ ] Stuck detection triggers after 3 failed attempts on the same error
- [ ] Resistant errors are skipped, revisited later, then escalated if still stuck
- [ ] Loop terminates on zero errors, budget exhaustion, all-resistant, or user interrupt
- [ ] Final report displays summary with resistant errors listed
</success_criteria>
</output>
