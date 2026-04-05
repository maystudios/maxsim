---
name: verification
description: Evidence-based verification with 2 quality gates (pre-check and post-check), anti-rationalization enforcement, and 3-step retry escalation. Used when completing tasks, verifying implementations, or before claiming work is done.
---

# Verification

<HARD-GATE name="verification-iron-law">

## The Iron Law

No completion claim is valid without fresh verification evidence produced in THIS session. Evidence from a prior session, a prior attempt, or reasoning about what "should" be true does not count. If the evidence was not collected by running a tool call in the current session, it does not exist.

</HARD-GATE>

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

## 2 Quality Gates

Gates run in order. A failure at any gate stops forward progress until resolved.

### Gate 1 — Pre-Check

Run before execution begins.

- Spec or task definition exists and is unambiguous
- Acceptance criteria are stated explicitly
- Git state is clean or the working branch is correctly scoped
- Dependencies are installed and match the lockfile
- No blocking issues from a previous failed run remain in the working tree

Failure action: Resolve the blocking state first. If the spec is unclear, return to requester with a clarifying question. Do not guess at requirements. Document what was found and what was done to fix it.

### Gate 2 — Post-Check

Run after implementation, before declaring done.

- All tests pass (fresh run, not cached)
- Build exits with code 0
- Lint is clean
- Every acceptance criterion is addressed with an Evidence Block
- No regressions introduced — GUARD command confirms this
- Code review concerns (if any were raised) are resolved
- No files are left in a modified-but-uncommitted state unless that is the intended deliverable
- Evidence Blocks are complete and attached to the work artifact
- Handoff contract or completion note is written if another agent will consume this output

Failure action: Fix failures. Do not skip a failing test. Do not suppress a lint error. Each fix resets the gate — re-run from the top of Gate 2.

---

## Verification Profiles

Three profiles control which gates and checks are required:

### strict

- Both gates mandatory (Pre-Check and Post-Check)
- Code review required
- All evidence blocks required
- GUARD regression check required

Use for: critical path work, breaking changes, security-sensitive code.

### standard

- Both gates mandatory (Pre-Check and Post-Check)
- Code review optional
- All evidence blocks required
- GUARD regression check required

Use for: normal feature and fix work. This is the default profile.

### fast

- Post-Check only (skip Pre-Check)
- No code review
- All evidence blocks required
- GUARD regression check recommended but not blocking

Use for: trivial changes, documentation updates, config tweaks.

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

<HARD-GATE name="anti-rationalization">

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

If you catch yourself using any phrase from this table, STOP immediately and gather real evidence via a tool call.

</HARD-GATE>

---

## Retry Escalation

When a gate fails, follow this 3-step escalation. Each step uses a fresh approach to avoid repeating the same mistake.

### Step 1 — Quick Fix (Attempt 1)

Standard fix attempt. Read the error output, fix inline, re-run gates.

- Read the exact error message from the gate failure
- Make the minimal fix to address the root cause
- Re-run the failed gate from the top
- If gates pass, complete normally

### Step 2 — Deeper Analysis (Attempt 2)

Fresh agent context. Re-read the spec from scratch. Diagnose root cause before touching code.

- Spawn a new executor agent (do NOT reuse the previous one)
- Provide the full task spec — do not assume prior context carries over
- Include the diagnostic summary from the Step 1 failure
- Diagnose why Step 1 failed before touching any code
- Run all gates from Gate 1 (Pre-Check)

### Step 3 — Codex Rescue (Attempt 3)

If multi-model is available (`config.execution.model_overrides` has entries), spawn a Codex or alternate model agent for a fresh perspective. Otherwise, use a fresh Claude agent with the full diagnostic context from Steps 1 and 2.

- Provide: original spec, Step 1 error, Step 2 error, root cause analysis
- The alternate agent starts clean — no assumptions from prior attempts
- Run all gates from Gate 1 (Pre-Check)

### After 3 Failures — Escalate

Do not attempt a 4th run without user acknowledgment and revised instructions.

Auto-reopen the GitHub Issue and post a diagnostic comment (see "Gate Failure: Auto Issue Reopen" below). The escalation must include:

1. The original task spec (quoted)
2. What was attempted in each of the 3 runs (brief, factual)
3. The specific gate that failed each time and the exact error output
4. A diagnostic summary: is this a spec problem, an environment problem, or an implementation problem?
5. A proposed next step (rewrite spec, fix environment, reduce scope)

---

## Common Pitfalls

| Pitfall | Symptom | Correct Behavior |
|---|---|---|
| Caching test results | Reporting pass without re-running | Always run tests fresh; use `--no-cache` or equivalent |
| Partial lint scope | Running lint on one file, claiming lint is clean | Run lint on the entire affected module or project |
| Missing Pre-Check | Starting work before spec is confirmed | Always confirm acceptance criteria exist before writing code |
| Evidence copied from prior session | Referencing output not produced in this session | All evidence must come from tool calls in the current session |
| Verifying only the happy path | Tests pass but edge cases are untested | GUARD must include regression tests, not only new tests |
| Skipping Post-Check | Declaring done without regression check | Both Pre-Check and Post-Check are required (unless using fast profile) |
| Conflating "no errors" with "correct output" | Exit code 0 but wrong behavior | Evidence must show correct output, not just absence of error |
| Writing evidence after the fact | Constructing output from memory | Run the command, capture the output, paste it verbatim |

---

## 5-Step Verification Process

When verification fails, follow this structured process:

1. **Run the check command one final time** — capture fresh output as evidence
2. **Construct diagnostic summary** — compare spec expectations vs actual output
3. **Identify root cause** — is it a spec problem, environment problem, or implementation problem?
4. **Propose next step** — rewrite spec, fix environment, reduce scope, or escalate
5. **Escalate if unresolved** — create a diagnostic GitHub Issue with all evidence

---

## Gate Failure: Auto Issue Reopen

When a task fails verification after all 3 retry attempts, automatically reopen the associated GitHub Issue and post a diagnostic comment:

```bash
# Reopen the issue
gh issue reopen #{issue_number}

# Post diagnostic comment with all 3 attempt summaries
gh issue comment #{issue_number} --body "..."
```

The comment body should include:

- **Task**: description of the task
- **Gate**: which gate failed
- **Profile**: which verification profile was active
- **Attempt 1 (Quick Fix)**: error and fix attempted
- **Attempt 2 (Deeper Analysis)**: root cause diagnosis and error
- **Attempt 3 (Codex Rescue)**: approach and error
- **Diagnosis**: classification (spec/environment/implementation) and proposed next step

Label the issue with `type:bug`, `maxsim:auto`, and `verification:failed`.

---

## Fresh Executor Context

Each retry attempt MUST use a fresh executor agent:

- Do NOT reuse the previous executor (spawn a new one)
- Provide the full task spec (do not assume prior context carries over)
- Include the diagnostic summary from the failed run
- Include revised instructions based on root cause analysis

Treat each fresh executor as a cold start. Do NOT reference or build upon any previous attempt's reasoning or partial work.
