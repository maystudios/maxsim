# MaxsimCLI Self-Improvement Guide
## Adapting the Autoresearch Pattern to Project Orchestration

> **Status:** Reference Specification
> **Scope:** How MaxsimCLI implements and extends the autoresearch self-improvement loop
> **Source pattern:** Karpathy autoresearch (March 6, 2026) → Udit Goenka generalization (March 13, 2026) → MaxsimCLI adaptation

---

## 1. Origin: The Karpathy Loop

On March 6, 2026, Andrej Karpathy released `autoresearch` — a 630-line Python script that ran autonomous ML experiments on a single GPU. The concept was deliberately minimal:

- Fix everything except one target file (`train.py`)
- Define a single mechanical metric (`val_bpb` — validation bits per byte, lower is better)
- Give each experiment a fixed budget (5 minutes of training)
- Let an AI agent modify, run, evaluate, and repeat — forever

Running for two days, the system produced 700 experiments and found 20 compounding optimizations — an 11% speedup — without any human intervention between iterations.

The formula Karpathy demonstrated:

```
constraint + mechanical metric + autonomous iteration = compounding gains
```

The insight was not about ML. The insight was about _loops_. Any domain with a measurable outcome and a modifiable target can be improved this way. Udit Goenka generalized it into a Claude Code skill one week later.

MaxsimCLI adapts this pattern for project management, not just code optimization. This document explains every technical component and how to apply it.

---

## 2. The 8-Phase Improvement Loop

The autoresearch loop has eight phases that repeat indefinitely (or for N bounded iterations). Understanding each phase precisely is required to adapt it correctly.

### Phase 0: Preconditions

Before the loop starts, verify the environment is clean:

- Git repository is in a clean state (no dirty working tree)
- No stale lock files
- No detached HEAD state
- No interfering git hooks that would block commits

This is a one-time gate before Phase 1 begins. A dirty tree at loop start means results cannot be attributed to specific changes.

### Phase 1: Review State

Build situational awareness before doing anything:

```bash
git log --oneline -20          # What has been tried
git diff HEAD~1                # What specifically changed last iteration
cat autoresearch-results.tsv   # Read last 10-20 entries for patterns
```

This is the "Git as Memory" phase. The agent reads the history of experiments to inform what to try next. Reading git history is not optional — it is the mechanism that prevents repeating failed experiments and helps identify what files and techniques are driving success.

Pattern recognition from the log:
- Which file changes correlate with improvements?
- Which approaches have been tried and discarded?
- Are there near-misses that could be combined?
- Is there a pattern in what crashed vs. what succeeded?

### Phase 2: Ideate (Select Next Change)

Given the review, select the next experiment. The priority order:

1. **Fix crashes** — Any crash from the previous iteration takes priority
2. **Exploit successes** — If Phase 1 revealed a pattern (e.g., changes to `verify.ts` improved the metric), try a variant
3. **Explore untried approaches** — Things the log shows have not been attempted
4. **Combine near-misses** — Two discarded changes that each got close might work together
5. **Simplify** — If two approaches produce equal results, choose the simpler one
6. **Radical experiment** — When stuck, try something fundamentally different from all previous attempts

### Phase 3: Modify (Make One Atomic Change)

Make exactly one focused change. The atomicity constraint is enforced by the **one-sentence test**:

> If you cannot describe the change in one sentence without the word "and" linking unrelated actions, it is not atomic.

Examples:

| Change | Atomic? | Reason |
|--------|---------|--------|
| "Reduce timeout from 30s to 15s" | Yes | Single parameter change |
| "Add retry logic and refactor error handling" | No | Two independent concerns |
| "Update port in Dockerfile, docker-compose.yml, and nginx.conf" | Yes | One logical change across 3 files |
| "Fix the null check and improve the error message" | No | Two separate fixes |

Multi-file changes are permitted if they serve a single logical purpose. The test is intent, not file count. If modifying more than 5 files, re-evaluate: can the one-sentence test still be passed without "and"?

### Phase 4: Commit (Before Verification)

Commit the change before running the verification command. This is counterintuitive but critical:

- The commit becomes the revert target if the change fails
- The git history records what was tried even if discarded
- Commit message format: `experiment(<scope>): <one-sentence description>`
- Stage only in-scope files explicitly — never `git add -A`
- Never bypass hooks with `--no-verify`

### Phase 5: Verify (Run the Mechanical Metric)

Execute the agreed verification command. Extract the metric value. Rules:

- Kill the verification process if it exceeds 2× its normal duration (hang detection)
- The metric must be a single parseable number
- The verification command must be deterministic and run in under 30 seconds
- Never use subjective assessment ("looks better", "seems faster") — only the number

### Phase 5.1: Noise Handling

Some metrics are volatile — they fluctuate between runs even without code changes (benchmark timings, flaky tests, network-dependent checks). When a metric is known to be volatile, apply one or more of these strategies:

**Multi-run median:** Run verification 3 times, take the median. This eliminates outlier runs.

**Minimum-delta threshold:** Only treat a change as an improvement if the delta exceeds a threshold (e.g., >2% improvement for timing metrics, not just >0%).

**Confirmation run:** If a change appears to improve the metric, run verification a second time to confirm the improvement holds.

**Environment pinning:** Fix CPU frequency, disable background processes, pin Node.js version — anything that reduces environmental variance.

The key diagnostic question: "Would running verification twice on the same code produce the same number?" If the answer is no, noise handling is required before the loop will produce reliable keep/discard decisions.

### Phase 5.5: Guard (Regression Prevention)

If a Guard command was defined, run it after Verify passes. The Guard is a secondary verification that checks nothing was broken while the primary metric was being optimized.

Decision logic for Guard failure:
1. Attempt to rework the change (keep the improvement, fix the regression) — up to 2 rework attempts
2. If rework fails twice, discard the change entirely (even though Verify passed)

