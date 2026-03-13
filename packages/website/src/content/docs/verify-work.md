---
id: verify-work
title: Verify Work
group: Workflow
---

Verification is now built into `/maxsim:execute` and runs automatically after execution completes. The verifier reads ROADMAP.md, all SUMMARY.md files for the phase, and systematically checks each deliverable against the original plan's success criteria.

You do not need to run verification manually in most cases. When you use `/maxsim:execute` or `/maxsim:go`, verification happens as part of the workflow.

### Manual verification

If you need to re-verify a phase independently, the verify workflow is still available as a standalone option. This is useful when you want to re-check after manual changes or after closing gaps outside of the normal execution flow.

Verification runs in two passes. First, the integration checker validates that cross-phase connections are intact — APIs that phase 2 depends on were correctly built in phase 1. Second, the verifier runs a UAT-style session where it exercises actual functionality and records pass/fail against specific acceptance criteria.

For every broken item found, verification creates a decimal fix phase. If phase 1 has two broken items, you get phases 1.1 and 1.2 — each with its own focused PLAN.md. Run `/maxsim:execute` to close the gaps, then verification confirms the fix.

{% callout type="tip" %}
Auto-verify catches integration issues that individual executor tests miss — especially cross-phase contract violations and edge cases in user flows that were not explicitly specified.
{% /callout %}
