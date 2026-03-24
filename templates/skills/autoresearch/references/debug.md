# Debug Workflow

Autonomous bug-hunting loop applying the scientific method iteratively. The agent keeps investigating until the codebase is clean or it is interrupted.

## Trigger

- User invokes `/maxsim:debug-loop`
- User says "find all bugs", "debug this", "why is this failing", "hunt bugs", "investigate"

## Interactive Setup

If invoked without `--scope` or `--symptom`, the agent gathers context via a single batched call with 4 questions:

| # | Header | Question |
|---|--------|----------|
| 1 | Issue | "What's the problem?" |
| 2 | Scope | "Which files should I investigate?" |
| 3 | Depth | "How deep should I investigate?" |
| 4 | After | "When bugs are found, should I also fix them?" |

## Phases

### Phase 1: Gather — Symptoms and Context

If the user provides symptoms, the agent collects: expected vs actual behavior, error messages, stack traces, reproduction steps, environment details.

If no symptoms (autonomous hunt), the agent runs the test suite, linter, type checker, and build to detect failures. It scans for common anti-patterns (unhandled promises, unchecked nulls, race conditions).

### Phase 2: Reconnaissance — Map the Error Surface

The agent reads files from stack traces, traces call chains backward, identifies entry points, maps data flow, checks recent git changes, and identifies external dependencies.

### Phase 3: Hypothesize — Form Falsifiable Hypothesis

A good hypothesis is specific, testable, falsifiable, and prioritized by likelihood.

**Priority order:** Error message literal, recent change, data flow trace, environment diff, dependency issue, race condition, edge case.

**Cognitive bias guards:** The agent actively seeks evidence against its hypothesis, does not fixate on the first clue, abandons after 3 failed confirmations, and avoids assuming familiar patterns are the cause.

### Phase 4: Test — Run Experiment

One experiment per iteration. Methods include: direct inspection, trace execution, minimal reproduction, binary search, differential debugging, git bisect, input variation.

### Phase 5: Classify

| Result | Action |
|--------|--------|
| Bug confirmed | Record with full evidence, severity, location |
| Hypothesis disproven | Log as eliminated, extract learnings |
| Inconclusive | Refine hypothesis, re-test |
| New lead | Log discovery, add to hypothesis queue |

**Severity levels:** CRITICAL (data loss, security breach), HIGH (feature broken), MEDIUM (edge case failure), LOW (cosmetic).

### Phase 6: Log

Append to debug-results.tsv. Every 5 iterations, print progress summary.

### Phase 7: Repeat

Priority for next iteration: follow new leads, untested hypotheses, uninvestigated files, deeper root cause analysis, pattern-based search across codebase.

## Composite Metric

```
debug_score = bugs_found * 15
            + hypotheses_tested * 3
            + (files_investigated / files_in_scope) * 40
            + (techniques_used / 7) * 10
```

## Common Bug Patterns

| Language | Classic Bug | Pattern |
|----------|-------------|---------|
| JavaScript | Unhandled promise rejection | `Promise` without `.catch` / missing `await` |
| TypeScript | Lost type narrowing | `obj?.prop` then `obj.other` |
| Python | Mutable default argument | `def f(x=[]):` |
| Go | Goroutine leak | Goroutine blocks on unclosed channel |
| Rust | Panic from `.unwrap()` | `Option::unwrap()` on `Err` path |

## Investigation Techniques

- **Binary Search:** Comment out half the suspicious code. If bug disappears, it is in that half.
- **Differential Debugging:** Compare working state vs broken state via `git stash`, `git bisect`, or environment diff.
- **Minimal Reproduction:** Strip away everything until the smallest possible failing case remains.
- **Trace Execution:** Add strategic logging at key data flow points.
- **Pattern Search:** Found one bug? Search for the same anti-pattern across the codebase.
- **Working Backwards:** Start from the error output and trace backward.
- **5 Whys:** Ask "why" recursively until reaching a permanently fixable root cause.

## Chaining

After the debug loop completes, the agent can chain to `/maxsim:fix-loop` targeting the discovered issues.

## Output

Creates `debug/{YYMMDD}-{HHMM}-{slug}/` with: `findings.md`, `eliminated.md`, `debug-results.tsv`, `summary.md`.
