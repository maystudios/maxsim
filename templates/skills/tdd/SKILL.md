---
name: tdd
description: Enforces red-green-refactor TDD cycle with atomic commits per phase. Use when implementing features, fixing bugs, or when tests should drive the design.
---

# Test-Driven Development (TDD)

Write the test first. Watch it fail. Write minimal code to pass. Clean up.

## When to Use

**Good fit:** Business logic with defined I/O, API endpoints with contracts, data transformations, validation rules, algorithms, state machines, bug fixes.

**Poor fit:** UI layout, configuration files, build scripts, one-off scripts, mechanical renames, exploratory spikes.

## The Red-Green-Refactor Cycle

### RED — Write One Failing Test

- Write ONE minimal test describing the desired behavior.
- Test name describes what SHOULD happen, not implementation details.
- Use real code paths — mocks only when unavoidable (external APIs, databases, I/O).

**Verify RED:** Run the test. It MUST fail with an assertion error — not a syntax error or import failure. If the test passes immediately, it is testing existing behavior. Rewrite it.

### GREEN — Write Minimal Code

- Write the SIMPLEST code that makes the test pass.
- Do NOT add features the test does not require.
- Do NOT refactor yet.

**Verify GREEN:** Run all tests. The new test must pass. ALL existing tests must still pass. If any existing test fails, fix the code — not the tests.

### REFACTOR — Clean Up

- Remove duplication, improve names, extract helpers.
- Run tests after every change.
- Do NOT add new behavior during refactor.

**Verify REFACTOR:** All tests still pass. No behavior changed.

### REPEAT

Move to the next failing test for the next unit of behavior.

## Commit Pattern

Each TDD cycle produces 2–3 atomic commits:

| Phase | Commit format |
|-------|---------------|
| RED | `test({scope}): add failing test for [feature]` |
| GREEN | `feat({scope}): implement [feature]` |
| REFACTOR | `refactor({scope}): clean up [feature]` (omit if no changes) |

Keep commits small. One cycle = one feature unit = one commit group.

## Context Budget

TDD uses approximately 40% more context than direct implementation due to cycle overhead. Plan accordingly for long task lists.

## Common Pitfalls

| Excuse | Why It Fails |
|--------|-------------|
| "Too simple to test" | Simple code breaks. The test takes 30 seconds to write. |
| "I'll add tests after" | Tests written after pass immediately — they prove nothing. |
| "I know the code works" | Knowledge is not evidence. A passing test is evidence. |
| "TDD is slower" | TDD is faster than debugging. Every skipped test creates debt. |
| "Mocks make this easy" | Over-mocking tests the mock, not the code. Prefer real code paths. |

Stop immediately if you catch yourself writing implementation code before a test, writing a test that passes on the first run, skipping VERIFY RED, or adding features beyond what the current test requires.

See also: `verification-before-completion` for evidence-based completion claims after TDD cycles.