The Guard prevents the classic optimization trap: making one thing faster while silently breaking another.

### Phase 6: Decide (Keep or Discard)

The decision is mechanical and binary:

| Verify Result | Guard Result | Decision |
|---------------|-------------|---------|
| Improved | Pass (or no guard) | KEEP — commit stands |
| Improved | Fail | REWORK (max 2 attempts), then DISCARD |
| Same / Worse | — | DISCARD — revert immediately |
| Crashed | — | See crash recovery tiers |

**Reversion preference:** Always use `git revert` over `git reset --hard`. Revert creates a new commit that undoes the change, preserving the failed experiment in history for Phase 1 pattern analysis. `git reset --hard` destroys history and reduces what the loop can learn from.

**Simplicity override:** If two changes produce identical metric values, keep the simpler one. "Less code with equal results" beats "more code with marginally better results". This prevents the loop from accumulating complexity over time.

### Phase 7: Log Results

Append to `autoresearch-results.tsv` after every iteration — including discards and crashes. The format:

```tsv
# metric_direction: lower_is_better
iteration	commit	metric	delta	guard	status	description
0	abc1234	847	0	-	baseline	Initial measurement
1	def5678	831	-16	pass	keep	Reduce verification timeout from 30s to 15s
2	-	852	+5	-	discard	Add parallel verification workers
3	ghi9012	-	-	-	crash	Refactor config loader (syntax error, fixed)
4	jkl3456	829	-2	pass	keep	Remove redundant file reads in state loader
```

Column definitions:

| Column | Type | Notes |
|--------|------|-------|
| `iteration` | Integer | Sequential from 0 (baseline) |
| `commit` | Git hash or `-` | `-` when reverted |
| `metric` | Number | The raw verification output |
| `delta` | Signed number | Change from previous best (not previous iteration) |
| `guard` | `pass`, `fail`, or `-` | `-` when no guard defined |
| `status` | Enum | `baseline`, `keep`, `keep-reworked`, `discard`, `crash`, `no-op`, `hook-blocked` |
| `description` | String | One-sentence change summary |

The header comment `# metric_direction: lower_is_better` or `# metric_direction: higher_is_better` must appear at the top so Phase 1 review can correctly interpret the delta column.

Add `autoresearch-results.tsv` to `.gitignore` — this file is local to the session and machine, not shared state.

### Phase 8: Continue (Repeat or Stop)

**Unbounded mode:** Loop back to Phase 1 without asking. Never prompt the user for permission to continue. Print a status checkpoint every ~5 iterations. Flag surprising discoveries immediately.

**Bounded mode (Iterations: N):** After exactly N iterations, print a final summary:
- Baseline → final metric delta
- Count of keep / discard / crash / skip
- Best iteration (number, commit, metric, description)
- Recommendations for further optimization

---

## 3. The Verify + Guard Dual-Command Pattern

The two-command pattern is the core of regression prevention:

```
Verify:  <command that measures what you want to improve>
Guard:   <command that ensures nothing else broke>
```

### Why Two Commands?

A single verification command can only measure one thing. When optimizing for that one thing, it is easy to accidentally degrade something else. The guard command acts as a safety net.

Example for MaxsimCLI:

```
Goal:    Reduce phase execution time
Verify:  time node maxsim-tools.cjs benchmark --phase execute
Guard:   npx vitest run --reporter=verbose
```

The Verify command measures how fast phase execution completes. The Guard command ensures all tests still pass. Optimizing execution speed should not be accepted if it breaks test coverage.

### Guard Failure Protocol

When Guard fails after Verify passes:
1. Examine exactly what the Guard command reported as failing
2. Attempt to rework the change — preserve the improvement, fix the regression
3. If rework attempt 1 fails, try a different approach
4. If rework attempt 2 fails, discard the entire change

The two-rework limit prevents infinite loops within a single iteration while giving a genuine chance to salvage an improvement.

### Choosing a Good Guard Command

The Guard command should:
- Run fast (under 30 seconds)
- Be deterministic (same result on same code)
- Cover the most critical existing functionality
- Exit with code 0 on pass, non-zero on failure

For MaxsimCLI projects: `npx vitest run` is the natural Guard command for almost all phases. It catches regressions across the full test suite.

---

## 4. Git as Memory

Git history is the loop's long-term memory. This is not a metaphor — it is a literal mechanism for preventing the agent from repeating failed experiments and for identifying successful patterns.

### Reading Protocol

At the start of every iteration (Phase 1):

```bash
git log --oneline -20                    # See what was tried
git diff HEAD~1                          # What changed in the last kept commit
git log --oneline --grep="experiment:"   # All experiment commits
git log --oneline --grep="Revert"        # All reverted experiments
```

### Pattern Analysis

From the log, extract patterns:
- "Three of the last five kept commits touched `core/verify.ts` — focus there"
- "Every attempt to reduce parallelism was discarded — don't try that again"
- "Two near-miss discards both tried async reads — combining them might work"

### Commit Message Convention

All autoresearch commits use the prefix `experiment(<scope>):` to make them identifiable in the log:

```
experiment(verify): reduce timeout threshold from 30s to 15s
experiment(state): replace synchronous file reads with lazy loading
experiment(phase): batch GitHub API calls instead of sequential
```

Reverts of failed experiments create entries like:
```
Revert "experiment(phase): batch GitHub API calls instead of sequential"
```

The Revert entries are as valuable as the kept entries — they tell the loop what not to retry.

### Why `git revert` Over `git reset --hard`

`git reset --hard` destroys the failed commit. The crash/discard becomes invisible to Phase 1 pattern analysis. `git revert` creates a new commit that shows the attempt and the reversal. The loop learns from both. Prefer revert except when the working tree itself is corrupted (syntax error before commit, etc.).

---

