---
name: maxsim-simplify
description: Reviews changed code for reuse opportunities, quality issues, and efficiency improvements, then fixes actionable items. Use after implementing features or when code feels over-engineered.
---

# Simplify

Every line of code is a liability. Remove what does not earn its place.

## Scope

Only simplify touched files unless explicitly asked for broader refactoring. The goal is incremental maintainability improvement, not a codebase-wide rewrite.

---

## 3-Pass Review

### Pass 1 — Reuse

Identify duplication and missed opportunities to use existing code.

- Are there patterns repeated across files that belong in a shared helper?
- Does new code duplicate existing utilities or library functions?
- Could two similar implementations be merged behind a single interface?
- Are there inline blocks that match patterns already extracted elsewhere?

**Rule of three:** If the same pattern appears three or more times, extract it.

### Pass 2 — Quality

Identify naming, complexity, and error handling problems.

- Are names self-documenting? Rename anything that requires a comment to explain.
- Does every abstraction, wrapper, or indirection layer justify its existence?
- Is there dead code: unused imports, commented-out blocks, unreachable branches?
- Are feature flags still needed, or do they guard features that no longer exist?
- Is error handling present and consistent, or are errors silently swallowed?
- Could nested logic be flattened with early returns?

**If removing something does not break anything, it should not be there.**

### Pass 3 — Efficiency

Identify unnecessary work, missing caching, and query patterns that scale poorly.

- Are there operations repeated in a loop that could run once outside it?
- Is data fetched that is never used?
- Are there N+1 query patterns (fetching inside a loop that iterates over results)?
- Could expensive computations be memoized or cached?
- Are synchronous operations blocking where async would suffice?

---

## Priority Levels

| Priority | Description | Action |
|----------|-------------|--------|
| Blocker | Incorrect behavior, data loss risk, or broken error handling introduced by the change | Fix immediately |
| High | Significant duplication, N+1 queries, or complexity that will compound | Fix in this pass |
| Medium | Naming issues, minor inefficiencies, single-use abstractions | File as follow-up issue |
| Low | Style preferences, marginal improvements | Note only, do not act |

Apply fixes for Blocker and High priority items in the current pass. File Medium and Low items as GitHub Issues for follow-up, labelled `maxsim:simplify`.

---

## Process

1. **Diff** — Collect the set of modified and added files. Read each file in full, not just the changed hunks.
2. **Scan** — Run all three passes (Reuse, Quality, Efficiency) against each file.
3. **Record** — Document each finding using the output format below.
4. **Fix** — Apply all Blocker and High fixes. Do not alter behavior — simplify only.
5. **Verify** — Re-run tests. Confirm all tests pass before reporting completion.

---

## Output Format

```
PASS: [Reuse | Quality | Efficiency]
FILE: <path>
LINE: <range>
FINDING: <description>
PRIORITY: [Blocker | High | Medium | Low]
FIX: <what was applied or recommended>
```

---

## Common Rationalizations — Reject These

| Excuse | Why It Fails |
|--------|-------------|
| "It might be needed later" | Delete it. Re-adding is cheaper than maintaining unused code. |
| "The abstraction makes it extensible" | Extensibility serving no current requirement is dead weight. |
| "Refactoring is risky" | Small, tested simplifications reduce risk. Accumulated complexity increases it. |
| "I'll clean it up later" | Later never comes. Simplify now while context is fresh. |
| "The diff is small, not worth reviewing" | Small diffs introduce the most insidious problems. |

---

## Verification Checklist

Before reporting completion:

- [ ] All changed files reviewed in full (not just diffs)
- [ ] No duplicated logic that appears three or more times
- [ ] No dead code: unused imports, commented blocks, unreachable branches
- [ ] No unnecessary abstractions, wrappers, or indirection layers
- [ ] Error handling present and consistent in all changed paths
- [ ] No N+1 queries or repeated expensive operations in loops
- [ ] All tests pass after simplification
- [ ] No behavioral changes introduced

See also: `/code-review` for correctness review covering security, interfaces, and test coverage.
