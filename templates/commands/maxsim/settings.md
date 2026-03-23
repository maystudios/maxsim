---
name: maxsim:settings
description: View and modify MaxsimCLI configuration
allowed-tools: [Read, Write, Edit, Bash, AskUserQuestion, EnterPlanMode, ExitPlanMode]
---

<objective>
Interactively view and modify MaxsimCLI configuration: model profile, pipeline toggles (research, plan-checker, verifier, auto-advance), and branching strategy.
</objective>

<context>
Configuration is stored in `.claude/maxsim/config.json` (project-level). Present current values as pre-selections in each prompt.
</context>

<process>
Follow @.claude/maxsim/workflows/settings.md end-to-end.

1. Read current config from CLAUDE.md and `.claude/maxsim/config.json`
2. Display current settings with descriptions
3. Use AskUserQuestion to interactively configure:
   - Model profile (with per-tier model assignment details)
   - Research stage enabled/disabled
   - Plan-checker enabled/disabled
   - Verifier enabled/disabled
   - Auto-advance between stages
   - Branching strategy (per-phase / per-task / none)
4. Merge answers and write updated config
5. Display confirmation of saved settings
</process>