## 5. TSV Results Log — Complete Specification

### File Location and Lifecycle

- Path: `autoresearch-results.tsv` (project root)
- Created during Phase 0 setup, before the first iteration
- Added to `.gitignore` immediately on creation
- Iteration 0 is always the baseline measurement
- Append-only — never delete or rewrite entries

### Exact Column Format

```
iteration[TAB]commit[TAB]metric[TAB]delta[TAB]guard[TAB]status[TAB]description
```

Tab-separated, not comma-separated. No quotes around fields. One row per iteration.

### Status Values

| Status | Meaning |
|--------|---------|
| `baseline` | Iteration 0 — initial measurement, no change |
| `keep` | Metric improved, guard passed, commit retained |
| `keep-reworked` | Guard initially failed, rework succeeded, commit retained |
| `discard` | Metric same or worse, commit reverted |
| `crash` | Verification process crashed or timed out |
| `no-op` | Change had no measurable effect (delta = 0) |
| `hook-blocked` | Pre-commit hook blocked the commit (counted as skip, fix required) |

### Stuck Detection

After appending each entry, check the last 5 status values. If all 5 are `discard` (or `crash`), trigger the recovery protocol:

1. Re-read all in-scope files completely
2. Re-read the original goal statement
3. Review the full results log for any pattern not yet exploited
4. Try combining two previously near-miss discarded changes
5. Attempt the conceptual opposite of what has been tried
6. Make a radical architectural shift — something qualitatively different from all previous experiments

The stuck threshold is 5, not 3 or 10. Below 5, a run of discards is normal exploration. Above 5, it is a signal that the current approach space is exhausted.

### Progress Summaries

Every 10 iterations, print a summary to stdout (not to the TSV):

```
=== Iteration 10 summary ===
Best so far: iteration 4 (metric: 829, delta: -18 from baseline)
Keep / Discard / Crash: 4 / 5 / 1
Top pattern: Changes to core/verify.ts drove 3 of 4 improvements
===
```

---

## 6. Bounded vs. Unbounded Iteration Modes

### Unbounded Mode (Default)

The loop runs forever until the user presses Ctrl+C. This is the default.

Behavioral rules in unbounded mode:
- Never ask "should I continue?" — always proceed to Phase 1
- Never print a summary after each iteration — log and proceed
- Print status checkpoints every ~5 iterations
- Flag surprising discoveries immediately (e.g., a radical experiment that dramatically improved the metric)

Use unbounded mode for open-ended optimization where the goal is "as good as possible" rather than "N improvements."

### Bounded Mode (Iterations: N)

Specify an iteration count to stop after exactly N iterations. The loop stops at N even if the metric is still improving. After N iterations, print the final summary and halt.

Use bounded mode when:
- You want to compare results from a fixed number of experiments (reproducible research)
- Token/cost budgeting is required (bounded = predictable cost)
- You want to run the loop as part of a CI pipeline with a fixed time budget
- Early validation: "Run 10 iterations to see if this metric is even improvable"

### Adaptive Bounded Mode (MaxsimCLI Extension)

MaxsimCLI adds a third mode: bounded with early completion. If the metric reaches a defined target before N iterations complete, the loop stops early and reports:

```
Goal achieved at iteration 7 of 20. Metric: 720 (target: 750). Stopping early.
```

This prevents wasting iterations after the objective is met.

---

## 7. Stuck Detection — Full Protocol

The 5-consecutive-discard threshold triggers a structured recovery, not a panic:

### Step 1: Full Context Refresh

Re-read every in-scope file from scratch. Do not rely on what was read at loop start. The agent's understanding of the current state may have drifted across iterations.

### Step 2: Goal Restatement

Re-read the original goal statement verbatim. Ask: "Is the current approach actually serving this goal, or has the loop drifted toward optimizing a proxy?"

### Step 3: Log Pattern Analysis

Review the complete results log, not just the last 5 entries. Look for:
- Which iterations produced the best metrics (not just which were kept)?
- What did the two best discarded attempts have in common?
- Are there any untried combinations visible in the log?

### Step 4: Combination Attempt

Pick the two discarded experiments that got closest to improvement. Combine them into a single atomic change. The combination is itself a new experiment.

### Step 5: Inversion

Take the most frequently tried direction and try the opposite. If all attempts reduced complexity, try adding structure. If all attempts increased parallelism, try sequential processing.

### Step 6: Radical Shift

Abandon the current approach space entirely. Make a qualitatively different change — not a variation on what was tried, but a fundamentally different mechanism. This resets the exploration to a new region of the solution space.

### Step 7: Declare Stuck (Human Escalation)

If the recovery protocol itself produces 5 more discards, escalate to the user. Create a GitHub Issue with the full results log and a summary of what was tried. Do not loop infinitely attempting variations of a dead-end approach.

---

## 8. Noise Handling for Volatile Metrics

### Diagnosing Volatility

Before starting the loop, measure the metric twice on the unchanged baseline. If the two measurements differ by more than ~2%, the metric is volatile and noise handling is required.

```bash
# Run baseline twice
time npx vitest bench --run    # First measurement: 847ms
time npx vitest bench --run    # Second measurement: 861ms
# Delta: ~1.6% — borderline, consider noise handling
```

### Strategy Selection

| Volatility Level | Strategy |
|-----------------|---------|
| <1% variance | No noise handling required |
| 1-5% variance | Use minimum-delta threshold (require >5% improvement) |
| 5-15% variance | Use multi-run median (3 runs) |
| >15% variance | Use multi-run median (5 runs) + environment pinning |
| Non-deterministic | Find a different metric — this one cannot drive reliable decisions |

### Multi-Run Median Implementation

```bash
# Run 3 times, extract median
R1=$(time_metric_command)
R2=$(time_metric_command)
R3=$(time_metric_command)
METRIC=$(echo "$R1 $R2 $R3" | tr ' ' '\n' | sort -n | sed -n '2p')
```

