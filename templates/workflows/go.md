<purpose>
Auto-detect project state through live GitHub queries, surface problems proactively, and dispatch to the appropriate MAXSIM command. Uses the Show + Act pattern: display detection reasoning first, then act immediately.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="immediate_feedback">
**Show immediate feedback while gathering context:**

```
Analyzing project state...
```

This ensures the user sees something immediately while context gathering runs.
</step>

<step name="deep_context_gathering">
**Phase 1: Deep Context Gathering**

Gather all project signals in parallel for speed. Run these checks simultaneously:

**1. Project existence check:**
```bash
PLANNING_EXISTS=$(test -d .planning && echo "true" || echo "false")
```

If `.planning/` does not exist, skip all other checks and go directly to the decision tree (Rule 1: No project found).

**2. Load local project context (always from local files per WIRE-02):**
```bash
# State snapshot (local)
STATE=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs state-snapshot 2>/dev/null || echo "{}")
```

Read local files for project context:
- `.planning/STATE.md` — blockers, decisions, session continuity
- `.planning/ROADMAP.md` — phase structure and phase ordering

**3. Live GitHub state (primary source — always-live, no cached state):**

Run `github status` to get current state of all phases and detect interrupted work in one call:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github status
```

Returns: `phase_number`, `title`, `issue_number`, `total_tasks`, `completed_tasks`, `remaining_tasks`, `status` (GitHub board column: To Do / In Progress / In Review / Done), and any interrupted phase detection.

**4. Git context:**
```bash
# Uncommitted changes
GIT_STATUS=$(git status --porcelain 2>/dev/null | head -20)

# Recent commits
RECENT_COMMITS=$(git log --oneline -5 2>/dev/null)
```
</step>

<step name="problem_detection">
**Phase 2: Problem Detection**

Check for problems BEFORE suggesting any action. All problems are blocking — no severity tiers.

**Check each of these in order:**

**1. Uncommitted changes in .planning/**
```bash
git status --porcelain .planning/ 2>/dev/null | head -10
```
If uncommitted changes exist in `.planning/`:
```
## Problem Detected

**Issue:** Uncommitted changes in .planning/ directory
**Impact:** State drift — local planning files may diverge from team or lose work
**Resolution:** Commit planning changes to preserve state

**Files with changes:**
{list of changed files}

Resolve this before continuing. Options:
1. Commit now (recommended)
2. Investigate changes first
3. Skip and continue anyway
```

Block until user responds.

**2. Blockers in STATE.md**
Extract blockers from state snapshot. If any exist:
```
## Problem Detected

**Issue:** Active blocker recorded in project state
**Blocker:** {blocker text}
**Impact:** Execution cannot proceed safely until this is resolved
**Resolution:** Address the blocker or remove it if no longer relevant

Resolve this before continuing. Options:
1. Investigate and resolve
2. Remove blocker (if no longer relevant)
3. Skip and continue anyway
```

Block until user responds.

**3. Failed verification on GitHub**
Check if any phase issue has a verification comment with FAIL status (from live GitHub data via `github all-progress` — look for phases stuck in "In Review" with a known failure, or check recent comments via `github get-issue` for the current phase issue):

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue --issue-number N --include-comments
```
```
## Problem Detected

**Issue:** Phase verification failed
**Phase:** {phase number and name} (GitHub Issue #{issue_number})
**Impact:** Phase is not verified as complete — may have gaps
**Resolution:** Re-run verification or fix identified issues

Resolve this before continuing. Options:
1. View verification results (check GitHub issue comments)
2. Re-execute to fix issues
3. Skip and continue anyway
```

Block until user responds.

**If any problem is found:** Surface it and wait for user resolution. Do NOT proceed to the decision tree until all problems are cleared or explicitly skipped.

**If no problems found:** Proceed to the decision tree.
</step>

<step name="decision_tree">
**Phase 3: Decision Tree**

Apply rules in strict precedence order. The FIRST matching rule determines the action.

Use live GitHub data from `github status` (gathered in Phase 1) as the primary source of truth for phase state. Use local ROADMAP.md for phase ordering only.

