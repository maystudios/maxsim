<sanity_check>
Before executing any step in this workflow, verify:
1. The current directory contains a `.planning/` folder -- if not, stop and tell the user to run `/maxsim:init` first.
2. `.planning/ROADMAP.md` exists -- if not, stop and tell the user to initialize the project.
</sanity_check>

<purpose>
Thin orchestrator for the /maxsim:execute state machine. Detects the current state of a phase (already done, needs verification, needs execution), delegates per-plan execution to execute-plan.md subagents, runs auto-verification, and handles retry with gap closure.

This file is the ORCHESTRATOR ONLY. Per-plan execution logic lives in:
- @~/.claude/maxsim/workflows/execute-plan.md (per-plan subagent execution)

Verification is handled inline (spawning verifier agent) since it is a stage of this workflow, not a separate command.
</purpose>

<process>

## 1. Initialize

Load phase state in one call:

```bash
INIT=$(node .claude/maxsim/bin/maxsim-tools.cjs init execute-phase "$PHASE")
```

Parse `$ARGUMENTS` for: phase number (required), `--worktrees` (force worktree mode), `--no-worktrees` (force standard mode), `--auto` (auto-advance), `--gaps-only` (gap plans only).

Parse JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `has_verification`, `commit_docs`, `executor_model`, `verifier_model`, `parallelization`, `state_path`, `roadmap_path`, `requirements_path`, `phase_req_ids`, `phase_issue_number`, `task_mappings`.

All flags from `$ARGUMENTS` are passed through to the execute-phase workflow steps so they are available for execution mode decision and auto-advance detection.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.

Use /maxsim:progress to see available phases.
```
Exit workflow.

**If `plan_count` is 0 (GitHub check):**

When GitHub integration is active (phase_issue_number is set), check for plan comments on the phase issue before reporting no plans:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue $PHASE_ISSUE_NUMBER --comments
```

Parse the response to find comments with `<!-- maxsim:type=plan -->` markers or `## Plan NN` headings. If no plan comments are found:

```
No plans found for Phase {phase_number}.

Run /maxsim:plan {phase_number} first to create execution plans.
```
Exit workflow.

## 2. Detect State

### 2a. Load Plan Inventory from GitHub

When GitHub integration is active (`phase_issue_number` is set):

1. Fetch the phase issue and its comments:
   ```bash
   node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue $PHASE_ISSUE_NUMBER --comments
   ```

2. Parse issue comments to identify plan comments. A plan comment is one that contains either:
   - A `<!-- maxsim:type=plan -->` HTML comment marker, OR
   - A heading matching `## Plan NN` (where NN is a number)

3. For each plan comment found:
   - Extract the plan number (from the `## Plan NN` heading or frontmatter)
   - Parse YAML frontmatter from the comment body for: `wave`, `dependencies`, `autonomous`, `objective`, `gap_closure`
   - Store plan content in memory as `PLAN_COMMENTS[]`

4. Check completion status for each plan by calling:
   ```bash
   node ~/.claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues $PHASE_ISSUE_NUMBER
   ```
   A plan is considered complete when ALL of its task sub-issues are closed (state: closed).
   Additionally, check for `<!-- maxsim:type=summary -->` comments on the phase issue as a secondary completion signal.

5. Build `plan_inventory` from GitHub data:
   - `plans[]`: each with `id`, `wave`, `autonomous`, `objective`, `has_summary` (derived from sub-issue closure)
   - `incomplete_plans[]`: plans where not all task sub-issues are closed
   - `plan_count`: total plan comments found
   - `incomplete_count`: count of incomplete plans

When GitHub integration is NOT active (no `phase_issue_number`):
```
No plans found for Phase {phase_number}. GitHub Issues is the source of truth for plans.

Ensure GitHub integration is configured: run /maxsim:init to set up GitHub Issues.
```
Exit workflow.

### 2b. Check for External Edits (WIRE-06)

