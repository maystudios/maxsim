---
name: autoresearch
description: Autonomous optimization loop with reference workflows. Powers /maxsim:improve, /maxsim:fix-loop, /maxsim:debug-loop, /maxsim:security. Use when running autonomous optimization, error repair, bug hunting, or security audit loops.
version: 1.0.0
---

# Autonomous Optimization Loop

Constraint-driven autonomous iteration for any task. The agent modifies, verifies, keeps or discards, and repeats.

## When to Activate

- `/maxsim:improve` — run the optimization loop
- `/maxsim:fix-loop` — iteratively repair errors until zero remain
- `/maxsim:debug-loop` — autonomous bug hunting with scientific method
- `/maxsim:security` — STRIDE + OWASP security audit loop
- Any task requiring repeated iteration cycles with measurable outcomes

## Subcommands

| Command | Purpose | Reference |
|---------|---------|-----------|
| `/maxsim:improve` | Run the autonomous optimization loop (default) | This file |
| `/maxsim:debug-loop` | Autonomous bug hunting: hypothesize, test, prove/disprove, repeat | `references/debug.md` |
| `/maxsim:fix-loop` | Autonomous fix loop: detect, prioritize, fix one, verify, repeat | `references/fix.md` |
| `/maxsim:security` | Security audit: STRIDE + OWASP + red-team adversarial analysis | `references/security.md` |

## Interactive Setup Gate

Before any command executes, the agent checks whether the user provided all required context inline. If any required context is missing, the agent collects it interactively before proceeding.

| Command | Required Context |
|---------|-----------------|
| `/maxsim:improve` | Goal, Scope, Metric, Direction, Verify |
| `/maxsim:debug-loop` | Issue/Symptom, Scope |
| `/maxsim:fix-loop` | Target, Scope |
| `/maxsim:security` | Scope, Depth |

## Bounded Iterations

By default, loops run until manually interrupted. To run exactly N iterations, the user adds `Iterations: N` to the inline config.

After N iterations the agent stops and prints a final summary with baseline, current best, keeps/discards/crashes. If the goal is achieved before N iterations, the agent prints early completion and stops.

| Scenario | Recommendation |
|----------|---------------|
| Run overnight, review in morning | Unlimited (default) |
| Quick improvement session | `Iterations: 10` |
| Targeted fix with known scope | `Iterations: 5` |
| Exploratory approach test | `Iterations: 15` |

## Setup Phase

If the user provides Goal, Scope, Metric, and Verify inline, the agent extracts them and proceeds to step 5 below. Otherwise the agent collects them interactively in two batched calls.

**Batch 1 (4 questions):** Goal, Scope, Metric, Direction.

**Batch 2 (3 questions):** Verify command, Guard command, Launch preference.

After batch 2, the agent dry-runs the verify command. If it fails, the agent asks the user to fix or choose a different command.

### Setup Steps (after config is complete)

1. Read all in-scope files for full context before any modification.
2. Define the goal from user input or inline config.
3. Define scope constraints with validated file globs.
4. Define guard (optional) for regression prevention.
5. Create a results log per `references/results-logging.md`.
6. Establish baseline by running verification on current state. Record as iteration 0.
7. Confirm and begin the loop.

## The Loop

Full protocol details are in `references/loop-protocol.md`.

```
LOOP (FOREVER or N times):
  1. Review: Read current state + git history + results log
  2. Ideate: Pick next change based on goal, past results, what hasn't been tried
  3. Modify: Make ONE focused change to in-scope files
  4. Commit: Git commit the change (before verification)
  5. Verify: Run the mechanical metric
  6. Guard: If guard is set, run the guard command
  7. Decide:
     - IMPROVED + guard passed → Keep commit, log "keep"
     - IMPROVED + guard FAILED → Revert, rework (max 2 attempts)
     - SAME/WORSE → Git revert, log "discard"
     - CRASHED → Try to fix (max 3 attempts), else log "crash"
  8. Log: Record result in results log
  9. Repeat
```

## Critical Rules

