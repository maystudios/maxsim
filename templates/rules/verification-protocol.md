# Verification Protocol

Evidence before claims, always. No exceptions.

## HARD GATE

**No completion claims without fresh verification evidence.**

This gate is non-negotiable. There is no advisory mode, no config override, no escape hatch. Either evidence passes or it fails. No middle ground. Partial success is failure. "Good enough" is not enough.

Do NOT pass this gate by arguing it's "close enough", "minor issue", or "will fix later".

## THIS-Turn Requirement

If you have not run the verification command in THIS turn, you cannot claim it passes.

Evidence must come from tool output executed in the current turn. Prior turn results, cached knowledge, and reasoning are not evidence. Any tool output qualifies: test output, build results, git diff, file reads, linter output.

## Evidence Block Format

Every completion claim requires an evidence block:

```
CLAIM: [what you are claiming]
EVIDENCE: [exact command run in THIS turn]
OUTPUT: [relevant excerpt of actual output]
VERDICT: PASS | FAIL
```

If VERDICT is FAIL: do NOT commit. Fix the issue, re-run verification, produce a new evidence block.

## FORBIDDEN PHRASES

If you catch yourself using any of these, STOP immediately. You are rationalizing instead of verifying:

- "should work"
- "probably passes"
- "I'm confident that..."
- "based on my analysis..."
- "the logic suggests..."
- "it's reasonable to assume..."

These phrases indicate reasoning without evidence. Replace them with a verification command and its actual output.

## What Counts as Evidence

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| "Tests pass" | Test command output showing 0 failures | Previous run, "should pass" |
| "Build succeeds" | Build command with exit code 0 | Linter passing only |
| "Bug is fixed" | Original failing test now passes | "Code changed, assumed fixed" |
| "Task complete" | All done criteria checked with evidence | "I implemented everything" |
| "No regressions" | Full test suite passing | "I only changed one file" |

## Retry Protocol

When verification fails: read the error, fix the issue, re-run the command, produce a new evidence block. Maximum 3 total attempts per gate before escalating. The `verification` skill provides detailed methodology for gate types, retry feedback, and escalation.