If phase_issue_number is set, optionally detect whether the phase issue was externally modified since last read:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github detect-external-edits --phase-number "$PHASE_NUMBER"
```

If external edits are detected: warn the user before proceeding.
```
⚠️  Phase issue #{phase_issue_number} was modified externally since last check.
Review the changes before continuing? (yes/no)
```

### 2c. Determine Execution State

Determine where to start based on phase artifacts:

| Condition | State | Action |
|-----------|-------|--------|
| `incomplete_count == 0` AND `has_verification == true` | Already done | Go to **Re-entry flow** (step 3) |
| `incomplete_count == 0` AND `has_verification == false` | Needs verification | Start at **Auto-Verify** (step 5) |
| `incomplete_count > 0` | Needs execution | Start at **Execute Plans** (step 4) |

Display detected state:
```
Phase {phase_number}: {phase_name}
Current state: {Already executed | Needs verification | Ready to execute}
Plans: {plan_count} total, {incomplete_count} incomplete
```

## 3. Re-entry Flow (Already Executed and Verified)

When all plans are complete and verification has passed, show status and offer options.

Display:
```
## Phase {phase_number} Already Executed

**Plans:** {plan_count} plan(s) -- all complete
**Verification:** Passed
**Phase issue:** #{phase_issue_number} (if GitHub active)

**Options:**
1. View results -- show plan summaries from GitHub comments
2. Re-execute from scratch -- reopen task sub-issues and restart execution
3. View verification -- show verification comment on phase issue
4. Done (exit)
```

Wait for user choice via natural conversation.

- **View results:** Fetch and display summary comments (`<!-- maxsim:type=summary -->`) from the phase issue, then re-show options.
- **Re-execute:** Reopen task sub-issues via `github reopen-issue` for each task sub-issue, restart from Execute Plans (step 4).
- **View verification:** Fetch and display the verification comment (`<!-- maxsim:type=verification -->`) from the phase issue, then re-show options.
- **Done:** Exit workflow.

## 4. Execute Plans

Execute all plans in wave order, delegating each plan to a subagent via execute-plan.md.

### 4.1 Discover and Group Plans

Use the plan inventory built in step 2 (from GitHub comments or local files).

Skip plans where `has_summary: true` (already complete -- supports resume).

If all plans already have summaries: skip to Auto-Verify (step 5).

Report:
```
## Execution Plan

**Phase {phase_number}: {phase_name}** -- {total_plans} plans across {wave_count} waves

| Wave | Plans | What it builds |
|------|-------|----------------|
| 1 | 03-01, 03-02 | {from plan objectives, 3-8 words} |
| 2 | 03-03 | ... |
```

### 4.2 Execute Waves

Execute each wave in sequence. Within a wave: parallel if `parallelization` is true, sequential if false.

**For each wave:**

1. **Describe what is being built (BEFORE spawning):**

   Read each plan's `<objective>`. Extract what is being built and why.

   ```
   ---
   ## Wave {N}

   **{Plan ID}: {Plan Name}**
   {2-3 sentences: what this builds, technical approach, why it matters}

   Spawning {count} agent(s)...
   ---
   ```

2. **Spawn executor agents:**

   Pass plan content and GitHub context -- executors read the plan from GitHub comment content passed in the prompt.

   ```
   Task(
     subagent_type="executor",
     model="{executor_model}",
     prompt="
       <objective>
       Execute plan {plan_number} of phase {phase_number}-{phase_name}.
       Commit each task atomically. Post SUMMARY as GitHub comment. Update STATE.md and ROADMAP.md.
       Move task sub-issues on the board as you work (In Progress → Done per task).
       </objective>

       <execution_context>
       @~/.claude/maxsim/workflows/execute-plan.md
       @~/.claude/maxsim/templates/summary.md
       @~/.claude/maxsim/references/checkpoints.md
       @~/.claude/maxsim/references/tdd.md
       </execution_context>

       <github_context>
       Phase issue number: {phase_issue_number}
       Plan comment: {plan_comment_body}
       Task mappings: {task_mappings_for_this_plan}
       </github_context>

       <files_to_read>
       Read these files at execution start using the Read tool:
       - .planning/STATE.md (State)
       - .planning/config.json (Config, if exists)
       - ./CLAUDE.md (Project instructions, if exists)
       </files_to_read>

       <success_criteria>
       - [ ] All tasks executed
       - [ ] Each task committed individually
       - [ ] Summary posted as GitHub comment (`github post-comment` with type=summary) on phase issue
       - [ ] Task sub-issues moved: In Progress when started, Done when completed
       - [ ] STATE.md updated with position and decisions
       - [ ] ROADMAP.md updated with plan progress
       </success_criteria>
     "
   )
   ```

3. **Wait for all agents in wave to complete.**

4. **Spot-check results:**

   For each completed plan:
   - Check that a `<!-- maxsim:type=summary -->` comment exists on the phase issue for this plan
   - Check `git log --oneline --all --grep="{phase}-{plan}"` returns at least 1 commit
   - Verify task sub-issues for this plan are all closed
   - Check for `## Self-Check: FAILED` in the summary comment body
   - Check for `## Review Cycle` section in summary -- verify both Spec and Code stages show PASS

   If ANY spot-check fails: report which plan failed, ask "Retry plan?" or "Continue with remaining waves?"