1. **Loop until done** — Unbounded: loop until interrupted. Bounded: loop N times then summarize.
2. **Read before write** — Always understand full context before modifying.
3. **One change per iteration** — Atomic changes for clear causality.
4. **Mechanical verification only** — No subjective judgments. Use metrics.
5. **Automatic rollback** — Failed changes revert instantly via `git revert`.
6. **Simplicity wins** — Equal results + less code = KEEP. Tiny improvement + ugly complexity = DISCARD.
7. **Git is memory** — Every experiment committed with `experiment:` prefix. Use `git revert` (not `git reset --hard`) so failed experiments remain visible. The agent reads `git log` and `git diff` of kept commits before each iteration.
8. **When stuck, think harder** — Re-read files, re-read goal, combine near-misses, try radical changes.

## Principles Reference

See `references/core-principles.md` for the 7 generalizable principles behind autonomous iteration.

## Adapting to Different Domains

| Domain | Metric | Scope | Verify Command | Guard |
|--------|--------|-------|----------------|-------|
| Backend code | Tests pass + coverage % | `src/**/*.ts` | `npm test` | -- |
| Frontend UI | Lighthouse score | `src/components/**` | `npx lighthouse` | `npm test` |
| Performance | Benchmark time (ms) | Target files | `npm run bench` | `npm test` |
| Refactoring | Tests pass + LOC reduced | Target module | `npm test && wc -l` | `npm run typecheck` |
| Security | OWASP + STRIDE coverage | API/auth/middleware | `/maxsim:security` | -- |
| Debugging | Bugs found + coverage | Target files | `/maxsim:debug-loop` | -- |
| Fixing | Error count (lower) | Target files | `/maxsim:fix-loop` | `npm test` |

## Debug Loop Summary

Autonomous bug-hunting loop applying the scientific method. Each iteration forms a falsifiable hypothesis, tests it, and classifies the result as confirmed, disproven, or inconclusive.

**Phases:** Gather symptoms, Reconnaissance, Hypothesize, Test, Classify, Log, Repeat.

The agent uses investigation techniques including direct inspection, trace execution, minimal reproduction, binary search, differential debugging, and pattern search.

Full protocol: `references/debug.md`

## Fix Loop Summary

Autonomous fix loop that takes a broken state and iteratively repairs it. One fix per iteration, atomic, committed, verified, auto-reverted on failure.

**Phases:** Detect errors, Prioritize (build > types > tests > lint), Fix ONE thing, Commit, Verify (did error count decrease?), Guard (did anything else break?), Decide, Log and Repeat.

The agent fixes the implementation, never the tests. It never adds `@ts-ignore`, `eslint-disable`, or `any` type escapes.

Full protocol: `references/fix.md`

## Security Audit Summary

Autonomous security auditing combining STRIDE threat modeling, OWASP Top 10 sweeps, and red-team adversarial analysis into a single loop.

**Setup:** Codebase reconnaissance, asset identification, trust boundary mapping, STRIDE threat model, attack surface map, baseline.

**Loop:** Each iteration picks one untested attack vector, analyzes the target code, validates with code evidence, classifies severity + OWASP + STRIDE category, and logs the result.

**Key behaviors:**
- Follows 4 red-team adversarial lenses (Security Adversary, Supply Chain, Insider Threat, Infrastructure)
- Every finding requires code evidence (file:line + attack scenario)
- Tracks OWASP Top 10 + STRIDE coverage, prints summary every 5 iterations
- Composite metric: `(owasp_tested/10)*50 + (stride_tested/6)*30 + min(findings, 20)`

**Flags:** `--diff` (delta mode), `--fix` (auto-remediate Critical/High), `--fail-on <severity>` (CI gate).

Full protocol: `references/security.md`

## Results Logging

All loops use a TSV results log tracking every iteration. See `references/results-logging.md` for the format and protocol.

```tsv
iteration	commit	metric	delta	guard	status	description
0	a1b2c3d	85.2	0.0	pass	baseline	initial state
1	b2c3d4e	87.1	+1.9	pass	keep	add auth middleware tests
2	-	86.5	-0.6	-	discard	refactor test helpers
```

Valid statuses: `baseline`, `keep`, `keep (reworked)`, `discard`, `crash`, `no-op`, `hook-blocked`.