Record the median in the TSV, not any individual run.

### Minimum-Delta Threshold

Set the threshold based on observed baseline variance. If baseline fluctuates ±3%, require a measured improvement of >6% to count as "improved." Smaller deltas are treated as "same" even if the raw number went up or down.

### Why Noise Matters

Without noise handling, the loop will occasionally keep changes that appear to improve a volatile metric but actually had no effect — and discard changes that genuinely improved the metric but happened to run during a slow moment. Over many iterations, this produces a corrupted log and unreliable results.

---

## 9. Crash Recovery Tiers

The loop distinguishes four categories of crash, each with a different recovery protocol. The category determines whether the iteration is counted, whether a retry is attempted, and what gets logged.

### Tier 1: Syntax / Lint Errors

**Trigger:** The commit was made but the verification command fails immediately with a syntax or lint error (e.g., TypeScript compile error, ESLint parse failure).

**Protocol:**
1. Fix the syntax error immediately — do not revert yet
2. Re-run verification
3. This fix does NOT count as a separate iteration
4. If the fix succeeds and the metric improves: keep and log as `keep`
5. If the fix fails or produces a worse metric: revert the entire change and log as `discard`

**Rationale:** Syntax errors are implementation mistakes, not experiment failures. The experiment has not been meaningfully tested yet.

### Tier 2: Runtime Errors

**Trigger:** The code runs but throws an exception or produces an invalid result (e.g., uncaught TypeError, assertion failure, test crash).

**Protocol:**
1. Attempt to diagnose and fix the error — up to 3 attempts
2. Each fix attempt is a sub-iteration (does not consume a main iteration count)
3. If fixed within 3 attempts: re-run full verification, count as one iteration
4. If not fixed in 3 attempts: revert and log as `crash`

**Rationale:** Runtime errors may be fixable and the underlying experiment idea may be sound. 3 attempts provides enough opportunity without getting stuck.

### Tier 3: Resource Exhaustion

**Trigger:** The system runs out of memory, disk, file handles, or other resources during verification.

**Protocol:**
1. Revert the change immediately
2. Log as `crash` with description noting resource type
3. Design a smaller variant of the same idea (less data, fewer workers, smaller batch)
4. The smaller variant becomes the next experiment

**Rationale:** Resource exhaustion usually means the direction is right but the scale is wrong. The recovery produces a more conservative version of the same experiment.

### Tier 4: Timeouts / Hangs

**Trigger:** The verification process does not complete within 2× its normal duration.

**Protocol:**
1. Kill the verification process immediately
2. Revert the change
3. Log as `crash` with description "hang after Xs"
4. If the change might work with a longer timeout, adjust the timeout limit and retry once
5. If still hanging, log and move on

**Rationale:** Hangs often indicate infinite loops or deadlocks introduced by the change. The 2× threshold prevents the loop from stalling indefinitely.

### Tier 5: External Dependency Failures

**Trigger:** GitHub API unavailable, network timeout, external service down.

**Protocol:**
1. Do not revert the change
2. Skip this iteration (log as `no-op` with note "external failure: GitHub API")
3. Try again in the next iteration

**Rationale:** External failures are not caused by the change and should not count against it. The experiment is still unverified.

---

## 10. The One-Sentence Test for Atomic Changes

The one-sentence test is the enforcement mechanism for Phase 3's atomicity requirement. It is applied before committing any change.

**The test:** Write a single sentence describing the change. If the sentence requires the word "and" to connect two unrelated actions, the change is not atomic — split it.

### Valid Single-Sentence Changes

- "Reduce the verification timeout from 30 seconds to 15 seconds"
- "Replace synchronous `fs.readFileSync` calls with async `fs.readFile` in `state.ts`"
- "Add null check before accessing `phase.tasks` in `phase.ts`"
- "Update `TIMEOUT_MS` constant in config, types, and test fixtures" (one change, three files)

### Invalid Multi-Sentence Changes (Must Split)

- "Fix the null check in `phase.ts` and add logging to `state.ts`" — two independent improvements
- "Refactor the verification function and add retry logic" — two separate concerns
- "Update the port configuration and fix the TypeScript generics" — unrelated changes

### Why Atomicity Matters

When a change fails, atomicity tells you exactly why. If two things changed simultaneously and the metric worsened, you cannot know which change caused the regression. The loop's keep/discard decision becomes meaningless without atomicity.

When a change succeeds, atomicity lets you build on it with confidence. You know exactly which modification improved the metric.

### Atomicity for MaxsimCLI Project Management

In the code optimization context, atomicity is about code changes. In MaxsimCLI's project management context, atomicity applies to workflow changes, skill updates, and configuration modifications:

- "Reduce the number of research agents from 30 to 15 for small projects" — atomic
- "Add a memory update step to the session end hook" — atomic
- "Rewrite the verification skill and update the guard pattern and change the retry count" — not atomic (split into three)

---

## 11. Defining Metrics for Different Task Types

The metric is the most critical decision in setting up an autoresearch loop. A bad metric produces a well-optimized system that does the wrong thing. The metric must be:

1. **Mechanical** — Produced by a command, not human judgment
2. **Numeric** — A single parseable number
3. **Deterministic** — Same code produces same result (or nearly so)
4. **Fast** — Under 30 seconds to measure
5. **Relevant** — Actually measures what you care about

### Metric Catalogue for MaxsimCLI Contexts

**Phase Execution Quality**

| What to Improve | Metric Command | Direction |
|-----------------|---------------|---------|
| Test pass rate | `npx vitest run --reporter=json \| jq '.numPassedTests'` | Higher |
| Build time | `time npm run build 2>&1 \| grep real \| awk '{print $2}'` | Lower |
| Type errors | `npx tsc --noEmit 2>&1 \| grep error \| wc -l` | Lower |
| Lint violations | `npx biome check . 2>&1 \| grep "Found" \| awk '{print $2}'` | Lower |
| Bundle size (KB) | `du -sk dist/ \| awk '{print $1}'` | Lower |