5. **Report wave completion:**

   ```
   ---
   ## Wave {N} Complete

   **{Plan ID}: {Plan Name}**
   {What was built -- from summary comment}
   {Notable deviations, if any}

   {If more waves: what this enables for next wave}
   ---
   ```

6. **Handle checkpoint plans:** Plans with `autonomous: false` may return checkpoints. Present checkpoint to user, spawn continuation agent after user responds, wait for completion before proceeding.

7. **Proceed to next wave.**

### 4.3 Execution Summary Gate

After all waves complete:

```
## Gate: Execution Complete

**Plans executed:** {completed}/{total}
**Waves:** {wave_count}
**Commits:** {list of commit summaries from summary comments}

Proceeding to verification...
```

**Move phase issue to "In Review" on GitHub (WIRE-08):**
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number $PHASE_ISSUE_NUMBER --status "In Review"
```
This signals all tasks are complete and the phase is awaiting verification. The phase moves to "Done" only after verification passes.

Wait for user confirmation before proceeding to verification.

## 5. Auto-Verify

Verify that the phase achieved its GOAL, not just that tasks completed.

### 5.1 Spawn Verifier

Resolve verifier model and spawn the verifier agent:

```bash
VERIFIER_MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model verifier --raw)
```

```
Task(
  prompt="Verify phase {phase_number} goal achievement.
Phase directory: {phase_dir}
Phase issue: #{phase_issue_number}
Phase goal: {goal from ROADMAP.md}
Phase requirement IDs: {phase_req_ids}
Check must_haves against actual codebase.
Cross-reference requirement IDs from plan frontmatter against REQUIREMENTS.md.
Post verification results as a GitHub comment (`github post-comment` with type=verification) on the phase issue.
Also write VERIFICATION.md to the phase directory for local reference.",
  subagent_type="verifier",
  model="{verifier_model}"
)
```

### 5.2 Parse Verifier Result

Read verification status from the verification comment on the phase issue:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue $PHASE_ISSUE_NUMBER --comments
```

Look for the `<!-- maxsim:type=verification -->` comment and parse the `status:` field from its body.

**If `passed`:** Show verification gate and proceed to completion.

```
## Gate: Verification Passed

**Status:** All must-haves verified
**Evidence:** {summary from verification comment}

Phase {phase_number} complete!
```

Move phase issue to "Done" status:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number $PHASE_ISSUE_NUMBER --status "Done"
```

Post phase completion comment:
```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Phase {phase_number} Complete

All plans executed and verified.

