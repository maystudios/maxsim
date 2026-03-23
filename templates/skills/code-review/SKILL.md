---
name: code-review
description: >-
  Performs multi-dimensional code review covering security, quality, spec
  compliance, and maintainability. Use when reviewing completed implementations
  or before merging changes.
---

# Code Review

Shipping unreviewed code is shipping unknown risk. Every implementation review covers five dimensions.

## Review Dimensions

### 1. Security

| Category | What to Look For |
|----------|-----------------|
| Injection | Unsanitized user input in SQL, shell commands, HTML output, template strings |
| Authentication | Missing auth checks, hardcoded credentials, tokens in source |
| Authorization | Missing permission checks, privilege escalation paths |
| Data exposure | Secrets in logs, overly broad API responses, sensitive data in error messages |
| Dependencies | New packages with known CVEs, unnecessary new dependencies |

Any security issue is a Blocker. No exceptions. No deferrals.

### 2. Quality

- Are all external calls wrapped in error handling?
- Do error messages provide enough context to diagnose the issue?
- Are errors propagated correctly, not swallowed silently?
- Are edge cases handled: empty input, null values, boundary conditions, concurrent access?
- Are there obvious performance problems: N+1 queries, unbounded loops, missing pagination?

### 3. Spec Compliance

- Does the implementation match what was planned?
- Are all tasks from the plan completed?
- Are acceptance criteria met?
- Are breaking changes documented and intentional?
- Does the scope match the plan — neither over-built nor under-built?

### 4. Maintainability

- Is naming consistent with existing codebase conventions?
- Is complexity justified by the requirements? Could this be simpler?
- Are comments present where logic is non-obvious?
- Is there duplicated logic that should be extracted?
- Would a new contributor understand this code without asking?

### 5. Test Coverage

- Does every new public function have corresponding tests?
- Do tests cover both success and failure paths?
- Are edge cases tested?
- Do tests verify behavior, not implementation details?
- Would a test failure actually catch a regression?

## Severity Levels

| Severity | Definition | Action |
|----------|------------|--------|
| Blocker | Security vulnerability, data loss risk, broken public API contract | Block merge. Fix before any other work. |
| High | Missing critical tests, no error path handling, performance regression | Fix now. File issue if fix takes >30min. |
| Medium | Naming inconsistency, dead code, convention mismatch, weak tests | File for follow-up. Do not block merge. |
| Low | Style preference, minor naming, optional improvement | Comment only. No tracking required. |

Blocker and High block approval. Medium and Low do not.

## Parallel Review Pattern

For large diffs (10+ files), spawn one review agent per dimension in parallel:

```
Agent 1: Security review only
Agent 2: Quality and error handling only
Agent 3: Spec compliance only
Agent 4: Maintainability only
Agent 5: Test coverage only
```

Each agent returns findings in the output format below. The orchestrator collates findings and produces the final verdict.

## Output Format

```
REVIEW SCOPE: [N] files changed, [N] additions, [N] deletions

SECURITY: PASS | [BLOCKER] description
QUALITY: PASS | [HIGH] description
SPEC COMPLIANCE: PASS | [HIGH] description
MAINTAINABILITY: PASS | [MEDIUM] description
TEST COVERAGE: PASS | [HIGH] description

VERDICT: APPROVED | BLOCKED

Blocking issues:
- [BLOCKER] [file:line] SQL query uses string concatenation with user input
- [HIGH] [file:line] No error handling on database connection failure

Follow-up items:
- [MEDIUM] [file] Function name `doThing` does not describe behavior
```

## Common Pitfalls

| Assumption | Reality |
|------------|---------|
| "Tests pass, so the code is fine" | Tests verify behavior, not code quality. Review is separate. |
| "I wrote it, so I know it's correct" | Author bias is real. Review as if someone else wrote it. |
| "It's just a small change" | Small changes cause large outages. |
| "Generated code doesn't need review" | Generated code has the same bugs. Review it. |
| "Security issues can be fixed later" | Security issues deferred are security issues shipped. |

## Spec Review vs Code Review

These are different activities. Both are required.

| Dimension | Spec Review | Code Review |
|-----------|------------|-------------|
| Question | Does it match the requirements? | Is the code correct and quality? |
| Checks | Acceptance criteria, requirement coverage, scope | Security, quality, errors, tests, maintainability |
| Output | PASS/FAIL per requirement | APPROVED/BLOCKED per dimension |

Spec review alone misses security issues. Code review alone misses missing requirements. Run both.

See also: `maxsim-simplify` skill for maintainability optimization (duplication, dead code, complexity reduction).
