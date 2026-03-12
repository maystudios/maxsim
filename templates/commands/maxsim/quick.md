---
name: maxsim:quick
description: Execute a quick task with MAXSIM guarantees, or capture todos for later work
argument-hint: "[--full] [--todo]"
allowed-tools:
  - Read
  - Write
  - Edit
  - Glob
  - Grep
  - Bash
  - Task
  - AskUserQuestion
---
<objective>
Execute small, ad-hoc tasks with MAXSIM guarantees (atomic commits, STATE.md tracking). Also supports "save for later" -- capturing ideas as GitHub Issues with 'todo' label for future work.

Quick mode is the same system with a shorter path:
- Spawns planner (quick mode) + executor(s)
- Quick tasks are tracked via GitHub Issues (label: "quick"), separate from planned phases
- Updates STATE.md "Quick Tasks Completed" table (NOT ROADMAP.md)

**Default:** Skips research, plan-checker, verifier. Use when you know exactly what to do.

**`--full` flag:** Enables plan-checking (max 2 iterations) and post-execution verification. Use when you want quality guarantees without full milestone ceremony.

**`--todo` flag:** Enters todo management mode. List, capture, complete, and triage todos without executing tasks. "Save for later" creates a GitHub Issue with 'todo' label (primary) with local file cache.
</objective>

<execution_context>
@~/.claude/maxsim/workflows/quick.md
</execution_context>

<context>
$ARGUMENTS

Context files are resolved inside the workflow (`init quick`) and delegated via `<files_to_read>` blocks.
</context>

<process>
Execute the quick workflow from @~/.claude/maxsim/workflows/quick.md end-to-end.
Preserve all workflow gates (validation, task description, planning, execution, state updates, commits).
</process>
