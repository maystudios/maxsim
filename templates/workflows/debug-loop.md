<!-- GITHUB-ONLY: All state lives on GitHub. No local .planning/ directory. -->
<!-- CONSTRAINT: Use Agent tool (NOT Task). -->

<purpose>
Autonomous bug hunting using the scientific method. Reproduces the symptom, forms hypotheses, tests each hypothesis, fixes confirmed root causes, and verifies the fix. Loops until the bug is resolved or all hypotheses are exhausted. Debug sessions are tracked as GitHub Issues (label: `debug`). Results are tracked in `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`.
</purpose>

<process>

## Step 1: Enter Plan Mode

Call `EnterPlanMode` to begin setup.

## Step 2: Gather Symptom Details

Ask via `AskUserQuestion`:

1. **Symptom** — what is the observed incorrect behavior (pre-fill from `$ARGUMENTS` if provided)
2. **Expected behavior** — what should happen instead
3. **Reproduction steps** — how to trigger the bug (sequence of actions)
4. **Reproduction command** — a single command that demonstrates the bug (e.g., `npm test -- --grep "failing test"`, `node src/index.js --input bad-data`)
5. **Scope** — which files/directories are likely involved (or "unknown" for broad search)

Store as `$SYMPTOM`, `$EXPECTED`, `$REPRO_STEPS`, `$REPRO_CMD`, `$SCOPE`.

## Step 3: Initial Reproduction

Attempt to reproduce the bug by running the reproduction command:

```bash
$REPRO_CMD
```

Capture the exact output (error messages, stack traces, exit codes). Store as `$REPRO_OUTPUT`.

- **If the bug reproduces:** confirm and proceed
- **If the bug does NOT reproduce:** inform the user. Ask for more context or a different reproduction command. Re-attempt. If still not reproducible after 2 attempts, note the intermittent nature and proceed with caution.

## Step 4: Create GitHub Issue

Create a GitHub Issue labeled `debug` to track the session:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Debug Session

**Symptom:** $SYMPTOM
**Expected:** $EXPECTED
**Reproduction steps:** $REPRO_STEPS
**Reproduction command:** `$REPRO_CMD`
**Scope:** $SCOPE

### Initial Reproduction
```
$REPRO_OUTPUT
```
BODY_EOF
gh issue create \
  --title "debug: $SYMPTOM" \
  --label "debug" \
  --body-file "$TMPFILE"
```

Parse the response for the issue number. Store as `$ISSUE_NUM`.

## Step 5: Confirm Investigation Plan

Display the investigation plan:

```
## Debug Session #$ISSUE_NUM

Symptom: $SYMPTOM
Reproduced: {yes/no}
Scope: $SCOPE
Reproduction command: $REPRO_CMD

Investigation approach:
  1. Reproduce — run reproduction command, capture exact error
  2. Hypothesize — form ONE hypothesis with evidence
  3. Test — design minimal experiment to confirm or reject
  4. Evaluate — confirmed → fix; rejected → next hypothesis
  5. Fix — minimal fix for confirmed root cause
  6. Verify — reproduction command passes, no regressions
  7. Log — record result to TSV

Confirm to begin? (yes / edit / cancel)
```

**Handle user response:**
- **If user approves:** proceed to step 6
- **If user requests changes:** revise the relevant parameters (scope, reproduction command, investigation approach). If the reproduction command changed, re-attempt reproduction (step 3). Update the GitHub Issue body with the revised plan. Return to step 5 (stay in Plan Mode).
- **If user cancels:** close the GitHub Issue (`gh issue close $ISSUE_NUM --comment "Debug session cancelled by user before investigation began"`), Exit Plan Mode via `ExitPlanMode`, and stop.

## Step 6: Exit Plan Mode

Call `ExitPlanMode`. Begin the debug loop.

Initialize: `$HYPOTHESIS_COUNT = 0`, `$HYPOTHESES_TESTED = []`, `$ITERATION = 0`.

## Step 7: Debug Loop

Repeat until the bug is fixed or hypotheses are exhausted:

Increment `$ITERATION`.

### Phase 1 — Reproduce

Run the reproduction command and capture the exact error output:

```bash
$REPRO_CMD 2>&1
```

Store as `$CURRENT_OUTPUT`.

- **If reproducible:** continue to Phase 2
- **If not reproducible:** the bug may have been fixed by a previous iteration or may be intermittent. Gather more data:
  - Check environment state
  - Check recent changes: `git log --oneline -5`
  - Try alternative reproduction approaches
  - If consistently not reproducible: the bug may be fixed — proceed to Phase 6 (Verify)

### Phase 2 — Hypothesize

Form ONE clear hypothesis. State it explicitly:

> "I think **X** is the root cause because **Y**."

Evidence gathering:
- Read error messages completely (stack traces, line numbers, exit codes)
- Check recent changes: `git diff`, `git log --oneline -10`
- Trace data flow from the symptom back to its origin
- Review related code in `$SCOPE`

Rules:
- Do NOT reuse a previously disproven hypothesis (check `$HYPOTHESES_TESTED`)
- Each hypothesis must be distinct and testable
- Base the hypothesis on evidence, not guesswork

Increment `$HYPOTHESIS_COUNT`.

### Phase 3 — Test Hypothesis

Design a minimal experiment to confirm or reject the hypothesis:

> "If **X** is the cause, then changing **Z** should produce **W**."

Make the smallest possible change to test:
- Add diagnostic logging
- Add an assertion
- Make a minimal code change
- Comment out suspected code

Run the experiment and compare expected vs. actual result.

### Phase 4 — Evaluate

Did the test confirm the hypothesis?

- **Confirmed:** the hypothesis is the root cause. Record as confirmed in `$HYPOTHESES_TESTED`. Proceed to Phase 5 (Fix).
- **Rejected:** the hypothesis is disproven. Record as rejected in `$HYPOTHESES_TESTED` with evidence. Clean up any diagnostic changes. Return to Phase 2 with a new hypothesis.

### Phase 5 — Fix

Implement the minimal fix for the confirmed root cause:

1. **Write a failing test** that reproduces the bug (when applicable and a test framework exists)
2. **Implement the fix** — address ONLY the identified root cause. No "while I'm here" changes.
3. **Commit:**
   ```bash
   git add -A
   git commit -m "fix($SCOPE): $ROOT_CAUSE_DESCRIPTION"
   ```

### Phase 6 — Verify

Run the reproduction command — the bug must be gone:

```bash
$REPRO_CMD
```

Run the full test suite — no regressions:

```bash
npm test  # or the project's test command
```

- **Bug fixed AND no regressions:** proceed to Phase 7
- **Bug fixed BUT regressions introduced:** rework the fix or revert:
  ```bash
  git revert HEAD --no-edit
  ```
  Return to Phase 5 with a different fix approach.
- **Bug NOT fixed:** revert and return to Phase 2:
  ```bash
  git revert HEAD --no-edit
  ```

### Phase 7 — Log

Append result to TSV file (`.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`):

```
{date}	$ITERATION	$HYPOTHESIS	{confirmed/rejected}	{fix-applied: yes/no}	$COMMIT_HASH	$NOTES
```

Post a progress comment to the GitHub Issue:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Iteration $ITERATION

**Hypothesis:** $HYPOTHESIS
**Result:** {confirmed/rejected}
**Evidence:** {what was observed}
**Fix applied:** {yes/no — if yes, commit $COMMIT_HASH}
<!-- maxsim:type=checkpoint -->
BODY_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $ISSUE_NUM --body-file "$TMPFILE" --type checkpoint
```

