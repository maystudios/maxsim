# Results Logging Protocol

The agent tracks every iteration in a structured TSV log. This enables pattern recognition and prevents repeating failed experiments.

## Setup and Initialization

The agent creates the log automatically at Phase 0 (baseline):

1. Create log file with metric direction header and column names.
2. Add `autoresearch-results.tsv` to `.gitignore`.
3. Run verify command to establish baseline metric.
4. Record baseline as iteration 0.

## Log Format (TSV)

File: `autoresearch-results.tsv` in the working directory (gitignored).

```tsv
# metric_direction: higher_is_better
iteration	commit	metric	delta	guard	status	description
0	a1b2c3d	85.2	0.0	pass	baseline	initial state — coverage 85.2%
1	b2c3d4e	87.1	+1.9	pass	keep	add auth middleware tests
2	-	86.5	-0.6	-	discard	refactor test helpers
```

### Columns

| Column | Type | Description |
|--------|------|-------------|
| iteration | int | Sequential counter starting at 0 (baseline) |
| commit | string | Short git hash (7 chars), "-" if reverted |
| metric | float | Measured value from verification |
| delta | float | Change from previous best |
| guard | enum | `pass`, `fail`, or `-` (no guard configured) |
| status | enum | `baseline`, `keep`, `keep (reworked)`, `discard`, `crash`, `no-op`, `hook-blocked` |
| description | string | One-sentence description of what was tried |

## Reading and Using the Log

At each iteration (Phase 1 Review), the agent reads the last 10-20 entries for pattern recognition:

- Count outcomes for progress tracking (keeps, discards, crashes).
- Detect stuck state: more than 5 consecutive discards triggers the "When Stuck" protocol.
- Cross-reference "keep" rows with git log to find winning patterns.

## Integration with the Loop

```
Phase 0 (Setup):    CREATE log file, record baseline (iteration 0)
Phase 1 (Review):   READ last 10-20 log entries for pattern recognition
Phase 3-6 (Loop):   Modify, Commit, Verify, Decide
Phase 7 (Log):      APPEND new row after keep/discard/crash decision
Phase 8 (Repeat):   Back to Phase 1 (reads updated log)
```

## Log Management

- Create at setup (iteration 0 = baseline).
- Append after every iteration (including crashes).
- Do not commit this file to git (add to .gitignore).
- Read last 10-20 entries at start of each iteration for context.

## Summary Reporting

Every 10 iterations (or at loop completion in bounded mode), the agent prints a brief summary:

```
=== Progress (iteration 20) ===
Baseline: 85.2% → Current best: 92.1% (+6.9%)
Keeps: 8 | Discards: 10 | Crashes: 2
Last 5: keep, discard, discard, keep, keep
```

## Metric Direction

Clarified at setup:
- **Lower is better:** response time, bundle size, error count.
- **Higher is better:** test coverage, lighthouse score, throughput.

Recorded in the first line of the results log as a comment: `# metric_direction: higher_is_better`.
