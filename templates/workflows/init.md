<purpose>

Unified initialization router. Detects the current project state and delegates to the appropriate sub-workflow:
- **New project** (no .planning/) -> delegates to @~/.claude/maxsim/workflows/new-project.md
- **Existing project** (.planning/ exists, no ROADMAP.md) -> delegates to @~/.claude/maxsim/workflows/init-existing.md
- **Active milestone** (.planning/ + ROADMAP.md, phases in progress) -> shows status, offers options
- **Milestone complete** (all phases done) -> offers completion or new milestone via @~/.claude/maxsim/workflows/new-milestone.md

This file is a THIN ROUTER. All heavy logic lives in the sub-workflows.

</purpose>

<required_reading>

Read all files referenced by the invoking prompt's execution_context before starting.

</required_reading>

<process>

## 1. Parse Flags

Check if `--auto` was passed in $ARGUMENTS. If present, set `AUTO_MODE=true` and pass through to sub-workflows.

## 2. Detect Scenario

Run filesystem checks to determine which flow applies:

```bash
# Check project state
PLANNING_EXISTS=$(test -d .planning && echo "true" || echo "false")

if [ "$PLANNING_EXISTS" = "true" ]; then
  ROADMAP_EXISTS=$(test -f .planning/ROADMAP.md && echo "true" || echo "false")
  STATE_EXISTS=$(test -f .planning/STATE.md && echo "true" || echo "false")
else
  ROADMAP_EXISTS="false"
  STATE_EXISTS="false"
fi

echo "PLANNING=$PLANNING_EXISTS ROADMAP=$ROADMAP_EXISTS STATE=$STATE_EXISTS"
```

Use the results to route:

| PLANNING | ROADMAP | Route |
|----------|---------|-------|
| false | - | Scenario A: New Project |
| true | false | Scenario B: Existing Project |
| true | true | Scenario C or D: check phase completion |

For Scenario C vs D, check phase progress:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs roadmap analyze 2>/dev/null || echo "NO_ANALYSIS"
```

If all phases show status "complete" -> Scenario D (Milestone Complete).
Otherwise -> Scenario C (Active Milestone).

## 3. Route to Scenario

### Scenario A: New Project

No `.planning/` directory found. This is a fresh project initialization.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► INITIALIZING NEW PROJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**CRITICAL — Run init context BEFORE delegating:**

```bash
INIT_CONTEXT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init new-project)
echo "$INIT_CONTEXT"
```

Save this JSON output — the sub-workflow will use it as `INIT_CONTEXT` and skip its own init call.

Now delegate to @~/.claude/maxsim/workflows/new-project.md — execute the full new-project workflow end-to-end. The `INIT_CONTEXT` JSON is already loaded; the sub-workflow will detect this and skip Step 1's CLI call.

Pass through:
- `--auto` flag if set
- All $ARGUMENTS for idea document references

After the new-project workflow completes, display:

```
Project initialized. Run /maxsim:plan 1 to start phase planning.
```

### Scenario B: Existing Project

`.planning/` exists but no `ROADMAP.md`. This is an existing codebase that needs MAXSIM initialization.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► INITIALIZING EXISTING PROJECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**CRITICAL — Run init context BEFORE delegating:**

```bash
INIT_CONTEXT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init init-existing)
echo "$INIT_CONTEXT"
```

Save this JSON output — the sub-workflow will use it as `INIT_CONTEXT` and skip its own init call.

Now delegate to @~/.claude/maxsim/workflows/init-existing.md — execute the full init-existing workflow end-to-end. The `INIT_CONTEXT` JSON is already loaded; the sub-workflow will detect this and skip Step 1's CLI call.

Pass through:
- `--auto` flag if set

After the init-existing workflow completes, display:

```
Project initialized. Run /maxsim:plan 1 to start phase planning.
```

### Scenario C: Active Milestone

`.planning/` and `ROADMAP.md` exist with phases still in progress. The project is actively being worked on.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► PROJECT STATUS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Load current state:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs state load 2>/dev/null
```

Read `.planning/ROADMAP.md` and `.planning/STATE.md` to display:
- Current milestone name and version
- Phase progress (completed/total)
- Current phase and plan being executed
- Recent activity from session continuity

Then present options conversationally (natural language, not AskUserQuestion):

**Options:**

1. **Continue working** -- Based on the current state, suggest the next logical action:
   - If a plan is in progress: "Continue executing Plan {N} with `/maxsim:execute {phase}`"
   - If a phase needs planning: "Plan the next phase with `/maxsim:plan {phase}`"
   - If verification is pending: "Verify the current phase"

2. **Start a new milestone** -- If the user wants to pivot or start fresh:
   - Delegate to @~/.claude/maxsim/workflows/new-milestone.md for the milestone creation flow

3. **View detailed progress** -- Direct to `/maxsim:progress` for full status

4. **Exit** -- No action needed

Wait for the user's choice and route accordingly.

### Scenario D: Milestone Complete

`.planning/` and `ROADMAP.md` exist with all phases marked complete. The current milestone is finished.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► MILESTONE COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Load state and display completion summary:
- Milestone name and version
- Total phases completed
- Key metrics (plans executed, decisions made)

Then present options conversationally:

**Options:**

1. **Complete and archive this milestone** -- Run the milestone completion flow:
   - Delegate to @~/.claude/maxsim/workflows/new-milestone.md with completion mode
   - Archives current milestone data
   - Updates MILESTONES.md with summary

2. **Start a new milestone** -- Begin the next cycle:
   - Delegate to @~/.claude/maxsim/workflows/new-milestone.md for creation flow
   - Gathers new milestone goals
   - Creates fresh REQUIREMENTS.md and ROADMAP.md

3. **View final progress** -- Direct to `/maxsim:progress` for the full report

Wait for the user's choice and route accordingly.

## 4. Context Management

For long-running flows (Scenarios A and B especially), the sub-workflows handle their own context management including checkpoint-before-clear patterns. The router does not need to manage context beyond the initial detection and delegation.

If context is filling up during Scenario C or D interactive options:
- Recommend the user run `/clear` and then the specific command for their chosen action
- Example: "Context is getting large. Run `/clear`, then `/maxsim:plan 3` to continue planning phase 3."

</process>

<constraints>

- This workflow is a ROUTER only. All project initialization logic lives in the sub-workflows.
- Do NOT inline or duplicate logic from new-project.md, init-existing.md, or new-milestone.md.
- Do NOT reference removed command names in user-facing output. The old per-scenario commands no longer exist as user-facing commands.
- The sub-workflows may still reference removed command names internally -- that is expected and will be cleaned up in a later plan.
- For Scenarios C and D, use natural conversational flow for options. Do not use AskUserQuestion for the menu -- just present options and let the user respond naturally.

</constraints>
