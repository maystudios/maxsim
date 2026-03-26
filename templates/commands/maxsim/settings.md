---
name: maxsim:settings
description: View and modify MaxsimCLI configuration
argument-hint: ""
allowed-tools: [Read, Write, Edit, Bash, AskUserQuestion, EnterPlanMode, ExitPlanMode]
---

<objective>
Interactively view and modify MaxsimCLI configuration: model profile, pipeline toggles (research, plan-checker, verifier, auto-advance), parallelism limits, competition strategy, and branching strategy.
</objective>

<context>
Configuration is stored in `.claude/maxsim/config.json` (project-level). Present current values as pre-selections in each prompt.
</context>

<process>
Follow @.claude/maxsim/workflows/settings.md end-to-end.

1. **Plan Mode:** Call `EnterPlanMode` before presenting settings
2. Read current config from CLAUDE.md and `.claude/maxsim/config.json`
3. Display current settings with descriptions
4. Use AskUserQuestion to interactively configure:
   - Model profile (with per-tier model assignment details)
   - Research stage enabled/disabled
   - Plan-checker enabled/disabled
   - Verifier enabled/disabled
   - Auto-advance between stages
   - Parallelism limits (profile-derived: quality 20-40, balanced 10-20, budget 5-10)
   - Competition strategy (none / quick / standard / deep)
   - Branching strategy (per-phase / per-task / none)
   - Per-agent model overrides (override individual agent models beyond profile defaults)
5. Present proposed configuration changes for review
6. Exit Plan Mode via `ExitPlanMode` — user reviews and approves changes
> **Tip:** Press **Ctrl+G** while reviewing the plan to edit it in your text editor before approving.
7. Merge answers and write updated config
8. Display confirmation of saved settings
</process>
