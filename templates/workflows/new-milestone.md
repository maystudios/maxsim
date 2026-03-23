<purpose>
Create a new GitHub Milestone with a structured phase breakdown. All state lives in GitHub Issues — no local planning files are created by this workflow.
</purpose>

<process>

## Step 1: Gather milestone details

Prompt user for milestone information:

```
AskUserQuestion([
  {
    header: "Milestone Name",
    question: "What is the name of this milestone?",
    followUp: "e.g. v2.0 Authentication, Q2 Dashboard, Payments MVP"
  },
  {
    header: "Milestone Description",
    question: "Describe the goal of this milestone in 1-2 sentences."
  },
  {
    header: "Due Date",
    question: "Due date? (YYYY-MM-DD or leave blank for none)"
  }
])
```

Store as `$MILESTONE_NAME`, `$MILESTONE_DESCRIPTION`, `$MILESTONE_DUE`.

---

## Step 2: Create GitHub Milestone

Call EnterPlanMode before creating any GitHub resources.

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github create-milestone \
  --title "$MILESTONE_NAME" \
  --description "$MILESTONE_DESCRIPTION" \
  --due-date "$MILESTONE_DUE"
```

Parse response for `$MILESTONE_NUMBER`.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► MILESTONE CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Milestone #$MILESTONE_NUMBER: $MILESTONE_NAME
Description: $MILESTONE_DESCRIPTION
Due: $MILESTONE_DUE (or "No due date")

Now define the phases for this milestone.
```

---

## Step 3: Get phase breakdown from user

Ask user to describe the phases:

```
AskUserQuestion(
  header: "Phase Breakdown",
  question: "List the phases for this milestone. Provide each as: 'Phase Name: one-sentence goal'",
  followUp: "Example:\nFoundation: Set up database schema and API layer\nUI: Build the core user interface\nIntegration: Connect frontend to backend APIs"
)
```

Parse the response into a list of `{ name, goal }` pairs.

Display parsed phases for confirmation:

```
## Planned Phases

| # | Name | Goal |
|---|------|------|
| 1 | Foundation | Set up database schema and API layer |
| 2 | UI | Build the core user interface |
| 3 | Integration | Connect frontend to backend APIs |

Are these phases correct?
```

```
AskUserQuestion(
  header: "Confirm Phases",
  question: "Proceed with these phases?",
  options: [
    { label: "Yes, create them" },
    { label: "No, let me revise" }
  ]
)
```

If "No, let me revise": return to step 3 and re-prompt.

---

## Step 4: Create phase issues linked to milestone

For each phase, run `github create-phase` sequentially:

```bash
# For each phase (1-indexed):
node .claude/maxsim/bin/maxsim-tools.cjs github create-phase \
  --phase-number "[N]" \
  --phase-name "[Phase Name]" \
  --goal "[Phase Goal]" \
  --milestone-number $MILESTONE_NUMBER
```

Track results. If any creation fails, warn and provide the manual creation command.

After all phases are created, add each issue to the project board in the "To Do" column:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github set-status \
  --issue-number [ISSUE_NUM] \
  --status "To Do"
```

---

Call ExitPlanMode after all phase issues are created and added to the board.

## Step 5: Display completion summary

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► MILESTONE READY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Milestone #$MILESTONE_NUMBER: $MILESTONE_NAME

| # | Phase | Issue | Board Status |
|---|-------|-------|--------------|
| 1 | [Name] | #N | To Do |
| 2 | [Name] | #N | To Do |
| 3 | [Name] | #N | To Do |

All [N] phases created and added to the project board.

## Next Steps

Start planning the first phase:

/maxsim:plan 1   — begin discussion and planning for Phase 1
```

</process>

<success_criteria>
- [ ] User provides milestone name, description, and optional due date
- [ ] GitHub Milestone created via maxsim-tools
- [ ] User provides phase breakdown and confirms it
- [ ] Phase issues created and linked to the milestone
- [ ] All phase issues added to project board as "To Do"
- [ ] Summary displayed with issue numbers and next step
</success_criteria>

<constraints>
- Tool name is Agent (NOT Task)
- GitHub Issues is the SOLE source of truth — no local planning files are created
- EnterPlanMode must be used before creating any GitHub resources
- ExitPlanMode must be called after all GitHub resources are created
- Use `node .claude/maxsim/bin/maxsim-tools.cjs` for CLI operations
- Use `github set-status` (not `github move-issue`) to set board column status
</constraints>
