---
name: maxsim:plan
description: State-machine plan command — Discussion, Research, Planning stages with gate confirmations
argument-hint: "[phase-number] [--force-research] [--skip-verify]"
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - Grep
  - Task
  - WebFetch
  - mcp__context7__*
---
<objective>
Execute the plan state machine: Discussion -> Research -> Planning. Each stage produces artifacts, shows a gate summary, and waits for user confirmation before advancing.

**How it works:**
1. Detect current stage from phase artifacts (CONTEXT.md, RESEARCH.md, PLAN.md)
2. Start at the earliest incomplete stage
3. Run each stage via dedicated sub-workflow
4. Show rich gate summary after each stage — wait for user confirmation
5. Advance to next stage on confirmation

**Re-entry:** If phase is already planned, show status and offer options (view, re-plan, execute).

**Flags:**
- `--force-research` — Re-run research even if RESEARCH.md exists
- `--skip-verify` — Skip plan verification loop after planning stage
</objective>

<execution_context>
@~/.claude/maxsim/workflows/plan.md
@~/.claude/maxsim/references/ui-brand.md
</execution_context>

<context>
Phase number: $ARGUMENTS (optional — auto-detects next unplanned phase if omitted)

**Flags:**
- `--force-research` — Re-run research even if RESEARCH.md exists
- `--skip-verify` — Skip plan verification loop after planning stage

Context files are resolved inside the workflow via `maxsim-tools init plan-phase` and per-subagent context assembly.
</context>

<process>
Execute the plan workflow from @~/.claude/maxsim/workflows/plan.md end-to-end.
Preserve all workflow gates (stage detection, discussion, research, planning, gate confirmations, re-entry flow).
</process>
