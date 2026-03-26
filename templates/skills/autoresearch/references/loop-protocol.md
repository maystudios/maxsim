# Autonomous Loop Protocol

Detailed protocol for the optimization iteration loop. The index.md has the summary; this file has the full rules.

## Loop Modes

- **Unbounded (default):** Loop forever until manually interrupted.
- **Bounded:** Loop exactly N times when `Iterations: N` is set in the inline config.

When bounded, the agent tracks `current_iteration` against `max_iterations`. After the final iteration, it prints a summary and stops.

## Phase 0: Precondition Checks

The agent completes all checks before entering the loop. It fails fast if any check fails.

1. Verify git repo exists (`git rev-parse --git-dir`).
2. Check for dirty working tree (`git status --porcelain`). If dirty, warn user and ask to stash or commit first.
3. Check for stale lock files (`.git/index.lock`).
4. Check for detached HEAD (`git symbolic-ref HEAD`).
5. Check for git hooks that might interfere (pre-commit, husky, pre-commit framework).

If any FAIL: stop and inform user. If any WARN: log the warning, proceed with caution.

## Phase 1: Review

Before each iteration, the agent builds situational awareness by completing all 6 steps:

1. Read current state of in-scope files (full context).
2. Read last 10-20 entries from results log.
3. Run `git log --oneline -20` to see recent changes.
4. Run `git diff HEAD~1` (if last iteration was "keep") to review what worked.
5. Identify what worked, what failed, what is untried — based on both results log and git history.
6. If bounded: check current_iteration vs max_iterations.

Git history is critical. After rollbacks, state may differ from expectations. The git log shows which experiments were kept vs reverted. The git diff of kept changes reveals what specifically improved the metric.

## Phase 2: Ideate

The agent picks the next change by consulting git history and results log first.

**Priority order:**
1. Fix crashes/failures from previous iteration first.
2. Exploit successes — run `git diff` on last kept commit, try variants in same direction.
3. Explore new approaches — cross-reference results log and git history for untried approaches.
4. Combine near-misses — two changes that individually did not help might work together.
5. Simplify — remove code while maintaining metric.
6. Radical experiments — when incremental changes stall, try something dramatically different.

**Anti-patterns:** Do not repeat an exact change that was already discarded. Do not make multiple unrelated changes at once. Do not chase marginal gains with ugly complexity.

## Phase 3: Modify (One Atomic Change)

- Make ONE focused change to in-scope files.
- The change should be explainable in one sentence.
- Write the description BEFORE making the change.

One logical change may span multiple files if it serves a single purpose. The one-sentence test: if you need "and" to describe it, it is two changes — split them.

## Phase 4: Commit (Before Verification)

The agent commits before running verification to enable clean rollback.

```bash
git add <file1> <file2> ...
git diff --cached --quiet  # exit 0 = no changes, skip commit
git commit -m "experiment(<scope>): <description>"
```

Rules:
- Never use `git add -A` — stage only specific in-scope files.
- If no staged changes: log as `no-op`, skip verification, proceed to next iteration.
- Use conventional commit format with `experiment` type.
- If a pre-commit hook blocks the commit: fix the issue and retry (max 2 attempts). Never use `--no-verify`.

**Rollback strategy:**
```bash
# Preferred: git revert (preserves history)
git revert HEAD --no-edit

# Fallback if revert conflicts:
git revert --abort && git reset --hard HEAD~1
```

Prefer `git revert` over `git reset --hard` because revert preserves the experiment in history for learning.

## Phase 5: Verify (Mechanical Only)

Run the agreed-upon verification command. Capture output. Extract the metric number.

If verification exceeds 2x normal time, kill and treat as crash.

### Noise Handling (for Volatile Metrics)

Some metrics are inherently noisy (benchmark times, ML accuracy). Strategies:

- **For improvements of 1–5%:** Run the verify command 3 times and use the median result.
- **For improvements >5%:** Run the verify command 5 times and use the median result.
- **Minimum improvement threshold:** Ignore improvements smaller than the noise floor (typically 0.5% for benchmarks).
- **Confirmation run:** After accepting an improvement, re-verify once more before making the final keep decision.
- **Environment pinning:** Pin random seeds, use deterministic test ordering, flush caches between runs.

## Phase 5.5: Guard (Regression Check)

If a guard command was defined, the agent runs it after verification.

- **Verify** answers: "Did the metric improve?"
- **Guard** answers: "Did anything else break?"

Guard rules:
- Run only if a guard was defined.
- Run after verify — no point checking guard if the metric did not improve.
- Pass/fail only (exit code 0 = pass).
- If guard fails, revert and rework (max 2 attempts).
- Never modify guard/test files — adapt the implementation instead.

## Phase 6: Decide

```
IF metric_improved AND (no guard OR guard_passed):
    STATUS = "keep"
ELIF metric_improved AND guard_failed:
    Revert, then rework (max 2 attempts)
    If still failing after 2 attempts: STATUS = "discard"
ELIF metric_same_or_worse:
    STATUS = "discard" — revert
ELIF crashed:
    Attempt fix (max 3 tries), else STATUS = "crash" — revert
```

**Simplicity override:** If metric barely improved (+<0.1%) but the change adds significant complexity, treat as "discard". If metric is unchanged but code is simpler, treat as "keep".

## Phase 7: Log Results

Append to results log (TSV format). See `results-logging.md` for the full protocol.

Valid statuses: `keep`, `keep (reworked)`, `discard`, `crash`, `no-op`, `hook-blocked`.

## Phase 8: Repeat

### Unbounded Mode (default)

Go to Phase 1. Never stop. Never ask if the agent should continue.

### Bounded Mode

```
IF current_iteration < max_iterations:
    Go to Phase 1
ELIF goal_achieved:
    Print early completion, print final summary, STOP
ELSE:
    Print final summary, STOP
```

**Final summary format:**
```
=== Optimization Complete (N/N iterations) ===
Baseline: {baseline} → Final: {current} ({delta})
Keeps: X | Discards: Y | Crashes: Z | Skipped: W
Best iteration: #{n} — {description}
```

### When Stuck (5 consecutive discards or crashes (status=discard or status=crash))

1. Re-read all in-scope files from scratch.
2. Re-read the original goal/direction.
3. Review entire results log for patterns.
4. Try combining 2-3 previously successful changes.
5. Try the opposite of what has not been working.
6. Try a radical architectural change.
7. **Escalate** — If still stuck after all above: create a diagnostic GitHub Issue (`gh issue create --label "type:bug" --label "maxsim:auto" --title "Stuck: [scope] after [N] consecutive failures" --body "[full context: iterations attempted, approaches tried, current metric value, TSV log summary, suspected blockers]"`) and escalate to the user. Do not continue the loop — wait for human guidance.

## Crash Recovery

- Syntax error: fix immediately, do not count as separate iteration.
- Runtime error: attempt fix (max 3 tries), then move on.
- Resource exhaustion (OOM): revert, try smaller variant.
- Infinite loop/hang: kill after timeout, revert, avoid that approach.
- External dependency failure: skip, log, try different approach.

## Communication

- Do not ask "should I keep going?" In unbounded mode, always continue. In bounded mode, continue until N is reached.
- Do not summarize after each iteration — just log and continue.
- Print a brief one-line status every ~5 iterations.
- Alert if something surprising or game-changing is discovered.
- Print a final summary when bounded loop completes.
