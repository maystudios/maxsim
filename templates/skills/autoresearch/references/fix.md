# Fix Workflow

Autonomous fix loop that takes a broken state and iteratively repairs it until everything passes. One fix per iteration. Atomic, committed, verified, auto-reverted on failure.

## Trigger

- User invokes `/maxsim:fix-loop`
- User says "fix all errors", "make tests pass", "fix the build", "clean up all warnings"

## Interactive Setup

If invoked without explicit `--target`, `--guard`, or `--scope`, the agent first auto-detects all failures (tests, types, lint, build), then collects user input via a single batched call with 4 questions:

| # | Header | Question |
|---|--------|----------|
| 1 | Fix What | "Found [N] failures. What should I fix?" |
| 2 | Guard | "What command must always pass?" |
| 3 | Scope | "Which files can I modify?" |
| 4 | Launch | "Ready to fix?" |

## Phases

### Phase 1: Detect — What Is Broken?

The agent auto-detects failures by running: test suite, type checker, linter, build, and checking for debug findings.

### Phase 2: Prioritize — Fix Order

| Priority | Category | Rationale |
|----------|----------|-----------|
| 1 | Build failures | Nothing works if it does not compile |
| 2 | Critical/High bugs | From debug findings |
| 3 | Type errors | Type safety prevents cascading bugs |
| 4 | Test failures | Tests verify correctness |
| 5 | Medium/Low bugs | From debug findings |
| 6 | Lint errors | Code quality |
| 7 | Warnings | Polish |

Within a category, the agent prioritizes by cascading impact, simplicity, and file locality.

### Phase 3: Fix ONE Thing

The agent picks the highest-priority unfixed item and makes one focused change.

Rules:
- ONE fix per iteration.
- Fix the implementation, not the test (unless the test is genuinely wrong).
- Never add `@ts-ignore`, `eslint-disable`, `# type: ignore` to suppress errors.
- Never use `any` type to silence TypeScript.
- Never delete tests.
- Prefer minimal changes.

**Fix strategies by language:**

| Language | Never Do | Correct Pattern |
|----------|----------|-----------------|
| TypeScript | `any`, `@ts-ignore` | Proper interfaces, generics, discriminated unions |
| Python | Bare `except:` | `except SpecificError:` with full type hints |
| Go | Ignoring errors with `_` | `fmt.Errorf("context: %w", err)` |
| Rust | `.unwrap()` in production | `Result<T, E>` propagation with `?` |

### Phase 4: Commit

```bash
git add <modified-files>
git commit -m "fix: [what was fixed] — [file:line]"
```

Commit before running verification for clean rollback.

### Phase 5: Verify

Re-run detection and compare: `delta = previous_errors - current_errors`. Expected: `delta > 0`.

### Phase 6: Guard

If a guard command is specified, the agent runs it to check for regressions.

### Phase 7: Decide

| Condition | Action | Status |
|-----------|--------|--------|
| `delta > 0` AND guard passes | KEEP | fixed |
| `delta > 0` AND guard fails | REWORK (max 2 attempts) | rework |
| `delta == 0` | DISCARD — revert | discard |
| `delta < 0` | DISCARD — revert immediately | discard |
| Crash | RECOVER (max 3 attempts) | recover |
| 3rd attempt fails | SKIP to blocked list | blocked |

### Phase 8: Log and Repeat

Append to fix-results.tsv. Every 5 iterations, print progress. If error count reaches zero, stop even in unbounded mode.

## Composite Metric

```
fix_score = ((baseline_errors - current_errors) / baseline_errors) * 60
          + quality_deductions
          + (guard_always_passed ? 25 : 0)
          + bonus (zero_errors, no_discards)
```

**Quality deductions:** -5 per suppression used, -10 per deleted test, -3 per `any` type introduced.

## Anti-Patterns

| Anti-Pattern | Do This Instead |
|--------------|-----------------|
| Add `@ts-ignore` / `eslint-disable` | Fix the root cause |
| Use `any` type | Use proper types, generics, or `unknown` |
| Delete failing tests | Fix the implementation |
| Empty `catch` blocks | Log at minimum; handle or re-throw |
| Hardcode values to pass tests | Fix the logic |

## Escalation Path

After 3 failed attempts on the same error:
1. Document what was tried and why each failed.
2. Create minimal reproduction case.
3. Skip to blocked list, continue with others.
4. Note in summary — suggest `/maxsim:debug-loop` for root cause analysis.

## Output

Creates `fix/{YYMMDD}-{HHMM}-{slug}/` with: `fix-results.tsv`, `summary.md`, `blocked.md`, `impact-assessment.md`.
