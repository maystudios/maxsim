---
name: maxsim:debug
description: Systematic debugging with reproduce-hypothesize-isolate-verify-fix-confirm cycle
argument-hint: "[issue description]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, LS, TodoRead, TodoWrite]
---

<objective>
Debug issues using a scientific method cycle: Reproduce → Hypothesize → Isolate → Verify → Fix → Confirm. Active debug sessions are tracked as GitHub Issues (label: `debug`).
</objective>

> **Note:** This command is also auto-triggered by `/maxsim:go` when open issues labeled `type:bug` are detected on the GitHub Project Board.

<context>
Arguments: $ARGUMENTS

If $ARGUMENTS is provided, treat it as the issue description and skip straight to symptom confirmation.

GitHub is the sole source of truth. Check for open Issues labeled `debug` to detect active sessions — no .planning/debug/ files.
</context>

<process>
Plan Mode: Use EnterPlanMode when presenting symptom analysis and proposed diagnosis. Call ExitPlanMode before spawning the executor Agent for the fix.
> **Tip:** Press **Ctrl+G** while reviewing the plan to edit it in your text editor before approving.

Follow @.claude/maxsim/workflows/debug.md end-to-end. Invoke the `systematic-debugging` skill at step 3 to drive the reproduce-hypothesize-isolate-verify-fix cycle.

1. Check GitHub for open Issues labeled `debug` (active sessions)
   - If active sessions exist and no $ARGUMENTS: list them, let user pick to resume or start new
2. Gather symptoms via AskUserQuestion: expected behavior, actual behavior, errors, timeline, reproduction steps
3. Create a GitHub Issue labeled `debug` to track the session
4. Spawn a verifier Agent with symptoms and the GitHub Issue URL as context
5. Handle Agent return:
   - Root cause found → display findings, offer Fix / Plan Fix / Manual
   - Checkpoint reached → surface to user, get response, spawn continuation Agent
   - Inconclusive → show what was eliminated, offer Continue / Manual / Add Context
6. On fix: close the GitHub debug Issue with resolution summary
</process>
