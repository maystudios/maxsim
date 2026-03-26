<purpose>
Systematic debugging workflow using a reproduce-hypothesize-isolate-verify-fix-confirm cycle. Invokes the `systematic-debugging` skill to drive the diagnostic cycle.

> **GitHub-only:** All state lives on GitHub. No local `.planning/` directory.
</purpose>

<process>

## Step 1: Read Context

Parse `$ARGUMENTS` for an issue description.

If `$ARGUMENTS` is provided, treat it as the symptom description and skip to step 2.

If `$ARGUMENTS` is empty, check GitHub for open Issues labeled `type:bug`:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github list-issues \
  --label "type:bug" \
  --state open
```

- If active sessions exist: list them and ask the user to pick one to resume or start a new session. If the user picks an existing session, load its `$ISSUE_NUM` from the selected issue number and skip to step 3 (the issue already exists; do not create a new one).
- If no active sessions: prompt with `AskUserQuestion`:

```
AskUserQuestion(
  header: "Debug Session",
  question: "Describe the issue: what did you expect, what actually happened, and any error messages or reproduction steps?",
  followUp: null
)
```

Store the issue description as `$DESCRIPTION`. If still empty, re-prompt: "Please describe the issue to begin debugging."

---

## Step 2: EnterPlanMode — Present Debugging Plan

Call `EnterPlanMode`.

Gather remaining symptom details if not already provided. Ask (combine into one question if needed):

- Expected behavior vs. actual behavior
- Full error message / stack trace (if any)
- Steps to reproduce
- When the issue first appeared (recent changes, new dependencies)

Store:
- `$EXPECTED` — what should happen
- `$ACTUAL` — what actually happens
- `$ERROR` — full error output (if any)
- `$REPRO_STEPS` — reproduction steps

Create a GitHub Issue labeled `type:bug` to track this session:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github create-issue \
  --title "Debug: $DESCRIPTION" \
  --label "type:bug" \
  --body "## Debug Session\n\n**Description:** $DESCRIPTION\n\n**Expected:** $EXPECTED\n\n**Actual:** $ACTUAL\n\n**Error:** $ERROR\n\n**Reproduction steps:**\n$REPRO_STEPS"
```

Parse JSON response for `issue_number`. Store as `$ISSUE_NUM`.

Move the issue to "In Progress":

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $ISSUE_NUM \
  --status "In Progress"
```

Display the debugging plan to the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► DEBUG SESSION #$ISSUE_NUM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: $DESCRIPTION
GitHub: #$ISSUE_NUM (In Progress)

Debugging plan (systematic-debugging cycle):
  1. Reproduce   — confirm exact reproduction steps and error output
  2. Hypothesize — trace root cause with evidence
  3. Isolate     — narrow to specific component
  4. Verify      — confirm hypothesis with minimal test change
  5. Fix         — implement targeted fix (executor agent)
  6. Confirm     — verify fix and check for regressions (verifier agent)

Skill: systematic-debugging
```

Wait for user confirmation to proceed (unless symptoms are fully specified in `$ARGUMENTS`).

---

## Step 3: Tier Selection

Before spawning debugging agents, evaluate the execution tier:

1. **Check Tier 2 availability:**
   - Verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var is set (MaxsimCLI installer enables this by default)
   - Read `config.execution.parallelism.competition_strategy` from `.claude/maxsim/config.json`

2. **If Tier 2 is available AND `competition_strategy` is `deep`:**
   - Use Agent Teams collaborative debugging pattern:
     - `TeamCreate` to create a debug team
     - Spawn 2-3 hypothesis investigator teammates, each exploring a different root-cause theory
     - Teammates use `SendMessage` to challenge each other's hypotheses — a hypothesis only survives if it holds up to adversarial cross-examination
     - Coordinator collects surviving theories and selects the most evidence-backed root cause
   - This fights LLM anchoring bias (first plausible hypothesis wins by default)

3. **If Tier 2 is NOT available (env var unset, feature not yet stable, or `competition_strategy` is `none`/`quick`/`standard`):**
   - **Graceful degradation to Tier 1** — inform the user:
     > "Collaborative debugging: using Tier 1 subagents (Agent Teams not available or not required). Each agent investigates independently; coordinator synthesizes findings."
   - Proceed with Tier 1 subagents as described below (current default path, fully functional)

