<purpose>
Simplified flow for small tasks that don't need full phase planning. Creates a GitHub Issue, executes the task directly, runs verification, commits, and closes the issue.
</purpose>

<process>

## Step 1: Get task description

Parse `$ARGUMENTS` for task description text.

If empty, prompt:

```
AskUserQuestion(
  header: "Quick Task",
  question: "What do you want to do?",
  followUp: null
)
```

Store as `$DESCRIPTION`. If still empty, re-prompt: "Please provide a task description."

---

## Step 2: Create GitHub Issue

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github create-issue \
  --title "$DESCRIPTION" \
  --label "type:quick" \
  --body "Quick task: $DESCRIPTION"
```

Parse JSON response for `issue_number`. Store as `$ISSUE_NUM`.

Move issue to "In Progress" on the project board:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $ISSUE_NUM \
  --status "In Progress"
```

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► QUICK TASK #$ISSUE_NUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task: $DESCRIPTION
Issue: #$ISSUE_NUM (In Progress)
```

---

## Step 3: Execute the task

Spawn an executor agent to implement the task directly — no wave scheduling, no plan files:

```
Agent(
  prompt="
Execute this task: $DESCRIPTION

GitHub Issue: #$ISSUE_NUM

<constraints>
- Implement the task fully
- Commit changes atomically with message: feat(quick-#$ISSUE_NUM): $DESCRIPTION
- Do NOT create phase planning files (quick tasks skip phase ceremony)
- Return a short summary of what was done and the commit hash
</constraints>
",
  subagent_type="executor",
  description="Execute quick task #$ISSUE_NUM: $DESCRIPTION"
)
```

Extract `$COMMIT_HASH` and `$SUMMARY` from executor output.

---

## Step 4: Verify

Run a focused verification of the completed work:

```
Agent(
  prompt="
Verify this quick task was completed correctly:

Task: $DESCRIPTION
GitHub Issue: #$ISSUE_NUM
Commit: $COMMIT_HASH

Check:
1. Does the implementation match the task description?
2. Are there any obvious issues or regressions?

Return: PASS or FAIL with brief reasoning.
",
  subagent_type="verifier",
  description="Verify quick task #$ISSUE_NUM"
)
```

Store `$VERIFY_STATUS` (PASS or FAIL).

If FAIL: display issues, ask user whether to fix or accept as-is.

---

## Step 5: Commit artifacts, close issue, move to Done

Post completion comment to the issue:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github comment-issue \
  --issue-number $ISSUE_NUM \
  --body "Completed. Commit: $COMMIT_HASH\n\nSummary: $SUMMARY\n\nVerification: $VERIFY_STATUS"
```

Close the issue and move to Done:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github close-issue --issue-number $ISSUE_NUM
node .claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $ISSUE_NUM \
  --status "Done"
```

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► QUICK TASK COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task: $DESCRIPTION
Issue: #$ISSUE_NUM (Done)
Commit: $COMMIT_HASH
Verification: $VERIFY_STATUS

Ready for next task: /maxsim:quick
```

</process>

<success_criteria>
- [ ] GitHub Issue created with label "type:quick"
- [ ] Issue moved to "In Progress" on project board
- [ ] Task executed directly (no plan files)
- [ ] Verification run and result recorded
- [ ] Completion comment posted to issue
- [ ] Issue closed and moved to "Done"
</success_criteria>