**Agent and Workflow Performance**

| What to Improve | Metric Command | Direction |
|-----------------|---------------|---------|
| Skill token usage | `wc -w < .claude/skills/target-skill/SKILL.md` | Lower |
| Command response time | Custom timing harness | Lower |
| Verification pass rate | Count of pass/fail over N runs | Higher |
| Agent retry count | Parse stop hook logs for retry events | Lower |

**Content and Documentation Quality**

| What to Improve | Metric Command | Direction |
|-----------------|---------------|---------|
| Readability score | `npx readability-score < file.md` | Higher |
| Word count (minimize) | `wc -w < target.md` | Lower |
| Broken link count | `npx markdown-link-check file.md 2>&1 \| grep ERROR \| wc -l` | Lower |

**Project Management Metrics**

| What to Improve | Metric | Direction |
|-----------------|--------|---------|
| Phase completion rate | GitHub Issues closed / total in milestone | Higher |
| Blocker count | Issues with `blocker` label open | Lower |
| Cycle time | Average time from issue open to close | Lower |

### The Metric Validation Gate

Before starting the loop, validate the metric command:

1. Run the command and confirm it exits with code 0
2. Confirm the output is a parseable number (not a table, not prose)
3. Run it twice — confirm the numbers are close (volatility check)
4. Record the baseline value (iteration 0)

If the command fails validation, choose a different metric. Do not proceed with a broken or untestable metric.

### Proxy Metric Risk

The most common mistake is optimizing a proxy metric that diverges from the real goal. Examples:

- **Optimizing test count** (higher is better) → produces trivial tests with no assertions
- **Optimizing bundle size** (lower is better) → removes features instead of optimizing code
- **Optimizing lint error count** (lower is better) → adds `// eslint-disable` comments

Guard against proxy risk by:
1. Asking "could this metric go in the right direction for the wrong reason?"
2. Adding a Guard command that catches the wrong-reason case
3. Periodically reviewing kept commits to ensure they are genuinely improvements

---

## 12. The Plan Wizard Pattern

The `autoresearch:plan` wizard converts a free-form goal into a validated autoresearch configuration. The seven-phase wizard prevents common setup mistakes (bad metrics, too-broad scope, unverifiable goals).

### Phase 1: Capture Goal

If no goal was provided inline, ask: "What would you like to improve?" Suggest categories:
- Code quality / type safety
- Performance / speed
- Documentation / content
- Process / workflow
- Security / reliability

### Phase 2: Analyze Context (Auto-Detection)

Read the project structure and detect:
- **Language / runtime** (Node.js, Python, Go → suggests appropriate test runners)
- **Test framework** (Vitest, Jest, pytest → suggests verify command)
- **Linter** (Biome, ESLint, Ruff → suggests guard command)
- **Bundler** (Vite, Rollup, esbuild → suggests bundle size metric)
- **CI system** (GitHub Actions → suggests CI-compatible commands)

For MaxsimCLI projects specifically:
- Detect `biome.json` → suggest `npx biome check . 2>&1 | grep Found | awk '{print $2}'` as a lint metric
- Detect `vitest.config.ts` → suggest `npx vitest run --reporter=json | jq '.numPassedTests'` as a test metric
- Detect TypeScript → suggest `npx tsc --noEmit 2>&1 | grep error | wc -l` as a type-error metric

### Phase 3: Define Scope

Identify which files the loop may modify. Rules:
- Minimum: at least 1 file must match the scope glob
- Warning: scopes matching more than 50 files are flagged as too broad
- Read-only files are identified and excluded (test files, config files for guard commands)

### Phase 4: Define Metric

Present candidate metrics based on Phase 2 detection. For each candidate:
1. Show the command
2. Show what it measures
3. Run it as a dry run
4. Show the output and ask "is this the number you want to improve?"

**Never accept subjective metrics.** If the user proposes "code quality" or "readability," ask them to specify a measurable proxy metric.

### Phase 4.5: Define Guard (Optional but Recommended)