> **Graceful degradation guarantee:** Per PROJECT.md §7.2, if Agent Teams are unavailable (env var not set, unsupported plan, or feature not yet stable), MaxsimCLI falls back to Tier 1 subagents for all workflows. The user is informed but not blocked.

---

## Step 4: Reproduce — Confirm the Problem

Spawn a verifier agent to drive steps 1–4 of the `systematic-debugging` skill (Reproduce, Hypothesize, Isolate, Verify):

```
Agent(
  prompt="
You are a debugging agent for MaxsimCLI. Invoke the `systematic-debugging` skill and execute steps 1–4 of the cycle: Reproduce, Hypothesize, Isolate, and Verify.

<context>
GitHub Issue: #$ISSUE_NUM
Description: $DESCRIPTION
Expected: $EXPECTED
Actual: $ACTUAL
Error output: $ERROR
Reproduction steps: $REPRO_STEPS
</context>

<instructions>
Follow the systematic-debugging skill strictly:

1. REPRODUCE — Run the failing command or test. Capture EXACT error output. Confirm it is reliably triggerable.
2. HYPOTHESIZE — Read the full error. Check recent git changes (`git diff`, `git log --oneline -10`). State the hypothesis explicitly: 'I think X is the root cause because Y.'
3. ISOLATE — Find the smallest reproduction case. Identify the specific component or layer responsible.
4. VERIFY — Make the smallest possible change to test the hypothesis. Change one variable at a time.

Do NOT attempt any fixes. Stop after step 4 (Verify hypothesis).

Post a checkpoint comment to GitHub issue #$ISSUE_NUM when complete:
TMPFILE=\$(mktemp)
cat > \"\$TMPFILE\" << 'CHECKPOINT_EOF'
## Debug Checkpoint

**Reproduced:** {yes/no — exact steps and output}

**Hypothesis:** {explicit statement: I think X because Y}

**Isolated to:** {specific component/file/function}

**Hypothesis verified:** {confirmed/rejected + evidence}

**Root cause:** {concise description}
<!-- maxsim:type=checkpoint -->
CHECKPOINT_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $ISSUE_NUM --body-file \"\$TMPFILE\" --type checkpoint

Return:
- ROOT_CAUSE: {description} if root cause confirmed
- CHECKPOINT: {summary} if more information is needed
- INCONCLUSIVE: {what was eliminated} if hypothesis was rejected and more investigation is required
",
  subagent_type="verifier",
  isolation="worktree",
  description="Debug #$ISSUE_NUM: reproduce-hypothesize-isolate-verify"
)
```

### Handle agent return

**ROOT_CAUSE found:**

Display findings to the user:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ROOT CAUSE IDENTIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{root cause description from agent}

Options:
1. Fix — implement the fix automatically
2. Plan Fix — show the fix plan for review before implementing
3. Manual — I'll fix it myself (close debug issue as resolved)
```

Proceed to step 5 (ExitPlanMode + Fix).

**CHECKPOINT reached:**

Surface the checkpoint to the user. Collect additional context or confirmation. Spawn a continuation agent with the gathered context. Wait for it to complete before proceeding.

**INCONCLUSIVE:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 INCONCLUSIVE — MORE INFORMATION NEEDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Eliminated: {what was ruled out}

Options:
1. Continue — provide additional context and retry
2. Manual — investigate manually
3. Add Context — paste additional logs or describe more symptoms
```

If the user provides more context, update `$DESCRIPTION` / `$ERROR` / `$REPRO_STEPS` and re-spawn the verifier agent.

---

## Step 5: ExitPlanMode — Confirm the Fix

Call `ExitPlanMode`.

Present the proposed fix to the user if "Plan Fix" was selected, or proceed directly if "Fix" was selected.

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 PROPOSED FIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Root cause: {root cause}
Fix: {what will be changed and why}

