---
name: maxsim:improve
description: Autonomous optimization loop — modify→verify→keep/discard cycle against any metric
argument-hint: "[metric-command]"
allowed-tools: [Read, Write, Edit, Bash, Grep, Glob, Agent, AskUserQuestion, EnterPlanMode, ExitPlanMode, LS, TodoRead, TodoWrite]
---

<objective>
Run the autoresearch 8-phase optimization loop: make ONE atomic change per iteration, verify against a user-defined metric, guard against regressions, keep or discard via git revert. Loop until the target is met or the iteration budget is exhausted.
</objective>

<context>
Arguments: $ARGUMENTS

If $ARGUMENTS is provided, treat it as the metric command (e.g., `npm run benchmark`, `wc -l src/**/*.ts`, `npm test -- --coverage`).

GitHub is the sole source of truth. Results are tracked in `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv` (7-column TSV). Git history is the memory — every iteration produces a commit or a revert.

This command uses Plan Mode to configure the loop parameters before execution begins.
</context>

<process>
Follow @.claude/maxsim/workflows/improve.md end-to-end.

1. **Plan Mode:** Call `EnterPlanMode` before any execution
2. Gather loop parameters via two AskUserQuestion batches (metric command, guard command, direction, budget, scope, protected files, starting approach)
3. Dry-run: execute metric command and guard command to establish baseline
4. Show proposed loop configuration and confirm with user
5. Exit Plan Mode via `ExitPlanMode` — user reviews and approves the configuration
> **Tip:** Press **Ctrl+G** while reviewing the plan to edit it in your text editor before approving.
6. Run the 8-phase loop: Review → Ideate → Modify → Commit → Verify → Guard → Decide → Log
   - Keep if metric improved AND guard passed; otherwise `git revert HEAD --no-edit`
   - Never modify guard/test files; never use `--no-verify`; one atomic change per iteration
7. Stuck detection after 5 consecutive discards — context reload, combination strategy, escalation
8. On termination: display summary with iterations, best metric, approaches that worked vs. failed
</process>