Suggest the most appropriate safety-net command:
- For code changes: `npx vitest run` (test suite must always pass)
- For documentation: `npx markdown-link-check` (no broken links)
- For content: word count minimum threshold (don't make it too short)

### Phase 5: Define Direction

Ask: "Is higher or lower better for this metric?"
- Test count, pass rate, coverage → higher is better
- Error count, build time, bundle size, lint violations → lower is better

Record the direction in the TSV header comment.

### Phase 6: Dry-Run Verification

Run the complete verify command and confirm:
- Exit code 0
- Output is parseable as a number
- Execution time is under 30 seconds
- The number is the baseline (iteration 0)

If the command fails, guide the user to fix it before proceeding. Do not start the loop with an untested verify command.

### Phase 7: Confirm and Launch

Display the complete configuration for review:

```
Goal:      Reduce TypeScript errors in core/
Scope:     packages/cli/src/core/**/*.ts
Verify:    npx tsc --noEmit 2>&1 | grep error | wc -l
Guard:     npx vitest run
Direction: lower_is_better
Baseline:  23 errors (iteration 0)
Mode:      Bounded (20 iterations)
```

Offer three options:
1. Launch now (unlimited)
2. Launch with iteration limit (bounded)
3. Copy configuration only (manual launch later)

---

## 13. Adapting the Loop for Project Management

The autoresearch pattern was designed for code optimization. MaxsimCLI uses it at a higher level of abstraction — improving workflows, skills, configurations, and project management processes. The adaptation requires redefining what "modify", "verify", and "metric" mean.

### The Core Analogy

| Code Optimization | MaxsimCLI Project Management |
|------------------|------------------------------|
| Modify `train.py` | Modify a skill, workflow, or configuration |
| Measure `val_bpb` | Measure phase completion rate, error count, cycle time |
| Revert if worse | Restore previous skill/config version |
| Git as memory | Git log of skill/config changes as memory |

### What Changes in Project Management Context

**The target is process, not code.** Instead of modifying implementation files, the loop modifies:
- Skill instructions (`.claude/skills/*/SKILL.md`)
- Command definitions (`.claude/commands/maxsim/*.md`)
- Agent prompts (`.claude/agents/*.md`)
- Workflow definitions (`.claude/workflows/*.md`)
- Configuration values (`.claude/maxsim-config.json`)

**The metric is outcome, not runtime.** Instead of measuring execution speed, the loop measures:
- How many tasks completed without retry?
- How many phases passed verification on first attempt?
- How many agent spawns were required per task?
- How many GitHub Issues were closed this session?

**The guard is correctness, not regression.** Instead of ensuring tests still pass, the guard ensures:
- Core workflows still execute without error
- All required commands are still available and documented
- Critical paths through the system still produce correct output

### Phase-Level Loop vs. Task-Level Loop

**Task-level loop** (micro): Runs within a single phase execution. Each iteration attempts one task implementation, verifies it, keeps or discards, moves to the next task. This is closest to the original autoresearch pattern.

**Phase-level loop** (macro): Runs across multiple sessions. Each iteration is an entire phase of the project. The metric is the quality of the phase outcome. The loop improves the process that produces phases over time.

MaxsimCLI operates both levels simultaneously:
- The task-level loop runs during `/maxsim:execute` (3 retries per task, verify + guard)
- The phase-level loop runs implicitly across sessions (via `maxsim-capture-learnings` hook)

### Workflow Improvement Example

Goal: Reduce the number of agent retries required during phase execution

```
Verify:  node maxsim-tools.cjs stats --retries --last-phase
Guard:   npx vitest run
Direction: lower_is_better
Scope:   .claude/skills/verification/SKILL.md
         .claude/agents/executor.md
```

The loop modifies the executor agent instructions and verification skill, measures whether retry count drops, and reverts changes that increase it. Over 20 iterations, the loop finds the phrasing that produces the lowest retry rate.

---

## 14. Phase-Level vs. Task-Level Improvement Loops

### Task-Level Loop (Within a Phase)

During `/maxsim:execute`, each task goes through a mini-loop:

```
1. Executor agent implements the task
2. Verifier agent checks the implementation
3. If verification fails: retry (max 3 times, fresh executor each retry)
4. If 3 failures: escalate to user
5. Move to next task
```

This is not the full 8-phase autoresearch loop — it is a simplified 3-step loop (implement → verify → keep/retry/escalate). The key autoresearch principles that apply here:
- Atomic changes: each task is a single logical unit of work
- Mechanical verification: tests, build, lint — never subjective
- Automatic retry: no human intervention in the retry cycle
- Fresh executor: each retry spawns a new agent (no accumulated context rot)

### Phase-Level Loop (Across Sessions)

The phase-level loop operates on MaxsimCLI's own processes. It is driven by the `maxsim-capture-learnings` Stop hook, which records what worked and what failed at the end of each session.

At the next session start, the learnings are applied:
- Adjust agent instructions based on failure patterns
- Modify skill text to clarify ambiguous instructions
- Update configuration values that caused repeated retries

This is a slower loop (one iteration per session) but operates on a higher-value target: the system that produces all other work.

### Combining Both Loops

The full MaxsimCLI improvement architecture:

```
Session N:
  → Read project memory (what we learned last time)
  → Apply learned adjustments to skills/config
  → Execute Phase M using task-level loop
    → Each task: implement → verify → keep/retry
    → Guard: full test suite after each task
  → Measure phase outcomes (retries, errors, time)
  → Capture learnings to memory
  → Log to autoresearch-results.tsv

Session N+1:
  → Read memory (includes Session N learnings)
  → Apply improved skills/config
  → Execute Phase M+1 with improved process
  → ...
```

Over time, the phase-level loop improves the task-level loop. The task-level loop produces better phase outcomes. Phase outcomes improve memory content. Memory content improves phase-level loop decisions.

---

## 15. Cross-Session Learning with Claude Code Memory

### Memory Architecture

MaxsimCLI uses four memory layers:

| Layer | Storage | Scope | Lifespan |
|-------|---------|-------|---------|
| Results TSV | `autoresearch-results.tsv` | Single loop run | Session |
| Agent Memory | `.claude/agent-memory/maxsim-learner/MEMORY.md` | Project | Persistent |
| Git History | `git log` | All experiments | Permanent |
| Claude Code Memory | Auto-managed by Claude Code | User-level | Persistent |

### What to Store in Each Layer

**Results TSV:** Raw metrics from each iteration. Used by Phase 1 pattern analysis within a loop run. Not persistent across loop runs (but can be archived).

**Agent Memory (`MEMORY.md`):** High-level learnings that should influence future sessions. Format:

```markdown
# MaxsimCLI Project Learnings

## What Works
- Reducing agent timeout from 5min to 3min reduced stuck detection triggers by 40%
- Using `git revert` instead of `git reset --hard` improved Phase 1 pattern quality

## What Fails
- Increasing research agent count above 20 produces diminishing returns (tried 4x, discarded each time)
- Parallel verification fails when GitHub API rate limit is hit

## Patterns
- Phase execution success rate correlates with quality of the task breakdown
- Verification failures cluster around missing type definitions, not logic errors
```

**Git History:** The permanent record of every experiment attempted. Read with `git log --oneline --grep="experiment:"`. This never needs to be regenerated — it is always accurate.

**Claude Code Memory:** User-level preferences and patterns that Claude Code manages automatically. MaxsimCLI reads this implicitly at session start.

### The `maxsim-capture-learnings` Hook

This Stop hook runs when the Claude Code session ends. It:

1. Reads the current session's git log (new experiment commits and reverts)
2. Reads any failed task evidence blocks
3. Extracts patterns: what type of changes succeeded, what failed, what crashed
4. Updates `MEMORY.md` with new learnings
5. Increments the session counter in memory

The hook must be idempotent — running it twice should not duplicate entries.

### Cross-Session Loop Improvement

The learning mechanism enables the phase-level loop to improve between sessions without explicit `/autoresearch` invocations. Every session implicitly runs one iteration of the phase-level loop:

- Modify: what was tried this session
- Verify: did phase objectives get met?
- Log: capture learnings
- Next session: apply learnings

This is "continuous background improvement" — the system gets better whether or not the user explicitly invokes autoresearch.

---

## 16. Preventing Regressions

### The Three-Layer Regression Defense

Regression prevention in MaxsimCLI operates at three levels:

**Level 1: Guard command (per-iteration)**
The Guard command runs after every kept change. If it fails, the change is reworked or discarded before the loop continues. This catches immediate regressions.

**Level 2: Simplicity override (per-decision)**
When two approaches produce equal metrics, the simpler one is always chosen. Complexity is a future regression risk. Preventing complexity accumulation prevents a class of regressions before they occur.

**Level 3: Revert preference (per-failure)**
Always revert failed changes rather than trying to fix them in-place. Fixing in-place with an already-committed bad change produces a compound change (the original bad change + the fix). The compound is harder to analyze and may introduce new issues. Revert and try again as a clean experiment.

### Simplicity Override in Detail

The simplicity heuristic is not just about line count. "Simpler" means:

- Fewer concepts to understand
- Fewer dependencies
- Fewer code paths
- Fewer configuration values
- Fewer agents required to accomplish the same task

If Option A achieves a metric of 720 using a complex caching layer, and Option B achieves 722 using a simpler sequential approach, Option B wins. The 2-unit improvement from Option A does not justify the maintenance cost and regression surface of the caching layer.

Applied to MaxsimCLI:
- If a skill with 200 lines achieves the same verification pass rate as a skill with 350 lines, use the 200-line version
- If 10 research agents produce the same plan quality as 30 agents, use 10
- If a 2-step workflow achieves the same outcome as a 5-step workflow, use 2 steps

### Guard Command Selection for MaxsimCLI

Recommended guard commands by context:

| Optimization Target | Guard Command |
|--------------------|--------------|
| Core CLI logic | `npx vitest run` |
| Skill modification | `npx vitest run && npx biome check .` |
| Command rewrite | `npx vitest run` + manual smoke test of affected command |
| Agent prompt change | Review against verification evidence blocks from last run |
| Configuration change | `npx vitest run` + `node maxsim-tools.cjs validate-config` |

### Revert Preference in Practice

When a change produces a crash or worse metric:

```bash
# Preferred: git revert (creates new commit, preserves history)
git revert HEAD --no-edit

# Only use when: working tree is corrupted before commit
git reset --hard HEAD
```

The revert commit message is automatically descriptive:
```
Revert "experiment(verify): reduce timeout from 30s to 15s"
```

This message in the git log tells the next Phase 1 review exactly what was tried and rejected. The information cost of `git reset --hard` is the loss of this entry.

---

## 17. Practical MaxsimCLI Integration Examples

### Example 1: Reducing TypeScript Errors in Core

**Setup:**
```
Goal:       Eliminate TypeScript errors in core/ package
Scope:      packages/cli/src/core/**/*.ts
Verify:     npx tsc --noEmit 2>&1 | grep '^packages/cli/src/core' | wc -l
Guard:      npx vitest run
Direction:  lower_is_better
Baseline:   23 errors (iteration 0)
Mode:       Bounded (30 iterations)
```

**Expected loop behavior:**
- Iterations 1-5: Fix most obvious errors (missing types, wrong generics)
- Iterations 6-15: Fix harder errors (complex conditional types, missing overloads)
- Iterations 16-25: Handle edge cases and type narrowing
- Stuck detection may trigger around iteration 20 if only difficult errors remain

**Adaptation for MaxsimCLI:** The Guard ensures that fixing type errors doesn't break test behavior. A type change that satisfies TypeScript but breaks a test is caught before the kept commit pollutes the codebase.

### Example 2: Improving Skill Clarity (Reducing Retry Rate)

**Setup:**
```
Goal:       Reduce executor agent retry rate for verification tasks
Scope:      .claude/skills/verification/SKILL.md
            .claude/agents/executor.md
Verify:     node maxsim-tools.cjs stats --retries --last-20-sessions
Guard:      npx vitest run
Direction:  lower_is_better
Baseline:   2.4 retries per task (iteration 0, averaged over last 20 sessions)
Mode:       Unbounded
```

**Adaptation note:** This is a phase-level loop metric, not a task-level metric. The verification command reads historical session data, not a real-time measurement. Each iteration modifies skill text, then the metric is only updated after running actual sessions. This loop runs across real usage, not in an offline benchmark.

**Approach:** The loop experiments with different phrasings of verification instructions, different ordering of steps, different levels of prescriptiveness. It keeps changes that correlate with lower retry rates and discards those that don't.

### Example 3: Reducing Bundle Size

**Setup:**
```
Goal:       Reduce CLI bundle size without removing features
Scope:      packages/cli/src/**/*.ts
            package.json
Verify:     npm run build 2>/dev/null && du -sk dist/cli.js | awk '{print $1}'
Guard:      npx vitest run
Direction:  lower_is_better
Baseline:   847 KB (iteration 0)
Mode:       Bounded (20 iterations)
```

**Expected approaches the loop will explore:**
- Replace large dependencies with smaller alternatives
- Tree-shake unused imports
- Move runtime dependencies to peer dependencies
- Inline small utility functions instead of importing

**Guard role:** Prevents the loop from "improving" bundle size by removing code that tests cover. If removing a module drops size by 30KB but breaks 5 tests, the Guard catches it.

### Example 4: Improving Phase Planning Quality

**Setup:**
```
Goal:       Reduce the average number of tasks added/removed after planning
Scope:      .claude/commands/maxsim/plan.md
            .claude/skills/roadmap-writing/SKILL.md
Verify:     gh api repos/owner/repo/issues --jq '[.[] | select(.labels[].name == "task") | .number] | length'
Guard:      (none — this metric has no binary pass/fail guard)
Direction:  lower_is_better (fewer post-plan task changes = better upfront planning)
Mode:       Unbounded
```

**Note on guard:** Some metrics do not have a natural binary guard. In these cases, rely on the simplicity override and human review of kept commits to catch quality regressions. A guard is strongly recommended but not required.

### Example 5: Optimizing Research Agent Parallelism

**Setup:**
```
Goal:       Find optimal research agent count for project init
Scope:      .claude/commands/maxsim/init.md
Verify:     node maxsim-tools.cjs benchmark --command init --projects small-sample/
Guard:      npx vitest run --testPathPattern=init
Direction:  lower_is_better (minimize init time while maintaining quality)
Mode:       Bounded (15 iterations, testing counts from 5 to 50)
Noise:      Use 3-run median (init time varies ~8%)
```

**Adaptation:** This example uses noise handling because benchmark times vary with system load. The median of 3 runs is used as the metric value. The minimum-delta threshold is set to 10% (only count improvements >10% of baseline to avoid chasing noise).

---

## 18. Integration Points in MaxsimCLI Architecture

### Where the Loop Hooks In

**`maxsim-capture-learnings` (Stop hook)**
Primary integration point for the phase-level loop. Runs on every session end. Captures what succeeded and failed. Updates `MEMORY.md`.

**`autoresearch-results.tsv`**
The results log. Written by the task-level loop during `/maxsim:execute`. Read by the phase-level loop at session start.

**`.claude/agent-memory/maxsim-learner/MEMORY.md`**
Cross-session persistent memory. Updated by the Stop hook. Read at session start via the `project-memory` skill.

**`git log --oneline --grep="experiment:"`**
The permanent experiment history. Read during Phase 1 of any autoresearch loop run.

### New Skill: `autoresearch`

A new skill should be added to MaxsimCLI that encapsulates the complete autoresearch loop protocol for use within the MaxsimCLI context. It should:

1. Describe when to use it (explicit optimization request or improvement phase)
2. Reference the 8-phase loop from this guide
3. Provide MaxsimCLI-specific metric templates
4. Include the stuck detection protocol
5. Specify the TSV format for this project

This skill is loaded when the user invokes `/maxsim:go` and the system detects an explicit improvement goal, or when the user runs `/autoresearch` (if autoresearch is installed alongside MaxsimCLI).

### New Command: `/maxsim:improve`

A dedicated command for triggering an autoresearch-style improvement loop within the MaxsimCLI context:

```
/maxsim:improve [target] [--iterations N] [--metric <command>] [--guard <command>]
```

This command:
1. Runs the Plan Wizard to configure the loop
2. Establishes the baseline
3. Enters the 8-phase loop
4. Produces a final summary and appends to the project memory

---

## 19. Reference: Karpathy's Original Formulation

For context, the original Karpathy autoresearch (March 6, 2026) had these exact properties:

| Property | Value |
|----------|-------|
| Target file | `train.py` (only) |
| Fixed file | `prepare.py` (immutable) |
| Instruction interface | `program.md` |
| Metric | `val_bpb` (validation bits per byte) |
| Direction | Lower is better |
| Time budget per experiment | 5 minutes on a single GPU |
| Experiments per hour | ~12 |
| Overnight yield | ~100 experiments |
| Duration of Karpathy's run | 2 days |
| Total experiments | 700 |
| Experiments that improved metric | 20 |
| Cumulative improvement | 11% speedup |
| API cost per overnight run | ~$5 |

The ratio of 20 kept out of 700 tried (2.9% keep rate) is not a failure — it is exactly what the loop is designed for. Each discard is informative. The compounding of 20 genuine improvements produced the result.

MaxsimCLI's phase-level loop will have a lower iteration rate (sessions, not 5-minute experiments) but a higher keep rate (project management changes are less risky than neural architecture changes). The principle is identical.

---

## 20. Common Mistakes and How to Avoid Them

| Mistake | Consequence | Prevention |
|---------|------------|------------|
| Using a subjective metric | Loop cannot make keep/discard decisions | Require command output + number |
| Scope too broad (>50 files) | Changes lack atomicity | Narrow scope before starting |
| No guard command | Optimizations silently break other things | Always define a guard for code changes |
| Using `git reset --hard` for reverts | Destroys learning history | Always prefer `git revert` |
| Making compound changes | Cannot attribute success/failure | Apply one-sentence test before committing |
| Ignoring the TSV log in Phase 1 | Repeating failed experiments | Always read last 10-20 entries before ideating |
| Volatile metric without noise handling | Random keep/discard decisions | Diagnose volatility before loop start |
| Stopping after first stuck detection | Miss the recovery protocol | Always complete the 6-step stuck recovery before escalating |
| Skipping baseline measurement | No reference point for delta | Iteration 0 is mandatory |
| Accepting a guard that is too strict | Every kept change gets reworked | Guard should prevent regressions, not require perfection |

---

*This guide is the authoritative reference for the self-improvement pattern in MaxsimCLI. It should be updated when new patterns are discovered, when the autoresearch protocol evolves, or when MaxsimCLI's own improvement loop produces new learnings about what works.*