Confirm to implement? (yes/no)
```

Wait for user confirmation before spawning the executor.

---

## Step 6: Fix — Implement the Fix

Spawn an executor agent to implement the fix (step 5 of the `systematic-debugging` skill):

```
Agent(
  prompt="
You are an executor agent for MaxsimCLI. Implement the fix identified in the debug session.

<context>
GitHub Issue: #$ISSUE_NUM
Description: $DESCRIPTION
Root cause: {root_cause from verifier output}
Reproduction steps: $REPRO_STEPS
</context>

<instructions>
Follow systematic-debugging step 5 (FIX):
- Write a failing test that reproduces the bug (when applicable)
- Implement a single fix that addresses the root cause
- No 'while I'm here' improvements — fix only the identified issue
- Commit with message: fix({scope}): {description} — closes #$ISSUE_NUM

Do NOT fix anything beyond the identified root cause.

Return: COMMIT_HASH and a short SUMMARY of what was changed.
",
  subagent_type="executor",
  isolation="worktree",
  description="Fix #$ISSUE_NUM: $DESCRIPTION"
)
```

Extract `$COMMIT_HASH` and `$FIX_SUMMARY` from executor output.

---

## Step 7: Confirm — Verify the Fix

Spawn a verifier agent to confirm the fix (step 6 of the `systematic-debugging` skill):

```
Agent(
  prompt="
You are a verifier agent for MaxsimCLI. Confirm that the fix resolves the reported issue.

<context>
GitHub Issue: #$ISSUE_NUM
Description: $DESCRIPTION
Reproduction steps: $REPRO_STEPS
Commit: $COMMIT_HASH
Fix summary: $FIX_SUMMARY
</context>

<instructions>
Follow systematic-debugging step 6 (CONFIRM):
1. Run the original failing test or reproduction steps — it must now pass
2. Run the full test suite — no regressions allowed
3. Verify the original error no longer occurs
4. Evidence required: show actual command output

Return: PASS or FAIL with brief reasoning and evidence.
",
  subagent_type="verifier",
  isolation="worktree",
  description="Verify fix for #$ISSUE_NUM"
)
```

Store `$VERIFY_STATUS` (PASS or FAIL).

If FAIL: display issues, ask user whether to retry the fix or accept as-is.

---

## Step 8: Report — Post Results and Close Issue

Post a resolution comment to the GitHub Issue:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'RESOLUTION_EOF'
## Resolution

**Root cause:** {root_cause}

**Fix:** $FIX_SUMMARY

Commit: $COMMIT_HASH

Verification: $VERIFY_STATUS
<!-- maxsim:type=summary -->
RESOLUTION_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $ISSUE_NUM --body-file "$TMPFILE" --type summary
```

Close the debug issue and move to Done:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github close-issue --issue-number $ISSUE_NUM
node .claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $ISSUE_NUM \
  --status "Done"
```

Display:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM ► DEBUG COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Issue: $DESCRIPTION
GitHub: #$ISSUE_NUM (closed)
Root cause: {root_cause}
Fix: $FIX_SUMMARY
Commit: $COMMIT_HASH
Verification: $VERIFY_STATUS
```

</process>

<success_criteria>
- [ ] Issue description gathered from $ARGUMENTS or via AskUserQuestion
- [ ] Open debug Issues checked on GitHub before starting a new session
- [ ] GitHub Issue created with label "type:bug" and moved to "In Progress"
- [ ] EnterPlanMode called before presenting the debugging plan
- [ ] Tier selection evaluated: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS env var and config.execution.parallelism.competition_strategy checked
- [ ] Tier 2 path (Agent Teams collaborative debugging) used when env var set and strategy is `deep`
- [ ] Graceful degradation to Tier 1 with user notification when Tier 2 is not available
- [ ] Verifier agent spawned with subagent_type="verifier" and isolation="worktree"
- [ ] Verifier drives systematic-debugging steps 1–4 (Reproduce, Hypothesize, Isolate, Verify)
- [ ] Checkpoint, INCONCLUSIVE, and ROOT_CAUSE return paths handled
- [ ] ExitPlanMode called after user confirms the fix approach
- [ ] Executor agent spawned with subagent_type="executor" and isolation="worktree" using Agent tool (NOT Task)
- [ ] Executor implements only the identified root cause fix
- [ ] Second verifier agent confirms fix and checks for regressions
- [ ] Resolution comment posted to GitHub Issue
- [ ] Debug Issue closed and moved to "Done"
</success_criteria>