**Plans:** {completed}/{total}
**Waves:** {wave_count}
**Verification:** Passed
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type phase-complete
```

Mark phase complete:
```bash
COMPLETION=$(node .claude/maxsim/bin/maxsim-tools.cjs phase complete "${PHASE_NUMBER}")
```

Update tracking files:
```bash
node .claude/maxsim/bin/maxsim-tools.cjs commit "docs(phase-{X}): complete phase execution" --files .planning/ROADMAP.md .planning/STATE.md .planning/REQUIREMENTS.md {phase_dir}/*-VERIFICATION.md
```

**If `gaps_found`:** Post a gaps comment on the phase issue, then proceed to Retry Loop (step 6).

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Verification Gaps Found

{gap summaries from verification result}
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type verification-gaps
```

**If `human_needed`:** Present items for human testing, get approval or feedback. If approved, treat as passed. If issues reported, proceed to Retry Loop.

## 6. Retry Loop (Max 2 Retries)

If verification failed, attempt gap closure. Maximum 2 retries (3 total attempts including the initial execution).

Initialize: `attempt_count = 1`

### 6.1 Check Attempt Budget

If `attempt_count > 2`:
```
## Verification Failed After 3 Attempts

**Status:** Could not resolve all gaps
**Attempts:** 3 (initial + 2 retries)

### What Failed
{List of unresolved gaps from verification comment with evidence}

### Options
1. Fix manually and re-run `/maxsim:execute {phase_number}`
2. Run `/maxsim:debug` to investigate failing items
3. Accept as-is and continue to next phase
```

Wait for user decision. Exit workflow.

### 6.2 Plan Gap Closure

Display: "Verification failed. Retrying... (attempt {attempt_count + 1}/3)"

Spawn planner in gap-closure mode to create fix plans:

```
Task(
  prompt="
<planning_context>
**Phase:** {phase_number}
**Mode:** gap_closure

<files_to_read>
- {phase_dir}/{phase_num}-VERIFICATION.md (Verification with gaps)
- .planning/STATE.md (Project State)
- .planning/ROADMAP.md (Roadmap)
</files_to_read>
</planning_context>

<downstream_consumer>
Output consumed by /maxsim:execute.
Plans must be executable prompts.
Post gap-closure plans as comments on phase issue #{phase_issue_number} using `github post-comment` with type=plan.
</downstream_consumer>
",
  subagent_type="planner",
  model="{planner_model}"
)
```

### 6.3 Execute Gap Plans

After the planner posts gap-closure plan comments on the phase issue, re-read the phase issue to discover the new plan comments. Execute the newly created gap-closure plans using the same wave execution logic from step 4. Only execute plans with `gap_closure: true` in frontmatter.

### 6.4 Re-verify

Spawn verifier again (back to step 5). Increment `attempt_count`.

If verification passes: proceed to completion.
If verification fails and attempts remain: loop back to 6.1.

## 7. Checkpoint Before /clear

At any point during the workflow, if context is getting full (conversation is long, many tool calls made), recommend checkpointing before `/clear`.

**Checkpoint protocol:**
1. Post a checkpoint comment to the phase's GitHub Issue (if issue tracking is active):
```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## MAXSIM Checkpoint

**Command:** /maxsim:execute
**Stage:** {current_stage}
**Plans completed:** {completed_count}/{total_count}
**Verification attempts:** {attempt_count}/3
**Resume from:** {next_action}
**Timestamp:** {ISO timestamp}
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type checkpoint
```

2. Display checkpoint recommendation:
```
Context is filling up. Recommended: save progress and /clear.

Your progress has been checkpointed on GitHub issue #{phase_issue_number}. Re-run `/maxsim:execute {phase_number}` after /clear -- it will detect completed plans (via closed task sub-issues) and resume from where it left off.
```

The state detection in step 2 handles resume automatically -- completed plans have all their task sub-issues closed, which is detected on re-entry.

## 8. Update State

After verification passes, update STATE.md:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs state record-session \
  --stopped-at "Phase ${PHASE} executed and verified" \
  --resume-file "${phase_dir}"
```

## 9. Completion

Display final results:

```
## Phase {phase_number}: {phase_name} -- Execution Complete

**Plans:** {completed}/{total} complete
**Waves:** {wave_count}
**Verification:** Passed (attempt {attempt_count}/3)
**Phase issue:** #{phase_issue_number} (closed)

### Plan Details
1. **{plan_id}**: {one-liner from summary comment}
2. **{plan_id}**: {one-liner from summary comment}

### Next Steps
- `/maxsim:plan {next_phase}` -- Plan next phase
- `/maxsim:progress` -- View overall progress
```

</process>

<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Plan inventory loaded from GitHub issue comments (GitHub Issues is the source of truth)
- [ ] External edit detection warns user if phase issue was modified externally
- [ ] Current state correctly detected from task sub-issue closure and summary comments
- [ ] Re-entry flow works for already-executed phases
- [ ] Plans discovered from GitHub comments and grouped by wave
- [ ] Per-plan execution delegates to execute-plan.md sub-workflow via Task with GitHub context
- [ ] Spot-check reads summary comments and checks sub-issue closure instead of local SUMMARY.md
- [ ] Gate confirmation shown after execution completes
- [ ] Auto-verification spawns verifier agent that posts to GitHub
- [ ] Phase issue moved to "In Review" after all tasks complete (before verification)
- [ ] Phase issue moved to "Done" on verification pass
- [ ] Retry loop with gap closure (max 2 retries, 3 total attempts)
- [ ] Checkpoint-before-clear posts to GitHub issue
- [ ] No references to old SUMMARY.md local file checks for completion detection
</success_criteria>
