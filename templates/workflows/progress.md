<purpose>
Check project progress, milestone status, and offer milestone completion when all phases are done. Reads status from live GitHub queries (always-live, no cached state). Detects phase gaps and intelligently routes to the next action.
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="init_context">
**Load progress context (paths only):**

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init progress)
```

Extract from init JSON: `project_exists`, `roadmap_exists`, `state_exists`, `phases`, `current_phase`, `next_phase`, `milestone_version`, `completed_count`, `phase_count`, `paused_at`, `state_path`, `roadmap_path`, `project_path`, `config_path`.

If `project_exists` is false (no `.planning/` directory):

```
No planning structure found.

Run /maxsim:init to start a new project.
```

Exit.

If missing STATE.md: suggest `/maxsim:init`.

**If ROADMAP.md missing but PROJECT.md exists:**

This means a milestone was completed and archived. Go to **Route F** (between milestones).

If missing both ROADMAP.md and PROJECT.md: suggest `/maxsim:init`.
</step>

<step name="load">
**Load local project context (always from local files per WIRE-02):**

Use targeted tools to get data needed for the report:
- `STATE=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs state-snapshot)`

Read local files for project context:
- `.planning/config.json` — model profile, workflow flags
- `.planning/PROJECT.md` — project name and vision
- `.planning/REQUIREMENTS.md` — requirements context
- `.planning/STATE.md` — decisions, blockers, metrics

This minimizes orchestrator context usage.
</step>

<step name="live_github_phase_overview">
**Get live phase status from GitHub (primary source — always-live, no cached state):**

Run `github all-progress` to get progress for all phases. This returns live data from GitHub Issues:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github all-progress
```

Returns: `phase_number`, `title`, `issue_number`, `total_tasks`, `completed_tasks`, `remaining_tasks`, `status` (the GitHub board column: To Do / In Progress / In Review / Done)

Display as formatted table:

```
## GitHub Issues Progress (Live)

| Phase | Title | Issue | Completed | Total | Remaining | Status |
|-------|-------|-------|-----------|-------|-----------|--------|
| 01    | ...   | #12   | 3         | 5     | 2         | In Progress |
| 02    | ...   | #13   | 0         | 4     | 4         | To Do |
```

**Also get board column view:**

Run `github query-board` with the project number (from init context / config). Group items by status column (To Do, In Progress, In Review, Done). Display column counts and issue details:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github query-board --project-number PROJECT_NUMBER
```

```
## Board Status (Live)

| Column      | Count | Issues |
|-------------|-------|--------|
| To Do       | 2     | #13, #14 |
| In Progress | 1     | #12 |
| In Review   | 0     | — |
| Done        | 3     | #9, #10, #11 |
```

**Cross-reference with local ROADMAP.md (for phase ordering only -- GitHub is authoritative for status):**
- Run `ROADMAP=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap analyze)` to get local phase ordering data
- If local ROADMAP phase list differs from GitHub Issues, note in Issues Detected section (GitHub is the source of truth)
</step>

<step name="live_github_detail">
**Per-phase detail (when user requests or for current phase):**

For the current active phase (or any phase requested by user):
- Run `github phase-progress` with the phase issue number to get task-level progress
- Run `github list-sub-issues` to get individual task status with sub-issue details
- Display task breakdown with status indicators (✓ done / ⏳ in progress / ○ to do)

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github phase-progress --phase-issue-number N
node ~/.claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues N
```

**Detect external edits:**

After reading phase data from GitHub, run `github detect-external-edits` for each phase with the stored `body_hash`. Warn in the Issues Detected section if modifications were detected outside the normal workflow.

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github detect-external-edits --phase-number "XX"
```
</step>

<step name="position">
**Parse current position from init context and live GitHub data:**

- Use `current_phase` and `next_phase` from `$ROADMAP` (local) cross-referenced with GitHub board status
- Note `paused_at` if work was paused (from `$STATE`)
- Check for interrupted phases via `github detect-interrupted`

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github detect-interrupted --phase-issue-number N
```
</step>

<step name="report">
**Generate progress bar from maxsim-tools, then present rich status report:**

```bash
# Get formatted progress bar (local computation)
PROGRESS_BAR=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs progress phase-bars --raw)
```

Present (GitHub Issues is the primary progress source; local ROADMAP is cross-validation):

```
# [Project Name]

**Progress:** {PROGRESS_BAR}
**Profile:** [quality/balanced/budget]

## GitHub Issues Progress (Live)
[formatted table from github all-progress — see live_github_phase_overview step]

## Board Status (Live)
[column view from github query-board — see live_github_phase_overview step]

## Current Position
Phase [N] of [total]: [phase-name]
GitHub Status: [board column from live data]
CONTEXT: [✓ if has_context | - if not]

## Key Decisions Made
- [extract from $STATE.decisions[]]
- [e.g. jq -r '.decisions[].decision' from state-snapshot]

## Blockers/Concerns
- [extract from $STATE.blockers[]]
- [e.g. jq -r '.blockers[].text' from state-snapshot]

## Issues Detected
(Only show if gaps found during analysis)
- Phase [N]: [issue description, e.g., "External edit detected — body_hash mismatch"]
- Phase [M]: [issue description, e.g., "Local: complete, GitHub: In Progress — discrepancy"]

## What's Next
[Next phase/plan objective from live GitHub data and local roadmap]
```

**Performance metrics table truncation:**