```
Rule 1: No .planning/ directory?
  -> Action: /maxsim:init
  -> Reasoning: "No MAXSIM project found in this directory."

Rule 2: Has blockers in STATE.md? (not cleared in problem detection)
  -> Action: Surface blocker, suggest resolution
  -> Reasoning: "BLOCKED: {blocker text}"

Rule 3: Interrupted phase detected (from `github status`)?
  -> Action: /maxsim:execute {N}
  -> Reasoning: "Phase {N} ({name}) was interrupted. Resuming execution."

Rule 4: Phase "In Progress" on GitHub board with incomplete tasks?
  -> Check: `github status` returns a phase with status="In Progress" and remaining_tasks > 0
  -> Action: /maxsim:execute {N}
  -> Reasoning: "Phase {N} ({name}) has {remaining} tasks remaining. Ready to continue."

Rule 5: Phase "To Do" on GitHub board (not yet started)?
  -> Check: `github status` returns the next unstarted phase (status="To Do")
  -> Action: /maxsim:plan {N}
  -> Reasoning: "Phase {N} ({name}) needs planning."

  Sub-check: Does a context comment exist on the phase GitHub Issue?
  -> If yes: "Discussion complete, ready for research + planning."
  -> If no: "Starting from discussion stage."

Rule 6: Current phase "In Review" on GitHub board?
  -> Check: `github status` returns a phase with status="In Review"
  -> Action: /maxsim:execute {N}
  -> Reasoning: "Phase {N} ({name}) is awaiting verification."

Rule 7: All phases "Done" on GitHub board?
  -> Check: `github status` — all phases have status="Done"
  -> Action: /maxsim:progress
  -> Reasoning: "All phases complete. Milestone ready for review."

Rule 8: None of the above?
  -> Action: Show interactive menu
  -> Reasoning: "Project state is ambiguous. Here are your options."
```
</step>

<step name="show_and_act">
**Phase 4: Show + Act**

Once a rule matches, display detection reasoning FIRST, then act immediately.

**Format for auto-dispatch (Rules 1-7):**

```
## Detected: {summary of what was found}

**Project:** {project name from PROJECT.md, or "New project"}
**Milestone:** {milestone from ROADMAP.md, or "Not started"}
**Current phase:** {phase N - name, or "None"} (GitHub Issue #{issue_number})
**GitHub Status:** {board column from live `github status` data}
**Tasks:** {completed}/{total} complete

**Action:** Running /maxsim:{command} {args}...
```

Then immediately dispatch the command using the SlashCommand tool. The user can Ctrl+C if the detection is wrong.

**Important:** Show the detection block, then dispatch. Do not ask for confirmation — this is Show + Act, not Show + Ask.
</step>

<step name="interactive_menu">
**Phase 5: Interactive Menu (Rule 8 — no obvious action)**

When no clear action is detected, show a contextual menu. The menu items are NOT static — filter based on what makes sense for the current project state (use live GitHub data from `github status`).

```
## Project Status

**Project:** {project name}
**Milestone:** {milestone}
**GitHub Progress:** {X}/{Y} phases Done on board

What would you like to do?

1. /maxsim:plan {next_phase} — Plan next phase
2. /maxsim:quick — Quick ad-hoc task
3. /maxsim:progress — View detailed progress
4. /maxsim:debug — Debug an issue

Or describe what you'd like to do:
```

**Contextual filtering rules:**
- If phases are "In Progress" on GitHub: show execute options prominently
- If all phases are "Done" on GitHub: show `/maxsim:progress` (offers milestone completion)
- If recent git activity suggests debugging: show `/maxsim:debug` prominently
- If no phases exist on board: show `/maxsim:plan` prominently
- Always include `/maxsim:quick` as it is always relevant
- Always include an open-ended fallback ("Or describe what you'd like to do")
- If GitHub not available (CLI calls fail): show error: "GitHub integration required. Run `/maxsim:init` to configure GitHub." Do NOT fall back to local file scanning.

Wait for user selection, then dispatch the chosen command.
</step>

</process>

<constraints>
- Never ask for confirmation before dispatching (Show + Act, not Show + Ask)
- Always surface problems BEFORE suggesting actions
- All problems block — no severity tiers, no "warnings"
- No arguments accepted — this is pure auto-detection
- No mention of old commands (plan, execute-phase, etc.)
- Keep initial feedback fast — show "Analyzing..." before heavy operations
- Primary source for phase state: live GitHub (`github status`)
- Local reads: STATE.md for blockers/decisions, ROADMAP.md for phase ordering only
- If context gathering fails (tools not available, etc.), fall back to the interactive menu
</constraints>
</output>