Continue to next iteration (if bug not yet fixed).

---

## Step 8: Hypothesis Exhaustion

If 5+ hypotheses have been tested and rejected (`$HYPOTHESIS_COUNT >= 5` with no confirmed root cause):

1. **Fresh eyes** — re-read ALL potentially involved files from scratch, ignoring previous assumptions
2. **Environmental factors** — check configuration files, dependency versions, OS-specific behavior, environment variables
3. **Git bisect** — use `git bisect` to find the introducing commit:
   ```bash
   git bisect start
   git bisect bad HEAD
   git bisect good {last known good commit}
   # Run bisect with the reproduction command
   git bisect run $REPRO_CMD
   ```
4. **Escalate** — if still stuck, update the GitHub debug Issue with all findings and escalate to the user:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Escalation — Hypotheses Exhausted

$HYPOTHESIS_COUNT hypotheses tested, none confirmed as root cause.

### Hypotheses Tested
{For each hypothesis: statement, test, result, evidence}

### What Has Been Eliminated
{Summary of disproven causes}

### Suggested Next Steps
- Manual investigation with domain knowledge
- Check for environmental/configuration differences
- Consider if the bug is in a dependency
<!-- maxsim:type=escalation -->
BODY_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $ISSUE_NUM --body-file "$TMPFILE" --type escalation
```

---

## Step 9: Termination

Stop the loop when any of these conditions is met:

- **Bug confirmed fixed:** reproduction command passes, no regressions
- **Hypotheses exhausted:** 5+ hypotheses tested and rejected, recovery strategies tried
- **User interrupt:** Ctrl+C

## Step 10: Final Report

Display a summary:

```
## Debug Session Complete

Issue: #$ISSUE_NUM — $SYMPTOM
Root cause found: {yes/no}
Hypotheses tested: $HYPOTHESIS_COUNT
  Confirmed: {count}
  Rejected: {count}
Fix applied: {yes/no — commit $COMMIT_HASH}
Verification: {passed/failed}

### Hypothesis History
{For each hypothesis: statement → confirmed/rejected}
```

Close the GitHub debug Issue with the resolution summary:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Resolution

**Root cause:** {description or "not found"}
**Fix:** {description of fix applied}
**Commit:** $COMMIT_HASH
**Verification:** {passed/failed}

Hypotheses tested: $HYPOTHESIS_COUNT ({confirmed_count} confirmed, {rejected_count} rejected)
<!-- maxsim:type=summary -->
BODY_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $ISSUE_NUM --body-file "$TMPFILE" --type summary

gh issue close $ISSUE_NUM --comment "Debug session complete. Root cause: {found/not found}."
```

</process>

<success_criteria>
- [ ] Plan Mode entered before setup
- [ ] Symptom, expected behavior, reproduction steps, reproduction command, and scope gathered
- [ ] Initial reproduction attempted before starting the loop
- [ ] GitHub Issue created with label `debug` to track the session
- [ ] Investigation plan confirmed by user before loop starts
- [ ] Plan Mode exited before loop execution
- [ ] Each iteration follows all 7 phases: Reproduce, Hypothesize, Test, Evaluate, Fix, Verify, Log
- [ ] Each hypothesis is stated explicitly: "I think X because Y"
- [ ] Previously disproven hypotheses are never reused
- [ ] Fixes address only the confirmed root cause — no unrelated changes
- [ ] Failed fixes are reverted with `git revert HEAD --no-edit`
- [ ] TSV log appended after each iteration
- [ ] Progress comments posted to GitHub Issue after each iteration
- [ ] Hypothesis exhaustion triggers after 5+ rejected hypotheses
- [ ] Git bisect used as a recovery strategy when hypotheses are exhausted
- [ ] Loop terminates on bug fixed, hypotheses exhausted, or user interrupt
- [ ] GitHub Issue closed with resolution summary
</success_criteria>
</output>