When displaying the performance metrics table from STATE.md (the `## Performance Metrics` section):
- Show only the **last 20 entries** (most recent) by default.
- If there are more than 20 metric entries in STATE.md, add a note above the table: `Showing last 20 of {total} metrics entries.`
- This is a **display-time truncation only** — STATE.md retains all metrics as the source of truth. Do not modify or remove older entries from STATE.md.
- If there are 20 or fewer entries, show all without any truncation note.

</step>

<step name="route">
**Determine next action based on live GitHub data.**

**Step 1: Get live phase state from GitHub**

Use `github all-progress` output (already fetched above). Identify:
- Phases with status "In Progress" that have remaining tasks
- Phases with status "To Do" (not yet started)
- Phases with status "Done"

**Step 1.5: Check for interrupted or external edit issues**

Run `github detect-interrupted` to check for any phases that were interrupted mid-execution. If any are found, note them — they take priority over new work.

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github detect-interrupted --phase-issue-number N
```

**Step 2: Route based on live GitHub status**

| Condition | Meaning | Action |
|-----------|---------|--------|
| Interrupted phase detected | Work was cut off | Go to **Route A** (resume) |
| Phase "In Progress" with remaining tasks | Unfinished execution | Go to **Route A** (continue) |
| Phase "To Do" | Phase not yet started | Go to **Route B** |
| All phases "Done" | Milestone complete | Go to **Route D** |

---

**Route A: Phase in progress or interrupted — continue execution**

Identify the in-progress or interrupted phase (from `github all-progress` or `github detect-interrupted`).

```
---

## ▶ Next Up

**Phase {N}: [Phase Name]** — resuming execution

`/maxsim:execute {phase}`

<sub>`/clear` first → fresh context window</sub>

---
```

---

**Route B: Phase needs planning**

Check if a `<!-- maxsim:type=context -->` comment exists on the phase GitHub Issue.

**If context comment exists:**

```
---

## ▶ Next Up

**Phase {N}: {Name}** — {Goal from ROADMAP.md}
<sub>✓ Context gathered, ready to plan</sub>

`/maxsim:plan {phase-number}`

<sub>`/clear` first → fresh context window</sub>

---
```

**If no context comment exists:**

```
---

## ▶ Next Up

**Phase {N}: {Name}** — {Goal from ROADMAP.md}
<sub>No context comment yet — /maxsim:plan will start with discussion</sub>

`/maxsim:plan {phase}`

<sub>`/clear` first → fresh context window</sub>

---
```

---

**Route C: Phase complete, more phases remain**

Read ROADMAP.md to get the next phase's name and goal.

```
---

## ✓ Phase {Z} Complete

## ▶ Next Up

**Phase {Z+1}: {Name}** — {Goal from ROADMAP.md}

`/maxsim:plan {Z+1}` — starts with discussion, then plans

<sub>`/clear` first → fresh context window</sub>

---
```

---

**Route D: Milestone complete**

All phases are "Done" on the GitHub board. Offer milestone completion interactively:

```
---

## Milestone Complete!

All {N} phases are complete (all "Done" on GitHub board). Ready to wrap up?

1. Complete milestone (archive, create release notes) → `/maxsim:init` (detects milestone completion)
2. Start new milestone → `/maxsim:init` (starts new milestone flow)
3. Just show me the progress (stay on this screen)

<sub>`/clear` first → fresh context window</sub>

---
```

If user chooses option 1 or 2: route to `/maxsim:init` which handles milestone lifecycle interactively.
If user chooses option 3: display progress report only, no routing.

---

**Route F: Between milestones (ROADMAP.md missing, PROJECT.md exists)**

A milestone was completed and archived. Ready to start the next milestone cycle.

Read MILESTONES.md to find the last completed milestone version.

```
---

## ✓ Milestone v{X.Y} Complete

Ready to plan the next milestone.

## ▶ Next Up

**Start Next Milestone** — questioning → research → requirements → roadmap

`/maxsim:init`

<sub>`/clear` first → fresh context window</sub>

---
```

</step>

<step name="edge_cases">
**Handle edge cases:**

- Phase complete but next phase not planned → offer `/maxsim:plan [next]`
- All work complete → offer milestone completion via `/maxsim:init`
- Blockers present → highlight before offering to continue
- External edits detected → surface in Issues Detected section before routing
- Discrepancy between local ROADMAP and GitHub board → surface in Issues Detected (GitHub is authoritative)
- GitHub not available (CLI calls fail) → show error: "GitHub integration required for progress tracking. Run `/maxsim:init` to configure GitHub." Do NOT fall back to local file scanning.
  </step>

</process>

<success_criteria>

- [ ] Rich context provided (decisions, blockers, issues)
- [ ] GitHub Issues progress shown as primary source (always-live reads via `github all-progress`)
- [ ] Board column view shown via `github query-board`
- [ ] Per-phase task detail available via `github phase-progress` and `github list-sub-issues`
- [ ] External edit detection via `github detect-external-edits`
- [ ] Cross-reference local ROADMAP.md for phase ordering (GitHub is authoritative for status)
- [ ] Phase gaps and discrepancies detected and surfaced in Issues Detected section
- [ ] Current position clear with visual progress
- [ ] What's next clearly explained
- [ ] Smart routing: /maxsim:execute if in progress, /maxsim:plan if not started
- [ ] Milestone completion offered when all phases done
- [ ] User confirms before any action
- [ ] Seamless handoff to appropriate maxsim command
      </success_criteria>
</output>
