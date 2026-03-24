---
name: maxsim:debug-loop
description: Autonomous bug hunting — scientific method with hypothesis testing
argument-hint: "[symptom]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode]
---

<objective>
Autonomously hunt down bugs using the scientific method: reproduce the symptom, form hypotheses, test each hypothesis, fix confirmed root causes, and verify the fix. Loop until the bug is resolved or all hypotheses are exhausted.
</objective>

<context>
Arguments: $ARGUMENTS

If $ARGUMENTS is provided, treat it as the symptom description.

GitHub is the sole source of truth. Debug sessions are tracked as GitHub Issues (label: `debug`). Results are tracked in `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`.

This command uses Plan Mode to gather symptom details before autonomous investigation begins.
</context>

<process>
Invoke the `autoresearch` skill (debug workflow) to drive the investigation loop. Invoke the `systematic-debugging` skill for the reproduce-hypothesize-isolate-verify-fix cycle at each iteration.

**Phase 1 — Setup (Plan Mode)**

1. Enter Plan Mode via EnterPlanMode
2. Gather symptom details via AskUserQuestion:
   - **Symptom** — what is the observed incorrect behavior (from $ARGUMENTS or ask)
   - **Expected behavior** — what should happen instead
   - **Reproduction steps** — how to trigger the bug (command, input, sequence)
   - **Reproduction command** — a single command that demonstrates the bug (e.g., `npm test -- --grep "failing test"`)
   - **Scope** — which files/directories are likely involved (or "unknown")
3. Attempt initial reproduction — run the reproduction command to confirm the bug exists
4. Create a GitHub Issue labeled `debug` to track the session
5. Show the investigation plan and confirm with user
6. Exit Plan Mode via ExitPlanMode

**Phase 2 — Debug Loop**

Repeat until the bug is fixed or hypotheses are exhausted:

1. **Reproduce** — run the reproduction command, capture the exact error output
   - If not reproducible: gather more data, check environment, check recent changes
2. **Hypothesize** — form ONE clear hypothesis: "I think X is the root cause because Y"
   - Read error messages completely (stack traces, line numbers, exit codes)
   - Check recent changes: `git diff`, `git log --oneline -10`
   - Trace data flow from symptom back to origin
   - Do NOT reuse a previously disproven hypothesis
3. **Test Hypothesis** — design a minimal experiment to confirm or reject
   - "If X is the cause, then changing Z should produce W"
   - Make the smallest possible change to test (diagnostic logging, assertion, minimal code change)
   - Run the experiment and compare expected vs. actual result
4. **Evaluate** — did the test confirm the hypothesis?
   - **Confirmed** → proceed to Fix
   - **Rejected** → log the disproven hypothesis, return to step 2 with a new hypothesis
5. **Fix** — implement the minimal fix addressing the confirmed root cause
   - Write a failing test that reproduces the bug (when applicable)
   - Fix only the identified issue — no "while I'm here" changes
   - Commit with message `fix(<scope>): <root-cause-description>`
6. **Verify** — run the reproduction command: the bug must be gone
   - Run the full test suite: no regressions
   - If fix introduced regressions → rework or `git revert HEAD --no-edit`
7. **Log** — append result to TSV (date, iteration, hypothesis, confirmed/rejected, fix-applied, commit-hash, notes)

**Hypothesis Exhaustion:**
If 5+ hypotheses have been tested and rejected:
1. Re-read ALL potentially involved files with fresh eyes
2. Check for environmental factors (config, dependencies, OS-specific)
3. Try bisecting with `git bisect` to find the introducing commit
4. If still stuck → update the GitHub debug Issue with all findings and escalate to user

**Termination:**
Stop when the bug is confirmed fixed, all hypotheses are exhausted, or user interrupts (Ctrl+C).

**Final Report:**
Display a summary: root cause found (yes/no), hypotheses tested (confirmed/rejected), fix applied, verification evidence. Close the GitHub debug Issue with the resolution summary.
</process>
