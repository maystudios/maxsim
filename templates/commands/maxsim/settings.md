---
name: maxsim:settings
description: Configure MAXSIM workflow toggles and model profile
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
---

<objective>
Interactive configuration of MAXSIM workflow agents, model profile, and pipeline settings via multi-question prompt. Includes integrated profile management with model assignment details per tier.

Routes to the settings workflow which handles:
- Config existence ensuring
- Current settings reading and parsing
- Interactive prompt (model profile, research, plan_checker, verifier, auto-advance, nyquist, branching)
- Profile description showing actual model assignments per profile tier
- Config merging and writing
- Confirmation display
</objective>

<execution_context>
@~/.claude/maxsim/workflows/settings.md
</execution_context>

<process>
**Follow the settings workflow** from `@~/.claude/maxsim/workflows/settings.md`.

The workflow handles all logic including:
1. Config file creation with defaults if missing
2. Current config reading
3. Interactive settings presentation with pre-selection
4. Answer parsing and config merging
5. File writing
6. Confirmation display
</process>
