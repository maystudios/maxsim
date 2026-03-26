---
name: maxsim:settings
description: View and modify MaxsimCLI configuration
argument-hint: ""
allowed-tools: [Read, Write, Edit, Bash, AskUserQuestion, EnterPlanMode, ExitPlanMode, LS, TodoRead, TodoWrite]
---

<objective>
Interactively view and modify MaxsimCLI configuration: model profile, pipeline toggles (research, plan-checker, verifier, auto-advance), parallelism limits, competition strategy, and branching strategy.
</objective>

<context>
Configuration is stored in `.claude/maxsim/config.json` (project-level). Present current values as pre-selections in each prompt.

Hook registrations live in `.claude/settings.json`. If hooks are missing or corrupted, users can reset them:
- **Re-run `npx maxsimcli`** — the installer re-registers all hooks (idempotent).
- **Manual recovery** — a reference template is available at `.claude/maxsim/templates/settings-reference.json` documenting the expected hook entries. Copy the relevant sections into `.claude/settings.json`.
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

## Hook Recovery

If the user reports missing hooks or broken session-start behavior:
1. Run `npx maxsimcli` to re-install (this re-registers all hooks idempotently)
2. Alternatively, copy entries from `.claude/maxsim/templates/settings-reference.json` into `.claude/settings.json`
3. Verify `.claude/settings.json` contains the expected `hooks`, `statusLine`, `env`, and `permissions` sections
</process>
