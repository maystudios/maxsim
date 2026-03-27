---
name: maxsim:debug-loop
description: Autonomous bug hunting — scientific method with hypothesis testing
argument-hint: "[symptom]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, LS, TodoRead, TodoWrite]
---

<objective>
Autonomously hunt down bugs using the scientific method: reproduce the symptom, form hypotheses, test each hypothesis, fix confirmed root causes, and verify the fix. Loop until the bug is resolved or all hypotheses are exhausted.
</objective>

<context>
Arguments: $ARGUMENTS

If $ARGUMENTS is provided, treat it as the symptom description.

GitHub is the sole source of truth. Debug sessions are tracked as GitHub Issues (label: `debug`). Results are tracked in `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`.

This command uses Plan Mode to gather symptom details before autonomous investigation begins.
</context>

<process>
Follow @.claude/maxsim/workflows/debug-loop.md end-to-end.

1. **Plan Mode:** Call `EnterPlanMode` before any execution
2. Gather symptom details via AskUserQuestion (symptom, expected behavior, reproduction steps, reproduction command, scope)
3. Attempt initial reproduction — run the reproduction command to confirm the bug exists
4. Create a GitHub Issue labeled `debug` to track the session
5. Show investigation plan and confirm with user
6. Exit Plan Mode via `ExitPlanMode` — user reviews and approves the plan
> **Tip:** Press **Ctrl+G** while reviewing the plan to edit it in your text editor before approving.
7. Run the 7-phase debug loop: Reproduce → Hypothesize → Test → Evaluate → Fix → Verify → Log
   - Each hypothesis stated explicitly: "I think X because Y"
   - Previously disproven hypotheses never reused
   - Failed fixes always reverted
8. Hypothesis exhaustion after 5+ rejected: fresh read, environmental check, git bisect, escalate
9. On termination: close GitHub Issue with resolution summary
</process>
