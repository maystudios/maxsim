# MaxsimCLI Verification System Design

**Status:** Specification
**Version:** 1.0
**Date:** 2026-03-22

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Philosophy](#2-design-philosophy)
3. [Unified Verification Skill](#3-unified-verification-skill)
4. [Gate Framework](#4-gate-framework)
5. [Evidence Block Format](#5-evidence-block-format)
6. [What Counts as Valid Evidence](#6-what-counts-as-valid-evidence)
7. [Anti-Rationalization Enforcement](#7-anti-rationalization-enforcement)
8. [Verify + Guard Dual-Command Pattern](#8-verify--guard-dual-command-pattern)
9. [Retry Logic and Escalation Path](#9-retry-logic-and-escalation-path)
10. [Parallel Code Review](#10-parallel-code-review)
11. [TDD Integration](#11-tdd-integration)
12. [Spec Compliance Check](#12-spec-compliance-check)
13. [Auto-Detection of Verification Commands](#13-auto-detection-of-verification-commands)
14. [Evidence Persistence](#14-evidence-persistence)
15. [Competitive Implementation Verification](#15-competitive-implementation-verification)
16. [Regression Detection](#16-regression-detection)
17. [GitHub Integration](#17-github-integration)
18. [Implementation Roadmap](#18-implementation-roadmap)

---

## 1. Executive Summary

The MaxsimCLI Verification System is a unified framework of evidence-based quality enforcement gates applied across the full AI coding agent lifecycle. It merges what were previously three separate skills (verification-before-completion, verification-gates, evidence-collection) into a single coherent system with consistent enforcement language, dual-command patterns, retry logic, parallel review, and GitHub artifact integration.

The system's iron law:

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

Evidence must come from tool output produced in the current execution turn. Reasoning, confidence, and prior-turn output are not evidence. This principle applies without exception to every claim made by every agent in the MaxsimCLI system.

### Why This Exists

Evidence from 24+ documented failure patterns in the superpowers-reference corpus shows a consistent failure mode: AI agents claim completion based on reasoning rather than observation. The consequences are:

- Undefined functions shipped to production
- Missing acceptance criteria silently skipped
- Broken regressions counted as passing
- Human partners unable to trust agent output
- Time wasted redirecting from false completion claims

This system replaces agent-reported success with mandatory tool output at every gate.

---

## 2. Design Philosophy

### 2.1 Evidence Over Confidence

The verification system rests on a single epistemic principle: **tool output is truth; agent reasoning is hypothesis**. No matter how certain an agent is about the correctness of its work, that certainty is not evidence. The command must run. The output must be read. The exit code must be checked. Only then is a claim permitted.

This mirrors the scientific method applied to software: form hypothesis (implement), then test (verify), never assert conclusion without experiment.

### 2.2 Gates as Hard Stops, Not Suggestions

Gates in this system are not advisory checklists. They are blocking conditions. An agent that reaches a gate and does not have valid evidence cannot proceed. It cannot argue past the gate. It cannot declare the gate "close enough to pass." The gate either passes or fails, producing a structured result either way.

This design is informed by industry research on AI quality gates (Augment Code, Qodo, Ataccama, 2025-2026): quality gates must enforce standards automatically, intercepting failures before they reach downstream systems.

### 2.3 Freshness Requirement

Evidence expires between execution turns. Output from a previous turn cannot satisfy a current gate. This prevents the common failure where an agent runs tests once, gets a passing result, then makes additional changes and claims the previous passing result still applies.

The Anthropic Claude Code engineering team documented this explicitly: the agent feedback loop is "gather context → take action → verify work → repeat." Verification happens after each action, not once at the end.

### 2.4 Separation of Concerns

The verifier is always separate from the implementer. This is the core principle identified in the "When AI Writes the World's Software, Who Verifies It?" research (Leo de Moura, 2026): the verification layer must be architecturally independent from the code generation layer. In MaxsimCLI, this means:

- Implementation agents do not self-certify completion
- Fresh agents perform code review (not the implementing agent)
- Guard agents check regressions independently of fix agents
- The orchestrator, not the task agent, determines when a task passes review

---

## 3. Unified Verification Skill

### 3.1 Merger Rationale

MaxsimCLI previously distributed verification behavior across three skills:

| Old Skill | Primary Concern |
|-----------|----------------|
| `verification-before-completion` | 5-step process and evidence block format |
| `verification-gates` | Gate types, retry logic, escalation |
| `evidence-collection` | What counts as evidence, collection process |

These three skills share the same enforcement language, the same evidence block format, and the same iron law. Distributing them created drift risk: each skill could evolve independently, producing inconsistent enforcement. Agents loading only one skill would miss the full framework.

The unified `verification` skill consolidates all three into a single coherent document with clear internal sections. Skills referencing verification now point to one canonical source.

### 3.2 Unified Skill Structure

```
/skills/verification/SKILL.md
  Section 1: The Iron Law
  Section 2: The 5-Step Process (from verification-before-completion)
  Section 3: Evidence Block Format (from verification-before-completion, evidence-collection)
  Section 4: What Counts as Evidence (table, from all three)
  Section 5: Gate Types (from verification-gates)
  Section 6: Retry Protocol (from verification-gates)
  Section 7: Escalation Protocol (from verification-gates)
  Section 8: Anti-Rationalization Table (from all three)
  Section 9: Audit Trail (from verification-gates)
```

### 3.3 Skills That Reference Verification

The following skills cross-reference the unified verification skill:

- `tdd` → "See `/verification` for evidence-based confirmation after each TDD cycle"
- `systematic-debugging` → "See `/verification` for evidence-based confirmation after fixes"
- `code-review` → "See `/verification` for the evidence block format used in review output"
- `sdd` → "See `/verification` for the evidence-based verification methodology used within each SDD task"
- `input-validation` → "See `/verification-gates` for what happens when this gate fails"

---

## 4. Gate Framework

The gate framework defines four distinct checkpoints where verification is required. Each gate has a type, trigger condition, required evidence, and defined failure behavior.

### 4.1 Input Gate (Gate Type: INPUT)

**Trigger:** Agent startup, before any work begins.

**Purpose:** Verify all required inputs exist. Missing inputs at startup cause incorrect outputs at completion. Fail fast rather than producing wrong work.

**Required evidence:**
- File existence: `test -f "path"` or Read tool output showing the file exists
- Directory existence: `test -d "path"`
- Environment variable: `echo "$VAR"` confirming non-empty
- CLI argument: extracted from prompt context, present and non-empty

**Failure behavior:** Return structured error immediately. Do NOT proceed with partial inputs.

```
AGENT RESULT: INPUT VALIDATION FAILED

Missing:
- PLAN.md -- task specification; expected from orchestrator spawn prompt
- GITHUB_TOKEN -- required for GitHub API calls; expected from environment

Expected from: orchestrator spawn prompt and user environment
```

**Design note:** The input gate is always agent-side, never orchestrator-side. The agent validates its own context before starting, because only the agent knows what it needs. The orchestrator cannot pre-validate what each specialized agent requires.

### 4.2 Pre-Action Gate (Gate Type: PRE-ACTION)

**Trigger:** Before any destructive or irreversible action: file writes, git commits, PR creation, deployments, issue creation.

**Purpose:** Verify intent before execution. Irreversible actions that proceed on wrong assumptions are expensive to recover from.

**Required evidence:**
- State what will be changed (files, branches, issues)
- Confirm targets are correct: `git status`, `git branch`, file path verification
- Confirm no unintended side effects visible in current state

**Failure behavior:** Abort the action. Report what was wrong and what would have happened.

**Example (pre-commit gate):**
```
PRE-ACTION CHECK: About to commit to branch `feature/auth-refactor`

git status output:
  modified: src/auth/validator.ts
  modified: src/auth/validator.test.ts

Intended changes: auth validator + its tests. No unintended files. Proceeding.
```

**Example (failure):**
```
PRE-ACTION CHECK: About to commit to branch `main`

ABORT: Committing directly to main is not permitted by project conventions.
Action: Create feature branch first.
```

### 4.3 Completion Gate (Gate Type: COMPLETION)

**Trigger:** Before claiming any task, plan, or phase is done.

**Purpose:** Verify all done criteria are met with fresh tool output.

**This is a hard gate.** It cannot be passed by argument, by declaring criteria "minor," or by asserting "close enough." Either all done criteria have fresh evidence or the gate fails.

**Required evidence:**
- Every verification command from the task's `verify` block must be run fresh in this turn
- Every acceptance criterion must be checked and confirmed with tool output
- One evidence block per claim (or per group of claims verified by the same command)

**Failure behavior:** Gate remains open. Agent must fix the failing criteria before re-attempting.

**Partial success is failure.** If 7 of 8 acceptance criteria are met, the gate fails. The task is not complete.

### 4.4 Quality Gate (Gate Type: QUALITY)

**Trigger:** After implementation, before marking work as shippable or moving to the next task.

**Purpose:** Verify code quality standards are met beyond functional correctness.

**Required evidence:**
- Test suite: output showing 0 failures, full suite run (not targeted run)
- Build: exit code 0 from build command
- Lint: 0 errors (warnings acceptable per project configuration)
- Type check: 0 errors (where applicable)

**Failure behavior:** Fix quality issues before proceeding. Quality failures are not deferrable.

**Design note:** The quality gate is separate from the completion gate by design. A task can meet its acceptance criteria while having quality issues (e.g., all acceptance tests pass but lint has errors). Both gates must pass before work is considered done.

---

## 5. Evidence Block Format

Every verification claim must be supported by an evidence block. The format is canonical across all gates and all agents.

### 5.1 Standard Evidence Block

```
CLAIM: [what you are claiming, in specific terms]
EVIDENCE: [exact command run in THIS turn]
OUTPUT: [relevant excerpt of actual output — quote it, do not paraphrase]
VERDICT: PASS | FAIL
```

### 5.2 Rules for Evidence Blocks

**One block per claim.** Each distinct claim requires its own block. Exception: multiple claims verified by the same command output may share a block with a note.

**Quote the output.** Do not paraphrase. "Tests passed" is not an output excerpt. "34 passing (2s)" is. "Build complete." is not. "exit 0 - bundle: 142KB" is.

**THIS-turn only.** If the command was not run in this execution turn, it cannot appear in an evidence block. Evidence expires.

**Exit codes matter.** For commands that return exit codes, the exit code must be confirmed (0 = success, non-zero = failure). A command that produces passing-looking output but exits non-zero has failed.

### 5.3 Multi-Attempt Evidence Block (Retry Context)

When a gate fails and is retried, each retry produces an extended evidence block:

```
CLAIM: [what you are claiming]
ATTEMPT: 2/3
CHANGE SINCE LAST ATTEMPT: [specific change made]
EVIDENCE: [exact command run in THIS turn]
OUTPUT: [relevant excerpt of actual output]
VERDICT: PASS | FAIL
```

### 5.4 Escalation Evidence Block

When all 3 attempts are exhausted:

```markdown
## GATE FAILURE — ESCALATION

**Gate:** [gate type: INPUT | PRE-ACTION | COMPLETION | QUALITY]
**Attempts:** 3/3
**Final evidence:**

CLAIM: [claim]
EVIDENCE: [command]
OUTPUT: [output]
VERDICT: FAIL

**History:**
- Attempt 1: [what failed, what was tried]
- Attempt 2: [what failed, what was tried]
- Attempt 3: [what failed — escalating]

**Recommended action:** [specific next step for orchestrator or user]
```

---

## 6. What Counts as Valid Evidence

### 6.1 Evidence Table

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| "Tests pass" | Test command output showing 0 failures, full suite | Previous run, "should pass", partial run, targeted test only |
| "Build succeeds" | Build command with exit code 0 | Linter passing, "logs look clean", type check passing |
| "Bug is fixed" | Original failing test now passes | "Code changed, assumed fixed", symptom gone but no test |
| "Task complete" | All acceptance criteria checked with evidence | "I implemented everything in the plan" |
| "No regressions" | Full test suite passing | "I only changed one file" |
| "File created" | Read tool output or `test -f` output | "I ran the Write tool" |
| "Content correct" | Read tool showing expected content | "I wrote the correct content" |
| "API responds" | curl or fetch output with status code | "Server is running" without calling it |
| "Agent completed" | VCS diff showing changes | Agent reports "success" |
| "Requirements met" | Line-by-line checklist with evidence per item | "Tests passing means requirements met" |
| "Linter clean" | Linter output: 0 errors | "I reviewed the code manually" |
| "Type check passes" | TypeScript/type checker: 0 errors | "The code looks typed correctly" |
| "Regression test works" | Red-green cycle verified (fail → pass) | Test passes once |
| "PR is safe to merge" | Full review completed, all blockers resolved | "I think it looks good" |

### 6.2 Evidence Sources

Evidence must come from tool output. Accepted sources:

- **Test runner output:** Jest, pytest, Vitest, Mocha, RSpec, Go test, etc.
- **Build output:** npm run build, cargo build, go build, gradle build, etc.
- **Linter output:** ESLint, Prettier, Rubocop, golint, etc.
- **Type checker output:** tsc, mypy, pyright, etc.
- **VCS output:** git diff, git status, git log
- **File system checks:** test -f, test -d, Read tool output
- **API/HTTP calls:** curl output with status codes, fetch responses
- **CI/CD output:** GitHub Actions run logs, pipeline results

Rejected sources:

- Agent reasoning ("the logic is correct so...")
- Prior-turn output ("I already verified this")
- Partial commands ("I ran the test for that file")
- Assumed state ("the linter already passed so build should too")
- Agent self-reports ("my subagent said it completed successfully")

### 6.3 Evidence Staleness

Evidence is stale the moment additional changes are made after the evidence was gathered. If code is modified after tests were run, the test evidence is invalid. Re-run.

This is non-negotiable and frequently violated. The common pattern: agent runs tests, sees pass, makes "one small change," then claims tests pass based on the earlier result. The earlier result does not apply.

---

## 7. Anti-Rationalization Enforcement

### 7.1 The Forbidden Phrases Table

These phrases signal rationalization — the substitution of reasoning for evidence. When an agent uses these phrases, it is bypassing the verification requirement. Any phrase in this table is grounds for an immediate gate failure.

| Forbidden Phrase | Why It Is Forbidden |
|-----------------|---------------------|
| "should work" | "Should" is prediction, not observation. Run the command. |
| "probably passes" | Probability is not evidence. Run the command. |
| "I'm confident that..." | Confidence is internal state. Evidence is external output. |
| "based on my analysis..." | Analysis is reasoning. Gates require tool output. |
| "the logic suggests..." | Logic is not a testing framework. Run the test. |
| "it's reasonable to assume..." | Assumptions are not evidence. Verify the assumption. |
| "it's close enough" | Close is not done. The gate requires all criteria, not most. |
| "minor issue, will fix later" | Later is never. Fix it now or the gate fails. |
| "I already verified this" | In this turn? If not, it's stale. Re-run. |
| "linter passed" (as proxy for build) | Linter passing does not mean build passes. Different tools. |
| "agent said success" | Trust tool output and VCS diffs, not agent reports. |
| "I'm tired" | Exhaustion is not an excuse. Run the command. |
| "just this once" | No exceptions to the iron law. |
| "different words so rule doesn't apply" | Spirit over letter. Any implication of success is subject to the law. |
| "partial check is enough" | Partial proves nothing. Run the full suite. |
| "tests after achieve the same goals" | Tests-after prove what the code does. Tests-first prove what it should do. |

### 7.2 Enforcement Mechanism

The anti-rationalization table is enforced by the agent itself (self-enforcement) and by the orchestrator (cross-enforcement). Any time a rationalization phrase appears in an agent's response when a gate should be active, the orchestrator must flag it and require evidence before proceeding.

In the MaxsimCLI implementation, the `verification` skill loaded by every agent contains this table with the instruction: "Stop immediately if you catch yourself using any of these phrases."

### 7.3 Positive Reinforcement Pattern

The complement to the forbidden phrases table is the valid claim pattern:

```
VALID: [Run test command] → [See: 34/34 pass] → "All tests pass"
INVALID: "Should pass now" or "Looks correct"

VALID: [Run build] → [See: exit 0] → "Build passes"
INVALID: "Linter passed" (used as build proxy)

VALID: Re-read plan → Create checklist → Verify each item → "Phase complete with gaps at X"
INVALID: "Tests pass, phase complete"
```

---

## 8. Verify + Guard Dual-Command Pattern

### 8.1 Origin: Karpathy's AutoResearch

Andrej Karpathy's autoresearch project (released March 2026, 30,000+ GitHub stars in one week) demonstrated a core pattern for autonomous AI experimentation: the modify-verify-keep/discard loop. The pattern separates the *forward action* (modify, implement, fix) from the *verification action* (verify correctness) and the *regression check* (guard against baseline degradation).

In autoresearch, the pattern is:
```
Modify → Train → Verify metric improved → Guard (no regression on other metrics) → Keep or Discard → Repeat
```

The `verify` command checks the primary metric. The `guard` command checks for side-effect regressions. These are separate commands with separate concerns.

### 8.2 MaxsimCLI Adaptation

MaxsimCLI adapts this pattern to coding agents:

```
Implement → Verify (acceptance criteria) → Guard (no regressions) → Keep or Rollback
```

**Verify command:** Checks that the implementation satisfies the current task's acceptance criteria. This is the forward-checking pass.

**Guard command:** Checks that the implementation has not broken anything that was passing before the change. This is the backward-checking pass.

Both must pass before a task is considered complete. A task that passes verify but fails guard has introduced regressions and must be fixed or rolled back.

### 8.3 Command Specification

**Verify command behavior:**
1. Load the task's done criteria and acceptance tests
2. Run each verification command specified in the task's `verify` block
3. Produce an evidence block for each criterion
4. Return PASS only if all criteria produce PASS evidence blocks

**Guard command behavior:**
1. Establish baseline: what was passing before this change (from last known good state)
2. Run the full test suite (not the targeted test)
3. Compare result against baseline
4. Return PASS if pass rate is >= baseline; FAIL if any previously-passing test now fails
5. Produce an evidence block showing pass rate comparison

### 8.4 Dual-Command Invocation

In MaxsimCLI's task execution flow, verify and guard run sequentially after each task:

```
[Task implementation complete]
    ↓
/verify → PASS or FAIL
    ↓ (only if PASS)
/guard → PASS or FAIL
    ↓ (only if PASS)
Task marked complete → advance to next task
    ↓ (if FAIL at any point)
Retry protocol → escalation if 3 attempts exhausted
```

The guard command is downstream of verify. Running guard before verify is not meaningful — if the implementation does not satisfy the acceptance criteria, regression detection does not matter yet.

### 8.5 Chained Workflow

For debugging and fix cycles, the dual-command pattern chains:

```
/autoresearch:debug  → produces diagnostic evidence
    ↓
/autoresearch:fix    → implements fixes based on diagnostic
    ↓
/verify              → checks acceptance criteria
    ↓
/guard               → checks for regressions
    ↓
Result: KEEP (commit) or DISCARD (rollback)
```

This mirrors the autoresearch keep/discard pattern. Changes that do not produce clean verify + guard results are discarded, not committed.

---

## 9. Retry Logic and Escalation Path

### 9.1 Retry Parameters

- **Maximum attempts:** 3 (attempt 1 + 2 retries)
- **Agent policy:** Fresh agent per retry
- **Context policy:** Original task spec + failure evidence from previous attempt(s)

### 9.2 Why Fresh Agent Per Retry

A failing agent has context contamination: it has built a mental model that produced the incorrect implementation. Asking the same agent to fix its own failure is asking it to invalidate its own reasoning with the same reasoning. The success rate is low.

A fresh agent receives:
- The original task specification (what was supposed to be built)
- The failure evidence (what actually happened, with tool output)
- The specific failing criterion (which gate failed and why)

It does NOT receive:
- The previous agent's implementation reasoning
- The previous agent's attempted fixes
- The full conversation history

This is consistent with the fresh-agent-per-task principle in MaxsimCLI's SDD skill: context rot is the primary failure mode for multi-task execution, and fresh context prevents it.

Industry research on multi-agent systems (GitHub Blog, 2026) corroborates: "a separate verification agent reviews the output with fresh eyes using a different model, different prompt, and different perspective, with its only job being to find problems without investment in defending the original output."

### 9.3 Attempt Tracking

Each attempt is tracked with:
- Attempt number (1/3, 2/3, 3/3)
- What failed in the previous attempt
- What the new agent changed
- Fresh verification evidence

This tracking is included in the evidence block and posted to GitHub as a verification artifact comment.

### 9.4 Escalation Path

After 3 failed attempts, the system escalates through a defined path:

**Step 1: Systematic Debugging**
Spawn a debugging-specialized agent with the full failure history. This agent does not attempt fixes. It performs root cause investigation: reads errors carefully, traces data flow, identifies which layer is failing, and produces a diagnostic report.

Diagnostic agent output:
```
ROOT CAUSE ANALYSIS

Symptom: [what is failing]
Evidence trail: [tool outputs from each attempt]
Hypotheses tested: [what was tried and why it failed]
Root cause: [identified root cause with evidence]
Recommended approach: [specific next step]
Blocking question: [what the orchestrator or user must decide]
```

**Step 2: Rollback (if applicable)**
If the failing attempts have produced committed changes, rollback to the last known good state. The rollback is a pre-action gate: confirm what will be reverted before executing.

**Step 3: Diagnostic Issue**
If the root cause analysis cannot identify a fix path, or if the recommended approach requires architectural decisions, create a GitHub issue tagged `[DIAGNOSTIC]` with the full failure record. This surfaces the problem to the human partner for decision.

Diagnostic issue content:
- Task that failed
- All 3 attempt evidence blocks
- Root cause analysis output
- Options identified by the debugging agent
- Specific question requiring human decision

### 9.5 Three-Plus-Failures Signals Architectural Problem

Following the systematic-debugging skill pattern: if 3+ attempts fail and each reveals a new problem in a different place, the issue is likely not a bug in the implementation but a problem with the architecture or approach. The escalation in this case includes a recommendation to question the design, not to try a 4th fix.

---

## 10. Parallel Code Review

### 10.1 Design Rationale

Code review by the implementing agent is not independent review. Author bias (the implementing agent has invested reasoning into its approach) produces systematically blind review. The implementer cannot reliably catch what it missed during implementation.

Anthropic's Claude Code Review (launched for Teams and Enterprise, 2025) demonstrated the multi-agent parallel review pattern: "dispatches a team of agents who work in parallel, each looking for different types of errors." MaxsimCLI adopts this architecture.

### 10.2 Parallel Review Agent Roster

Three specialized review agents run concurrently after implementation:

**Security Review Agent**
- Scope: Injection vulnerabilities (SQL, shell, HTML, template strings), authentication gaps, authorization checks, data exposure (secrets in logs, overly broad responses), new dependency risks
- Output: SECURITY: PASS | ISSUES FOUND (list with severity)
- Blocking threshold: Any issue rated Blocker or High

**Quality Review Agent**
- Scope: Error handling (external calls wrapped, errors propagated, not swallowed), test coverage (every new public function has tests, both success and failure paths covered, edge cases tested), naming consistency, complexity justified by requirements
- Output: QUALITY: PASS | ISSUES FOUND (list with severity)
- Blocking threshold: Missing critical tests (High), uncaught error paths (High)

**Efficiency Review Agent**
- Scope: Performance regressions (algorithmic complexity, unnecessary re-computation, N+1 patterns), resource leaks, dead code, duplication that creates maintenance burden
- Output: EFFICIENCY: PASS | ISSUES FOUND (list with severity)
- Blocking threshold: Confirmed performance regression (High)

### 10.3 Review Aggregation

A judge agent (following the HubSpot Sidekick pattern, documented in InfoQ, March 2026) aggregates the three review agents' findings:

1. De-duplicate findings that appear in multiple reviews
2. Resolve conflicts (one agent rates High, another rates Medium — take the higher)
3. Filter false positives: findings not supported by code evidence are dropped
4. Rank remaining findings by impact
5. Produce final review verdict

Final verdict format:

```
REVIEW SCOPE: [N] files changed, [N] additions, [N] deletions

SECURITY: PASS | ISSUES FOUND
  - [severity] [description] [file:line]

QUALITY: PASS | ISSUES FOUND
  - [severity] [description] [file:line]

EFFICIENCY: PASS | ISSUES FOUND
  - [severity] [description] [file:line]

VERDICT: APPROVED | BLOCKED
Blocking issues: [list if BLOCKED]
Follow-up issues: [Medium severity items to file]
```

### 10.4 Review Scaling

Following the Anthropic pattern: review depth scales with change size.

| PR/Change Size | Review Mode |
|----------------|-------------|
| < 50 lines | Lightweight pass: 1 agent per dimension, no judge |
| 50-500 lines | Standard: 3 parallel agents + judge |
| > 500 lines | Deep: 3 parallel agents per section + judge with consensus |

### 10.5 Spec Review vs Code Review

The parallel code review covers code quality. A separate spec review covers requirement compliance. Both are required before a task is marked complete.

| Dimension | Spec Review | Code Review |
|-----------|------------|-------------|
| Question | Does it match the requirements? | Is the code correct and quality? |
| Checks | Acceptance criteria, requirement coverage, scope | Security, interfaces, errors, tests, efficiency |
| Output | PASS/FAIL per requirement | APPROVED/BLOCKED per dimension |
| Agent | Single spec-compliance agent | Three parallel specialized agents |

---

## 11. TDD Integration

### 11.1 TDD as Verification Front-Load

Test-driven development is the verification system applied before implementation rather than after. It is not a separate system — it is verification shifted earlier in the development loop. The red-green-refactor cycle is itself a series of evidence-gathering steps.

### 11.2 Red-Green-Refactor Within the Gate Framework

Each TDD cycle step maps to a verification gate:

**RED phase — write failing test:**
- Pre-action gate: confirm the test file and test runner are ready
- Write the test
- Completion gate: test must fail (not error) with the expected failure message
  - Evidence: `npm test path/to/test` output showing failure
  - Verdict: PASS only if test fails with assertion (not syntax error or import error)

**Verify RED (mandatory, never skip):**
- Evidence block required:
  ```
  CLAIM: Test fails for the expected reason (feature missing, not a bug in the test)
  EVIDENCE: npm test src/auth/validator.test.ts
  OUTPUT: FAIL: expected 'Email required', got undefined
  VERDICT: PASS
  ```
- If the test passes immediately: the test is testing existing behavior — rewrite it
- If the test errors: fix the error and re-run; do not proceed until it fails with an assertion

**GREEN phase — write minimal code:**
- Pre-action gate: confirm the test is failing for the right reason before writing code
- Write the minimum code to pass the test (no YAGNI)
- Completion gate: the new test passes AND all existing tests pass

**Verify GREEN (mandatory):**
- Evidence block required:
  ```
  CLAIM: New test passes and no regressions
  EVIDENCE: npm test
  OUTPUT: 35 passing (3s), 0 failing
  VERDICT: PASS
  ```
- If any test fails: fix code, not tests

**REFACTOR phase:**
- Quality gate: confirm refactoring does not add behavior
- Pre-action gate: confirm current state is fully green before starting
- Completion gate: all tests still pass after refactoring

### 11.3 TDD Commit Pattern

Each TDD cycle produces atomic commits:

```
RED commit:      test({scope}): add failing test for [feature]
GREEN commit:    feat({scope}): implement [feature]
REFACTOR commit: refactor({scope}): clean up [feature]   (if changes made)
```

These commit messages serve as audit evidence: the presence of a RED commit before a GREEN commit proves TDD was followed.

### 11.4 TDD Red Flags as Gate Failures

These conditions trigger an automatic gate failure in the TDD flow:

| Condition | Gate Failure |
|-----------|-------------|
| Code written before test exists | Quality gate FAIL: "Production code found without prior test commit" |
| Test passes immediately on first run | Completion gate FAIL: "Test passes immediately — testing existing behavior" |
| VERIFY RED step skipped | Evidence gate FAIL: "No evidence that test failed before implementation" |
| Test written after implementation | Quality gate FAIL: "Test commit is after implementation commit" |
| Full suite not run for VERIFY GREEN | Completion gate FAIL: "Only targeted test run — no regression evidence" |

---

## 12. Spec Compliance Check

### 12.1 What Spec Compliance Checks

The spec compliance check answers: "Does the implementation match the planned specification?" This is distinct from code quality (which asks "Is the code well written?") and from functional testing (which asks "Does the code work?").

A task can pass all tests and produce quality code while still failing spec compliance — for example, if it implements a different interface than what was specified, or if it addresses only 4 of 6 planned acceptance criteria.

### 12.2 Compliance Check Process

1. **Load the spec:** Read the task's acceptance criteria from PLAN.md or the GitHub issue task spec
2. **List implementation:** Run `git diff` against the task start state to see all changes
3. **Map spec to implementation:** For each acceptance criterion, identify which changes satisfy it
4. **Gap analysis:** Criteria with no implementation evidence are gaps
5. **Scope check:** Changes with no corresponding acceptance criterion are scope drift

### 12.3 Compliance Check Output

```
SPEC COMPLIANCE CHECK

Planned acceptance criteria: [N]
Implemented: [N]
Gaps: [N]
Scope drift: [N]

CRITERIA:
- [AC-1] [description] → PASS (evidence: [file:function])
- [AC-2] [description] → PASS (evidence: [file:function])
- [AC-3] [description] → FAIL (no corresponding implementation found)

SCOPE DRIFT:
- [change description] → Not in spec (file: [path])

VERDICT: COMPLIANT | NON-COMPLIANT
```

### 12.4 Handling Non-Compliance

**Gaps (missing implementation):** Return to implementation. The task is not complete.

**Scope drift (extra implementation):** Flag for human decision. Extra scope may be:
- Necessary for the spec to work (acceptable, document it)
- Bonus work that was not planned (flag as unplanned change, may need its own task)
- Misunderstanding of the spec (remove it, clarify spec)

Scope drift is not automatically a failure, but it is always surfaced and never silently accepted.

### 12.5 Planned Tasks vs Actual Implementation

At the phase level (not just the task level), a phase spec compliance check compares the full list of planned tasks against what was actually implemented:

| Check | Question |
|-------|---------|
| Task coverage | Were all planned tasks completed? |
| Task scope | Did each task stay within its planned scope? |
| Unplanned tasks | Were tasks executed that were not in the phase plan? |
| Order compliance | Were dependencies respected (task B after task A)? |

Phase spec compliance is checked before closing a phase issue and creating the phase PR.

---

## 13. Auto-Detection of Verification Commands

### 13.1 Problem

Different projects use different testing frameworks, build tools, and linters. A verification system that requires manual configuration of "run npm test" vs "run pytest" vs "run cargo test" adds friction and creates misconfiguration risk.

### 13.2 Detection Strategy

MaxsimCLI auto-detects verification commands by inspecting project files in a priority order. Detection runs once at project initialization and is cached in `config.json`.

**Test runner detection:**

```
Detection priority:
1. package.json → "scripts.test" field
2. pyproject.toml → [tool.pytest.ini_options] presence
3. Cargo.toml → presence → cargo test
4. go.mod → presence → go test ./...
5. Gemfile → rspec presence → bundle exec rspec
6. build.gradle → test task
7. Makefile → "test" target
8. .github/workflows/*.yml → test job commands

Fallback: prompt user to specify test command
```

**Build tool detection:**

```
Detection priority:
1. package.json → "scripts.build"
2. Cargo.toml → cargo build
3. go.mod → go build ./...
4. build.gradle → ./gradlew build
5. Makefile → "build" target
6. Dockerfile → docker build

Fallback: prompt user to specify build command
```

**Linter detection:**

```
Detection priority:
1. .eslintrc.* → eslint .
2. .pylintrc or pyproject.toml [tool.pylint] → pylint
3. .rubocop.yml → rubocop
4. golangci.yml → golangci-lint run
5. Clippy (Rust) → cargo clippy
6. package.json scripts.lint → npm run lint

Fallback: skip lint verification, note in evidence block
```

**Type checker detection:**

```
Detection priority:
1. tsconfig.json → npx tsc --noEmit
2. mypy.ini or pyproject.toml [tool.mypy] → mypy
3. pyrightconfig.json → pyright
4. .flowconfig → flow check

Fallback: skip type check, note in evidence block
```

### 13.3 Detection Output

Auto-detection produces a verification command manifest stored in `config.json`:

```json
{
  "verification": {
    "test": "npm test",
    "build": "npm run build",
    "lint": "npx eslint .",
    "typecheck": "npx tsc --noEmit",
    "detected_at": "2026-03-22T10:00:00Z",
    "detection_method": {
      "test": "package.json:scripts.test",
      "build": "package.json:scripts.build",
      "lint": ".eslintrc.json presence",
      "typecheck": "tsconfig.json presence"
    }
  }
}
```

### 13.4 Override and Extension

Projects can override detected commands in `config.json`. Common extension points:

- `verification.test_targeted`: command for targeted single-file test (used in TDD RED/GREEN phases)
- `verification.test_full`: command for full suite (used in guard and completion gates)
- `verification.custom`: array of additional commands to run at quality gate

---

## 14. Evidence Persistence

### 14.1 What Gets Persisted

Verification evidence is persisted at two levels:

**Per-attempt evidence:** Each gate attempt produces an evidence block. All attempts are retained, not just the final result.

**Per-task evidence:** The final evidence state for a completed task — all gate results (INPUT, PRE-ACTION, COMPLETION, QUALITY), the parallel review verdict, and the spec compliance result.

**Per-phase evidence:** Aggregated evidence across all tasks in a phase, used for phase completion gate.

### 14.2 Local Storage

Evidence is stored locally in the `.planning/` directory:

```
.planning/
  evidence/
    phase-{N}/
      task-{ID}/
        gate-input.json
        gate-pre-action.json
        gate-completion.json
        gate-quality.json
        review-verdict.json
        spec-compliance.json
        attempts/
          attempt-1.json
          attempt-2.json
          attempt-3.json
      phase-completion.json
```

**Evidence file format:**

```json
{
  "gate": "COMPLETION",
  "task_id": "task-12",
  "phase": 3,
  "timestamp": "2026-03-22T14:32:00Z",
  "attempt": 1,
  "claims": [
    {
      "claim": "All tests pass",
      "evidence": "npm test",
      "output": "35 passing (3s), 0 failing",
      "verdict": "PASS"
    }
  ],
  "final_verdict": "PASS"
}
```

### 14.3 GitHub Persistence

Evidence is also posted to GitHub Issues as typed comments, using the MaxsimCLI GitHub Artifact Protocol. This creates a durable audit trail visible to the human partner without reading local files.

Evidence comment type: `verification`
GitHub comment header: `<!-- maxsim:type=verification -->`

GitHub evidence comment format:

```markdown
<!-- maxsim:type=verification -->
## Verification Evidence — Task [ID]: [Name]

**Gate:** COMPLETION | Attempt 1/3 | 2026-03-22 14:32

**Claims:**

CLAIM: All tests pass
EVIDENCE: `npm test`
OUTPUT: `35 passing (3s), 0 failing`
VERDICT: PASS

CLAIM: Build succeeds
EVIDENCE: `npm run build`
OUTPUT: `exit 0 — bundle: 142KB`
VERDICT: PASS

**Final Verdict:** PASS
```

### 14.4 Retention Policy

- Local evidence: retained for the life of the project (no auto-deletion)
- GitHub evidence comments: permanent (GitHub issue history)
- Failed attempt evidence: retained alongside success evidence (not overwritten)
- Phase evidence: rolled up into phase summary at phase completion

### 14.5 Evidence Lookup

The `github post-comment --type verification` command (from the GitHub Artifact Protocol) handles posting. Evidence lookup is by:

- Task ID → reads `evidence/phase-{N}/task-{ID}/` directory
- Phase → reads `evidence/phase-{N}/phase-completion.json`
- Gate type → filters within a task directory

---

## 15. Competitive Implementation Verification

### 15.1 When to Use Competitive Verification

Competitive implementation verification spawns N independent agents implementing the same task with the same specification, then verifies all N implementations and selects the best. This is appropriate when:

- The task has high ambiguity in implementation approach
- Multiple valid approaches exist with different tradeoffs
- Performance or efficiency is a primary concern and the optimal approach is unclear
- The task is high-risk and a single agent's implementation may have blind spots

### 15.2 Process

**Phase 1: Parallel Implementation**
Spawn N agents (typically N=2 or N=3) simultaneously. Each agent:
- Receives the same task specification
- Works in an isolated branch (`feature/task-{ID}-candidate-{n}`)
- Implements independently without knowledge of other candidates
- Runs its own verify + guard dual-command cycle

**Phase 2: Independent Verification**
Each candidate implementation is verified independently. Only implementations that pass both verify and guard are eligible for comparison.

**Phase 3: Comparative Analysis**
A separate evaluation agent (not any of the implementers) compares the passing implementations across:

```
COMPARATIVE ANALYSIS: Task [ID]

Candidates evaluated: [N] submitted, [K] passed verification

Comparison dimensions:
  Test coverage:    [candidate A: 94%] [candidate B: 87%] [candidate C: N/A - failed guard]
  Code complexity:  [candidate A: cyclomatic 3] [candidate B: cyclomatic 7]
  Performance:      [candidate A: 12ms p50] [candidate B: 8ms p50]
  Bundle impact:    [candidate A: +2.1KB] [candidate B: +3.4KB]
  Review verdict:   [candidate A: APPROVED] [candidate B: APPROVED]

RECOMMENDED: Candidate A
RATIONALE: Better test coverage, lower complexity, marginal performance difference
TRADE-OFF: 4ms slower on p50 — acceptable given complexity reduction
```

**Phase 4: Selection and Integration**
Selected candidate is merged to the feature branch. Rejected candidates are closed. Selection rationale is posted as a GitHub comment.

### 15.3 Evidence Requirements for Competitive Verification

Each candidate must provide a full evidence record:
- Input gate PASS
- TDD evidence (RED and GREEN commits)
- Verify gate PASS
- Guard gate PASS
- Parallel code review PASS
- Spec compliance PASS

A candidate without a complete evidence record is automatically disqualified.

### 15.4 Blind Evaluation Protocol

The evaluation agent is given the implementations without knowing which agent produced them. Labels are "Candidate A," "Candidate B," etc. This mirrors the blind protocol used in competitive benchmarking (Galileo AI, 2025): the same evaluator scores all competitors per prompt, ensuring consistency.

---

## 16. Regression Detection

### 16.1 The Guard Pattern

Regression detection in MaxsimCLI is implemented as the `guard` command, derived from the autoresearch guard contribution (Pronskiy / JetBrains, PR #7). The guard command's sole purpose is to detect whether a change degraded any previously-passing metric.

### 16.2 Baseline Establishment

The regression baseline is the last known good state — the state at which all tests were passing before the current task began. This baseline is captured at the start of each task as part of the input gate:

```json
{
  "baseline": {
    "captured_at": "2026-03-22T10:00:00Z",
    "git_sha": "abc123",
    "test_results": {
      "total": 34,
      "passing": 34,
      "failing": 0,
      "by_suite": {
        "auth": { "passing": 12, "failing": 0 },
        "api": { "passing": 14, "failing": 0 },
        "utils": { "passing": 8, "failing": 0 }
      }
    }
  }
}
```

Baseline is stored in `evidence/phase-{N}/task-{ID}/baseline.json`.

### 16.3 Guard Check Process

1. Run the full test suite (same command as baseline capture)
2. Parse results by suite (not just overall count)
3. Compare per-suite pass rates against baseline
4. A regression is any suite with fewer passing tests than baseline
5. Produce guard evidence block

**Guard PASS:**
```
CLAIM: No regressions introduced
EVIDENCE: npm test
OUTPUT: 35 passing (3s), 0 failing
BASELINE: 34 passing, 0 failing
DELTA: +1 new test passing, 0 regressions
VERDICT: PASS
```

**Guard FAIL:**
```
CLAIM: No regressions introduced
EVIDENCE: npm test
OUTPUT: 32 passing, 2 failing
BASELINE: 34 passing, 0 failing
DELTA: -2 tests (auth suite: 10/12 → 10/12 ✓, api suite: 14/14 → 12/14 ✗)
REGRESSION: api.test.ts — 2 tests failing that passed in baseline
VERDICT: FAIL
```

### 16.4 Per-Suite Tracking Requirement

The guard checks per-suite pass rates, not just aggregate counts. This is the critical insight from the autoresearch regression threshold: "an aggregate pass rate can mask regressions — if your overall pass rate goes from 72% to 78% but your email skill accuracy drops from 90% to 60%, you have a problem."

If the full test suite grows from 34 to 36 tests but the api suite drops from 14/14 to 12/14, the aggregate looks like improvement (+2 tests) while hiding a regression (-2 tests). Per-suite tracking catches this.

### 16.5 Continuous Guard in Autoresearch Mode

When MaxsimCLI runs in autoresearch mode (iterative autonomous improvement), the guard runs after every iteration — not just at task completion. The guard acts as a keep/discard decision:

```
Iteration N completes:
  → /verify: PASS (target metric improved)
  → /guard: PASS (no regressions in any suite)
  → KEEP: commit iteration N

Iteration M completes:
  → /verify: PASS (target metric improved)
  → /guard: FAIL (regression in auth suite)
  → DISCARD: revert iteration M, restore baseline
  → Log: regression found in iteration M, discarded
```

---

## 17. GitHub Integration

### 17.1 Integration Architecture

MaxsimCLI posts verification results to GitHub Issues using the GitHub Artifact Protocol. Verification results are typed comments (`maxsim:type=verification`) on the active phase issue or task sub-issue.

Security design: the GitHub integration is write-only for comments and issue state. Read access for issue content. No direct repository write access from the verification system — all code commits happen through the agent's standard git workflow.

### 17.2 What Gets Posted

| Event | Comment Type | Destination |
|-------|-------------|-------------|
| Gate attempt (any gate) | `verification` | Task sub-issue |
| Gate PASS (final) | `verification` | Task sub-issue |
| Gate FAIL + escalation | `verification` | Task sub-issue |
| Parallel review verdict | `verification` | Task sub-issue or PR |
| Spec compliance result | `verification` | Task sub-issue |
| Phase completion evidence | `verification` | Phase issue |
| Diagnostic issue creation | (new issue) | Repo issues list |

### 17.3 Gate Result Comment Format

Each gate result is posted immediately when it completes (not batched):

```markdown
<!-- maxsim:type=verification -->
## Gate Result — [GATE TYPE] | Task [ID] | Attempt [N]/3

**Timestamp:** 2026-03-22T14:32:00Z
**Result:** PASS | FAIL

### Evidence

CLAIM: [claim]
EVIDENCE: `[command]`
OUTPUT:
```
[exact output excerpt]
```
VERDICT: PASS | FAIL

### Next Action
[what happens next: advance, retry, escalate]
```

### 17.4 PR Review Comment Format

When parallel code review completes on a PR, the aggregated verdict is posted as a PR review comment:

```markdown
<!-- maxsim:type=verification -->
## MaxsimCLI Code Review

**Scope:** [N] files, [+N/-N] lines
**Reviewed:** 2026-03-22T14:32:00Z

| Dimension | Result |
|-----------|--------|
| Security | PASS |
| Quality | ISSUES FOUND |
| Efficiency | PASS |

**Issues Found:**

- [HIGH] Missing error handling in `src/api/handler.ts:42` — external call not wrapped
- [MEDIUM] Naming inconsistency: `userObj` vs `user` in same scope (`src/api/handler.ts:67`)

**Verdict:** BLOCKED — 1 blocking issue must be resolved before merge.

*MaxsimCLI Verification System — Agents: security-reviewer, quality-reviewer, efficiency-reviewer, judge*
```

### 17.5 Diagnostic Issue Format

When escalation reaches the diagnostic issue step:

```markdown
## [DIAGNOSTIC] Task [ID]: [Task Name] — Gate [TYPE] Failed After 3 Attempts

**Phase:** [N] | **Plan:** [N]
**Created:** 2026-03-22T14:32:00Z

### What Was Attempted

[Task description from PLAN.md]

### Failure Record

**Attempt 1:**
- Changed: [description]
- Evidence: `[command]` → [output excerpt]
- Failure: [specific failure]

**Attempt 2:**
- Changed: [description]
- Evidence: `[command]` → [output excerpt]
- Failure: [specific failure]

**Attempt 3:**
- Changed: [description]
- Evidence: `[command]` → [output excerpt]
- Failure: [specific failure]

### Root Cause Analysis

[Output from debugging agent]

### Options Identified

1. [Option A with tradeoffs]
2. [Option B with tradeoffs]

### Decision Required

[Specific question requiring human decision]

---
*MaxsimCLI Verification System — Escalated after 3 failed attempts*
```

### 17.6 GitHub Agentic Workflows Integration

GitHub's Agentic Workflows (in technical preview, February 2026) enable MaxsimCLI to trigger verification on PR events without a separate CI configuration. The verification system can be triggered by:

- PR opened → run parallel code review
- PR updated (new commits) → re-run guard check
- PR approved → run final spec compliance check before merge

This integrates MaxsimCLI verification directly into the GitHub review lifecycle, posting results as PR comments within the same flow where developers review code.

---

## 18. Implementation Roadmap

### Phase 1: Unified Skill and Gate Framework

**Goal:** Merge the three verification skills and implement the four gate types.

Tasks:
1. Create `/templates/skills/verification/SKILL.md` consolidating verification-before-completion, verification-gates, evidence-collection
2. Update cross-references in tdd, systematic-debugging, code-review, sdd, input-validation skills
3. Implement gate framework in MaxsimCLI core: `gate(type, evidenceFn)` function
4. Implement evidence block serialization
5. Wire gates into task execution flow (input gate at spawn, completion gate at finish)

Acceptance criteria:
- Single verification skill exists, three old skills removed or redirected
- All four gate types implemented with correct trigger conditions
- Evidence blocks produced in correct format
- Gate failures return structured errors

### Phase 2: Verify + Guard Dual-Command

**Goal:** Implement the verify and guard commands with baseline tracking.

Tasks:
1. Auto-detect verification commands from project files, store in `config.json`
2. Implement `/verify` command: runs acceptance criteria checks, produces evidence blocks
3. Implement baseline capture at task start
4. Implement `/guard` command: runs full suite, compares per-suite against baseline
5. Wire verify → guard sequence into task completion flow

Acceptance criteria:
- Auto-detection covers npm, Python, Go, Rust, Ruby project types
- Verify command produces evidence block per acceptance criterion
- Guard command detects per-suite regressions (not just aggregate)
- Baseline captured and stored at task start

### Phase 3: Retry Logic and Escalation

**Goal:** Implement 3-attempt retry with fresh agent and escalation path.

Tasks:
1. Implement attempt counter with fresh-agent spawning per retry
2. Pass failure evidence (not full context) to fresh retry agents
3. Implement debugging-specialized agent for root cause analysis after 3 failures
4. Implement rollback command for failed task cleanup
5. Implement diagnostic issue creation

Acceptance criteria:
- Maximum 3 attempts per gate
- Fresh agent spawned for each retry
- Escalation produces debugging agent root cause report
- Diagnostic issue posted to GitHub with full failure record

### Phase 4: Parallel Code Review

**Goal:** Implement three-agent parallel review with judge aggregation.

Tasks:
1. Implement security-reviewer agent with injection, auth, data exposure checks
2. Implement quality-reviewer agent with error handling, test coverage, convention checks
3. Implement efficiency-reviewer agent with performance, resource, duplication checks
4. Implement judge agent for finding de-duplication and false positive filtering
5. Implement review scaling (lightweight/standard/deep based on diff size)
6. Wire review into task completion flow after verify + guard

Acceptance criteria:
- Three agents run in parallel on implementation diffs
- Judge produces final verdict with blocking/follow-up classification
- Review scales by diff size
- Review verdict posted to GitHub as PR comment

### Phase 5: TDD Integration and Spec Compliance

**Goal:** Enforce TDD cycle within the verification gate framework and add spec compliance checking.

Tasks:
1. Implement TDD gate sequence: RED verification → GREEN verification → REFACTOR verification
2. Implement commit-based TDD audit (RED commit must precede GREEN commit)
3. Implement spec compliance checker: load acceptance criteria, map to implementation, produce gap analysis
4. Implement phase-level spec compliance: planned tasks vs completed tasks
5. Implement competitive implementation verification (N-candidate parallel spawn)

Acceptance criteria:
- TDD red flags trigger automatic gate failures
- Commit pattern (test before implementation) verified by commit timestamp
- Spec compliance check identifies gaps and scope drift
- Phase compliance checked before phase PR creation
- N-candidate comparison produces ranked selection with rationale

### Phase 6: Evidence Persistence and GitHub Integration

**Goal:** Persist all evidence locally and to GitHub Issues.

Tasks:
1. Implement local evidence storage in `.planning/evidence/` directory structure
2. Implement GitHub evidence comment posting via `github post-comment --type verification`
3. Implement diagnostic issue creation via GitHub API
4. Implement PR review comment posting from parallel code review verdict
5. Implement per-attempt tracking in GitHub comments (attempt 1/3, 2/3, 3/3)

Acceptance criteria:
- All gate attempts persisted locally in structured JSON
- Evidence posted to GitHub Issues immediately on gate completion
- Diagnostic issues include full failure record and decision question
- PR review comments appear as structured MaxsimCLI review with dimension breakdown

---

## Appendix A: Evidence Block Cheat Sheet

```
Standard:
CLAIM: [specific claim]
EVIDENCE: [exact command, this turn]
OUTPUT: [quoted output excerpt]
VERDICT: PASS | FAIL

Retry:
CLAIM: [specific claim]
ATTEMPT: [N]/3
CHANGE SINCE LAST ATTEMPT: [specific change]
EVIDENCE: [exact command, this turn]
OUTPUT: [quoted output excerpt]
VERDICT: PASS | FAIL

Escalation:
## GATE FAILURE — ESCALATION
Gate: [TYPE] | Attempts: 3/3
[final evidence block]
History: [attempt 1-3 summary]
Recommended action: [specific next step]
```

## Appendix B: Forbidden Phrases Quick Reference

Stop immediately if you write any of these:

> should work / probably passes / I'm confident / based on my analysis / the logic suggests / it's reasonable to assume / it's close enough / minor issue will fix later / I already verified this / linter passed / agent said success / I'm tired / just this once / different words so rule doesn't apply / partial check is enough / tests after achieve the same goals

## Appendix C: Gate Decision Tree

```
Agent starts task
    ↓
INPUT GATE → FAIL? → Return structured error, abort
    ↓ PASS
Begin implementation
    ↓
[Before destructive action]
PRE-ACTION GATE → FAIL? → Abort action, report
    ↓ PASS
Execute action
    ↓
[Implementation complete]
/verify → FAIL? → Retry (max 3) → Escalate
    ↓ PASS
/guard → FAIL? → Retry (max 3) → Escalate
    ↓ PASS
Parallel code review → BLOCKED? → Fix issues → Re-review
    ↓ APPROVED
Spec compliance check → NON-COMPLIANT? → Fix gaps → Re-check
    ↓ COMPLIANT
QUALITY GATE → FAIL? → Fix quality issues → Re-run
    ↓ PASS
Task marked COMPLETE → post evidence to GitHub → advance
```

## Appendix D: Verification Command Manifest Example

```json
{
  "verification": {
    "test": "npm test",
    "test_targeted": "npm test -- --testPathPattern",
    "test_full": "npm test",
    "build": "npm run build",
    "lint": "npx eslint . --ext .ts,.tsx",
    "typecheck": "npx tsc --noEmit",
    "custom": [],
    "detected_at": "2026-03-22T10:00:00Z",
    "detection_method": {
      "test": "package.json:scripts.test",
      "build": "package.json:scripts.build",
      "lint": ".eslintrc.json presence",
      "typecheck": "tsconfig.json presence"
    }
  }
}
```

---

*MaxsimCLI Verification System Design — v1.0 — 2026-03-22*
