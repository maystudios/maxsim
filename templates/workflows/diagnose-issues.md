<purpose>
Systematic debugging of a reported issue. Spawns parallel Research agents to investigate, hypothesizes root cause, spawns an executor to implement a fix, verifies the fix, and posts results to GitHub.
</purpose>

<process>

## Step 1: Accept issue description

Parse `$ARGUMENTS` for the issue description.

If empty, prompt:

```
AskUserQuestion(
  header: "Debug Issue",
  question: "Describe the issue to diagnose.",
  followUp: "Include: what's broken, any error messages, how to reproduce it."
)
```

Store as `$ISSUE_DESCRIPTION`.

Create a GitHub Issue to track the debug session:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github create-issue \
  --title "Debug: $ISSUE_DESCRIPTION" \
  --label "type:bug" \
  --body "Debug session started.\n\nSymptoms: $ISSUE_DESCRIPTION"
```

Store response as `$DEBUG_ISSUE_NUM`.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► DIAGNOSING ISSUE #$DEBUG_ISSUE_NUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Symptoms: $ISSUE_DESCRIPTION

Spawning 3 research agents in parallel...
```

---

## Step 2: Spawn parallel Research agents

Launch all three agents simultaneously in a single message:

**Agent A — Error logs and stack traces:**

```
Agent(
  prompt="
## Task: Investigate error logs and stack traces

## Suggested Skills: systematic-debugging

Issue: $ISSUE_DESCRIPTION

Search for:
- Recent error messages in logs, console output, or test output
- Stack traces related to the reported symptoms
- Any exception types or error codes

Report: What errors exist and where they originate.
",
  subagent_type="researcher",
  description="Investigate error logs for: $ISSUE_DESCRIPTION"
)
```

**Agent B — Recent changes:**

```
Agent(
  prompt="
## Task: Investigate recent code changes

## Suggested Skills: systematic-debugging

Issue: $ISSUE_DESCRIPTION

Examine:
- git log --oneline -20 (last 20 commits)
- git diff HEAD~5 for files related to the symptom area
- Any recent dependency changes (package.json, lock files)

Report: What changed recently that could cause these symptoms?
",
  subagent_type="researcher",
  description="Investigate recent changes for: $ISSUE_DESCRIPTION"
)
```

**Agent C — Related code paths:**

```
Agent(
  prompt="
## Task: Investigate related code paths

## Suggested Skills: systematic-debugging

Issue: $ISSUE_DESCRIPTION

Trace:
- The code path triggered when the issue occurs
- Any data transformations, state mutations, or async flows involved
- Interfaces and contracts between components in that path

Report: Where in the code could this symptom originate?
",
  subagent_type="researcher",
  description="Investigate code paths for: $ISSUE_DESCRIPTION"
)
```

Collect findings from all three agents. Store as `$LOGS_FINDINGS`, `$CHANGES_FINDINGS`, `$CODE_FINDINGS`.

---

## Step 3: Hypothesize root cause

Synthesize findings into a hypothesis:

```
## Investigation Summary

**Symptoms:** $ISSUE_DESCRIPTION

**Logs/Errors:** $LOGS_FINDINGS

**Recent Changes:** $CHANGES_FINDINGS

**Code Path:** $CODE_FINDINGS

**Hypothesis:** [State the most likely root cause based on the three investigations]

**Files likely involved:**
- [file]: [why it's relevant]
```

Display the hypothesis to the user and ask:

```
AskUserQuestion(
  header: "Root Cause Hypothesis",
  question: "Does this hypothesis look correct? Proceed with fix?",
  options: [
    { label: "Yes, implement the fix" },
    { label: "No, my hypothesis is different" },
    { label: "Abort" }
  ]
)
```

If "No, my hypothesis is different": capture user's hypothesis, use it instead.

---

## Step 4: Implement fix

Spawn executor agent to implement the fix:

```
Agent(
  prompt="
Fix this issue: $ISSUE_DESCRIPTION

Root cause hypothesis: $HYPOTHESIS

Files likely involved: $FILES

<constraints>
- Make a minimal, targeted fix
- Do not refactor unrelated code
- Commit with message: fix: $ISSUE_DESCRIPTION (closes #$DEBUG_ISSUE_NUM)
- Return the commit hash and a 2-3 sentence summary of what was changed
</constraints>
",
  subagent_type="executor",
  description="Fix: $ISSUE_DESCRIPTION"
)
```

Extract `$FIX_COMMIT` and `$FIX_SUMMARY`.

---

## Step 5: Verify fix

```
Agent(
  prompt="
Verify this fix resolves the reported issue.

Issue: $ISSUE_DESCRIPTION
Fix commit: $FIX_COMMIT
Fix summary: $FIX_SUMMARY

Check:
1. Does the fix address the stated root cause?
2. Are there any regressions introduced?
3. Does it match the expected behavior described in the issue?

Return: PASS or FAIL with evidence.
",
  subagent_type="verifier",
  description="Verify fix for: $ISSUE_DESCRIPTION"
)
```

Store `$VERIFY_STATUS`.

If FAIL: display verification failures, ask user whether to iterate or accept.

---

## Step 6: Post results to GitHub

Post a comment with full diagnosis and fix details:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github comment-issue \
  --issue-number $DEBUG_ISSUE_NUM \
  --body "## Diagnosis Complete

**Root Cause:** $HYPOTHESIS

**Fix:** $FIX_SUMMARY
**Commit:** $FIX_COMMIT
**Verification:** $VERIFY_STATUS

### Investigation Findings
- Logs: $LOGS_FINDINGS
- Recent Changes: $CHANGES_FINDINGS
- Code Path: $CODE_FINDINGS"
```

Close the issue if verification passed:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github close-issue --issue-number $DEBUG_ISSUE_NUM
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $DEBUG_ISSUE_NUM \
  --status "Done"
```

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► DIAGNOSIS COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: #$DEBUG_ISSUE_NUM
Root Cause: $HYPOTHESIS
Fix Commit: $FIX_COMMIT
Verification: $VERIFY_STATUS
```

</process>

<failure_handling>

**If research agent returns inconclusive:**
- Mark that research dimension as "inconclusive"
- Continue with other agents' findings
- Note the gap in the hypothesis

**If fix verification fails twice:**
- Report remaining failures
- Ask user: 1) Try a different fix approach, 2) Accept current state, 3) Escalate to manual review

**If all agents fail:**
- Post collected partial findings to the GitHub Issue
- Leave issue open with label "needs-manual-review"

</failure_handling>

<success_criteria>
- [ ] GitHub Issue created for the debug session
- [ ] Three research agents spawned in parallel (logs, changes, code paths)
- [ ] Root cause hypothesis synthesized from all findings
- [ ] User confirms hypothesis before fix is implemented
- [ ] Executor agent implements targeted fix
- [ ] Verifier agent confirms fix resolves the issue
- [ ] Full results posted to GitHub Issue
- [ ] Issue closed and moved to Done on verification pass
</success_criteria>
