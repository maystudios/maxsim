<purpose>
Show project status from GitHub Issues (sole source of truth) and recommend the next action based on live board state.
</purpose>

<process>

## Step 1: Query GitHub Project Board

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github status
```

Parse JSON response for:
- `project_name` — project title
- `phases[]` — array of `{ number, title, issue_number, status, tasks_total, tasks_done }`
- `milestone` — `{ title, due_date, open_issues, closed_issues }`
- `blockers[]` — open issues with label "type:blocker" or "type:bug"

If the command fails (GitHub unreachable), display:

```
GitHub is unavailable. Cannot show progress.
Run: gh auth status   — to check authentication
```

Stop. Do not fall back to local files.

---

## Step 2: Get milestone progress

Calculate from phases:

```
total_phases   = phases.length
done_phases    = phases where status == "Done"
overall_pct    = (done_phases / total_phases) * 100

milestone_open   = milestone.open_issues
milestone_closed = milestone.closed_issues
milestone_pct    = (milestone_closed / (milestone_open + milestone_closed)) * 100
```

---

## Step 3: Display summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► $project_name
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall: [$overall_pct%] $done_phases of $total_phases phases complete

## Phases

| # | Title | Issue | Status | Tasks |
|---|-------|-------|--------|-------|
| 01 | [name] | #12 | Done | 5/5 |
| 02 | [name] | #13 | In Progress | 3/5 |
| 03 | [name] | #14 | To Do | 0/4 |

## Milestone: $milestone.title

Completion: $milestone_pct% ($milestone_closed closed / $milestone_open open)
Due: $milestone.due_date (or "No due date")

## Blockers

[List each item from blockers[] as: - #N: title]
(If empty: "None")
```

Board column breakdown (from `github status` output):

```
| Column      | Count |
|-------------|-------|
| To Do       | N     |
| In Progress | N     |
| In Review   | N     |
| Done        | N     |
```

---

## Step 4: Gap Detection

Identify planning and execution gaps from the phase data:

**Phases planned but not executed** — phases with status "To Do" that have a plan comment on their GitHub Issue but no executor agent has run yet (no SUMMARY comment exists):

```
## Gaps Detected

Planned but not executed:
- Phase [N] — [Title] (Issue #NNN): plan exists, execution not started
```

**Phases executed but not verified** — phases with status "In Progress" or "In Review" where all tasks are done but no verification PASS comment is present:

```
Executed but not verified:
- Phase [N] — [Title] (Issue #NNN): tasks complete, verification pending
```

**Overdue milestones** — query milestones with due dates and compare against today's date:

```bash
gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.due_on != null) | {title, due_on, open_issues}'
```

For each milestone returned, compare `due_on` (ISO 8601 date string) against today's date. If `due_on` is in the past and `open_issues > 0`, it is overdue. Display:

```
Overdue milestones:
- [milestone title]: due [due_on date], [open_issues] open issue(s) remaining
```

**Overdue or blocked tasks** — phases whose milestone due date has passed, or phases with open issues labeled "type:blocker":

```
Overdue / blocked:
- Phase [N] — [Title]: milestone due [date], currently [status]
- Phase [N] — [Title]: blocked by #NNN ([blocker title])
```

If no gaps are found, omit the section entirely and do not print a "no gaps" message.

---

## Step 5: Recommend next action

Evaluate phase statuses in order:

**If any phase is "In Progress":**
```
## Next Action

Phase [N] — [Title] is in progress.

/maxsim:execute [N]   — continue execution
/maxsim:plan [N]      — review or revise plans
```

**If all phases are "To Do" (nothing started):**
```
## Next Action

No phases started yet.

/maxsim:plan 1   — begin planning the first phase
```

**If first unstarted phase exists (some phases Done, next is To Do):**
```
## Next Action

Phase [N] — [Title] is next.

/maxsim:plan [N]   — plan this phase
```

**If all phases are "Done":**
```
## Next Action

All phases complete! Ready to wrap up the milestone.

/maxsim:init   — close milestone and start the next
```

**If blockers exist:** Prepend to next-action section:
```
## Blockers to Resolve First

- #N: [title] — resolve before continuing
```

**If overdue milestones exist:** Prepend to next-action section:
```
## Overdue Milestones

- [milestone title]: due [due_on date], [open_issues] open issue(s) remaining — close or reschedule before continuing
```

</process>

<success_criteria>
- [ ] GitHub project board queried via maxsim-tools (not local files)
- [ ] Overall progress percentage shown
- [ ] Phases displayed by status (To Do / In Progress / In Review / Done)
- [ ] Current milestone and its completion % shown
- [ ] Open blockers/bugs listed
- [ ] Next action recommended based on live board state
- [ ] Graceful error if GitHub is unavailable
</success_criteria>
