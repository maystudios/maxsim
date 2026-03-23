---
id: verify-work
title: Verify Work
group: Workflow
---

Verification is built into `/maxsim:execute` and runs automatically after execution completes. The verifier reads the GitHub phase Issue and all task sub-Issues, then checks each deliverable against the original success criteria.

You do not need to run verification manually in most cases. When you use `/maxsim:execute` or `/maxsim:go`, verification happens as part of the workflow.

### Verification checks

Every verification run performs six checks:

{% doctable headers=["Check", "Pass Condition"] rows=[["Tests pass", "All test suites exit 0"], ["Build succeeds", "Production build completes without errors"], ["Lint clean", "No lint errors (warnings allowed)"], ["Spec compliance", "All deliverables listed in the phase Issue are accounted for"], ["Code review", "Parallel reviewer agents find no blocking issues"], ["Evidence block", "Verifier writes a structured CLAIM/EVIDENCE/OUTPUT/VERDICT block as a GitHub Issue comment"]] %}
{% /doctable %}

The evidence block format records what was claimed, what evidence was gathered, what output was observed, and the final verdict. This block becomes part of the permanent phase record on the GitHub Issue.

### Retry logic and Guard pattern

If verification fails, the executor retries the failing tasks up to 3 attempts before creating gap sub-phases. The Guard pattern runs a final check after each retry: if the same check fails twice in a row, the executor stops retrying and creates a gap phase Issue instead of looping indefinitely.

For every broken item found beyond the retry limit, verification creates a decimal fix phase Issue. If phase 1 has two broken items, you get phase Issues 1.1 and 1.2, each with focused task sub-Issues. Run `/maxsim:execute` to close the gaps, then verification confirms the fix.

### Manual verification

If you need to re-verify a phase independently, the verify workflow is available as a standalone option. This is useful when you want to re-check after manual changes or after closing gaps outside the normal execution flow.

{% callout type="tip" %}
Auto-verify catches integration issues that individual executor tests miss, especially cross-phase contract violations and edge cases in user flows that were not explicitly specified.
{% /callout %}
