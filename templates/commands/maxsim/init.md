---
name: maxsim:init
description: Initialize a new project or manage milestone lifecycle
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
  - Glob
  - Grep
  - WebFetch
  - mcp__context7__resolve-library-id
  - mcp__context7__get-library-docs
---
<context>
**Flags:**
- `--auto` -- Automatic mode. After config questions, runs the appropriate flow without further interaction. For new projects, expects idea document via @ reference.
</context>

<objective>
Unified project initialization. Detects whether this is a new project, existing project, or milestone lifecycle and routes to the appropriate workflow.

**Creates (depending on scenario):**
- `.planning/PROJECT.md` -- project context
- `.planning/config.json` -- workflow preferences
- `.planning/REQUIREMENTS.md` -- scoped requirements
- `.planning/ROADMAP.md` -- phase structure
- `.planning/STATE.md` -- project memory
- `.planning/DECISIONS.md` -- key decisions with rationale
- `.planning/ACCEPTANCE-CRITERIA.md` -- measurable success criteria
- `.planning/NO-GOS.md` -- explicit exclusions and anti-patterns
- `.planning/codebase/` -- codebase analysis (existing projects only)
- `.planning/research/` -- domain research (optional)

**After this command:** Run `/maxsim:plan 1` to start phase planning.
</objective>

<execution_context>
@~/.claude/maxsim/workflows/init.md
@~/.claude/maxsim/references/questioning.md
@~/.claude/maxsim/references/thinking-partner.md
@~/.claude/maxsim/references/ui-brand.md
@~/.claude/maxsim/templates/project.md
@~/.claude/maxsim/templates/requirements.md
</execution_context>

<process>
Execute the init workflow from @~/.claude/maxsim/workflows/init.md end-to-end.
Pass $ARGUMENTS through to the workflow for flag handling (--auto).
</process>
