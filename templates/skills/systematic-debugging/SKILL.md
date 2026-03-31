---
name: systematic-debugging
description: Systematic debugging via reproduce-hypothesize-isolate-verify-fix-confirm cycle. Requires evidence at each step. Used when encountering bugs, test failures, or unexpected behavior.
---

# Systematic Debugging

Find the root cause first. Random fixes waste time and create new bugs.

**No fix attempts without understanding root cause.** Completing REPRODUCE and HYPOTHESIZE is mandatory before proposing any fix.

## The 6-Step Process

### 1. REPRODUCE — Confirm the Problem

- Run the failing command or test. Capture the EXACT error output.
- Can it be triggered reliably? What are the exact steps?
- If not reproducible: gather more data — do not guess.

**Output:** Exact reproduction steps and full error output. Nothing moves forward without this.

### 2. HYPOTHESIZE — Form a Theory

- Read the error message completely: stack trace, line numbers, exit codes.
- Check recent changes: `git diff`, recent commits, new dependencies.
- Trace data flow: where does the bad value originate?
- State the hypothesis explicitly: "I think X is the root cause because Y."

**Output:** One clear hypothesis with evidence supporting it.

### 3. ISOLATE — Narrow the Scope

- Find the smallest reproduction case.
- In multi-component systems, add diagnostic logging at each boundary.
- Identify which specific layer or component is failing.
- Compare against working examples in the codebase.

**Output:** The smallest failing case and the specific component responsible.

### 4. VERIFY — Test the Hypothesis

- Make the smallest possible change to test the hypothesis.
- Change one variable at a time — never multiple things simultaneously.
- If hypothesis is wrong: form a new hypothesis. Do not stack fixes.

**Output:** Confirmed or rejected hypothesis, with evidence from the test.

### 5. FIX — Address the Root Cause

- Write a failing test that reproduces the bug (when applicable).
- Implement a single fix that addresses the root cause.
- No "while I'm here" improvements — fix only the identified issue.

**Output:** A minimal fix that targets exactly the identified root cause.

### 6. CONFIRM — Verify the Fix

- Run the original failing test: it must now pass.
- Run the full test suite: no regressions.
- Verify the original error no longer occurs.

**Output:** Evidence that the bug is fixed and nothing is broken.

## Hypothesis Testing Protocol

For each hypothesis:

1. **Form:** "I think X is the root cause because Y."
2. **Design test:** "If X is the cause, then changing Z should produce W."
3. **Run test:** Execute the change and observe the result.
4. **Evaluate:** Did the result match the prediction? If yes, proceed to FIX. If no, discard the hypothesis and form a new one.

Never carry forward a failed hypothesis. Each iteration starts clean.

## Escalation

If 3+ fix attempts have failed, the issue is likely architectural. Stop guessing. Document what has been tried — hypotheses tested, evidence gathered, fixes attempted — and escalate or step back to redesign.

## Common Pitfalls

| Excuse | Reality |
|--------|---------|
| "I think I know what it is" | Thinking is not evidence. Reproduce first. |
| "Let me just try this fix" | That is guessing. Complete REPRODUCE and HYPOTHESIZE first. |
| "Multiple changes at once saves time" | You cannot isolate what worked. New bugs will appear. |
| "The issue is simple" | Simple bugs have root causes too. The process is fast for simple bugs. |
| "The stack trace is enough" | Stack traces show where it crashed, not why. Trace the data. |

Stop immediately if you catch yourself changing code before reproducing, proposing a fix before reading the full error, trying random fixes, or changing multiple things at once.

See also: `verification` for evidence-based confirmation after fixes.
