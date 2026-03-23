---
name: verification
description: Evidence-based verification with quality gates, anti-rationalization enforcement, and retry escalation. Merges gate framework, evidence collection, and completion verification into one authoritative source. Use when completing tasks, verifying implementations, or before claiming work is done.
---

# Verification

## The Iron Law

No completion claim is valid without fresh verification evidence produced in THIS session. Evidence from a prior session, a prior attempt, or reasoning about what "should" be true does not count. If the evidence was not collected by running a tool call in the current session, it does not exist.

---

## Evidence Block Format

Every claim about task completion, test status, build status, or spec compliance requires an Evidence Block. Produce one per claim.

```
**CLAIM**: [The specific assertion being made]
**EVIDENCE**: [Tool name and exact command or action taken]
**OUTPUT**: [Actual output, quoted verbatim — not paraphrased]
**VERDICT**: PASS | FAIL | SKIPPED
```

SKIPPED is only allowed when the claim is explicitly out of scope and the reason is documented. A skipped gate must be acknowledged by the caller.

---

## 4 Quality Gates

Gates run in order. A failure at any gate stops forward progress until resolved.

### Gate 1 — Input Gate
Run before work begins.

- Spec or task definition exists and is unambiguous
- Acceptance criteria are stated explicitly
- Required inputs (files, configs, credentials) are present
- Scope boundaries are defined — what is in and what is out

Failure action: Return to requester with a clarifying question. Do not guess at requirements.

### Gate 2 — Pre-Action Gate
Run before executing changes.

- Git state is clean or the working branch is correctly scoped
- Dependencies are installed and match the lockfile
- Linter and formatter configs are present
- No blocking issues from a previous failed run remain in the working tree

Failure action: Resolve the blocking state first. Document what was found and what was done to fix it.

### Gate 3 — Completion Gate
Run after implementation, before declaring done.

- All tests pass (fresh run, not cached)
- Build exits with code 0
- Lint is clean
- Every acceptance criterion from Gate 1 is addressed with an Evidence Block
- No files are left in a modified-but-uncommitted state unless that is the intended deliverable

Failure action: Fix failures. Do not skip a failing test. Do not suppress a lint error. Each fix resets the gate — re-run from the top of Gate 3.

### Gate 4 — Quality Gate
Run after Gate 3 passes.

- Code review concerns (if any were raised) are resolved
- No regressions introduced — GUARD command confirms this (see below)
- Evidence Blocks are complete and attached to the work artifact
- Handoff contract or completion note is written if another agent will consume this output

Failure action: Rework the implementation. If regressions are found, revert before attempting a fix.

---

## What Counts as Evidence

| Claim | Required Evidence | NOT Sufficient |
|---|---|---|
| Tests pass | `npm test` output showing pass count and zero failures | "I ran the tests" |
| Build succeeds | `npm run build` (or equivalent) with exit code 0 shown | "Build should work" |
| Lint is clean | `npm run lint` output with zero errors and zero warnings | "No obvious lint issues" |
| File was created | `ls -la <path>` or Read tool output showing the file | "I wrote the file" |
| Function behaves correctly | Test output or REPL output showing actual return value | "The logic looks right" |
| API responds correctly | Actual HTTP response body and status code | "The endpoint exists" |
| Dependency is installed | `package.json` or lockfile entry shown verbatim | "I installed it earlier" |
| Spec is met | Quoted spec requirement next to quoted output proving it | "This matches the spec" |
| No regressions | GUARD command output from this session | "Nothing was broken" |
| Migration ran | Migration log or schema diff output | "I ran the migration" |

---

## Verify + Guard Pattern

Every task execution uses two paired commands.

**VERIFY** — "Did this task accomplish its stated goal?"

Run after implementation. Produces an Evidence Block for each acceptance criterion. If any criterion fails, the task is not done.

**GUARD** — "Did this change break what was already working?"

Run after VERIFY passes. Executes the full test suite and any smoke checks that existed before the task started. If GUARD fails after VERIFY passes, the implementation introduced a regression.

### Regression Protocol

1. VERIFY passes, GUARD fails: attempt rework, limit 2 rework cycles
2. After 2 rework cycles: revert the change entirely, escalate to user
3. Do not merge a change where GUARD is failing

---

## Anti-Rationalization Table

These phrases indicate a verification failure. They are never acceptable as evidence.

| Forbidden Phrase | Why It Fails |
|---|---|
| "should work" | Describes expectation, not observed outcome |
| "I already checked" | Not verifiable in this session |
| "tests were passing before" | Stale evidence; fresh run required |
| "this is obviously correct" | Correctness is measured, not assessed by inspection |
| "I think it's fine" | No tool output, no claim |
| "the logic is sound" | Logic can be sound and still produce wrong output |
| "nothing changed in that area" | Changes in dependencies, configs, and imports are invisible to this claim |
| "it worked in my local run" | Local run is not this session's evidence unless tool output is shown |
| "we can verify later" | Verification deferred is verification skipped |
| "this is low risk" | Risk level does not substitute for evidence |

---

## Retry Logic

### Attempt Counting

Each task starts at attempt 1. A failed gate that triggers a rework cycle increments the attempt counter. Attempt count resets only when the task scope changes materially.

### Per-Attempt Rules

- **Attempt 1**: Execute normally. Collect full evidence. If gates pass, complete.
- **Attempt 2**: Fresh context. Do not carry forward assumptions from attempt 1. Re-read the spec. Re-run all gates from Gate 1.
- **Attempt 3**: Fresh agent context. Treat this as a cold start. Diagnose why attempts 1 and 2 failed before touching any code.

### After 3 Failures

Escalate to the user. The escalation must include:

1. The original task spec (quoted)
2. What was attempted in each of the 3 runs (brief, factual)
3. The specific gate that failed each time and the exact error output
4. A diagnostic summary: is this a spec problem, an environment problem, or an implementation problem?
5. A proposed next step (rewrite spec, fix environment, reduce scope)

Do not attempt a 4th run without user acknowledgment and revised instructions.

---

## Common Pitfalls

| Pitfall | Symptom | Correct Behavior |
|---|---|---|
| Caching test results | Reporting pass without re-running | Always run tests fresh; use `--no-cache` or equivalent |
| Partial lint scope | Running lint on one file, claiming lint is clean | Run lint on the entire affected module or project |
| Missing Gate 1 | Starting work before spec is confirmed | Always confirm acceptance criteria exist before writing code |
| Evidence copied from prior session | Referencing output not produced in this session | All evidence must come from tool calls in the current session |
| Verifying only the happy path | Tests pass but edge cases are untested | GUARD must include regression tests, not only new tests |
| Skipping Gate 4 after Gate 3 passes | Declaring done without regression check | Gate 3 and Gate 4 are both required; neither is optional |
| Conflating "no errors" with "correct output" | Exit code 0 but wrong behavior | Evidence must show correct output, not just absence of error |
| Writing evidence after the fact | Constructing output from memory | Run the command, capture the output, paste it verbatim |
