<sanity_check>
Before executing any step in this workflow, verify:
1. GitHub connectivity is available — `node .claude/maxsim/bin/maxsim-tools.cjs github status` must succeed.
2. Git is initialized (`git rev-parse --git-dir` succeeds) — worktrees require a git repository.
</sanity_check>

<purpose>
Wave-based parallel orchestrator for phase execution. GitHub Issues is the SOLE source of truth for plans, task status, and completion. Every executor runs in an isolated git worktree. Agents are spawned in a SINGLE message block per wave for maximum parallelism. Verification is automatic and strict (max 4 total attempts).
</purpose>

<process>

## 1. Initialize

Resolve executor model and load phase state in one call:

```bash
EXECUTOR_MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model executor --raw)
VERIFIER_MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model verifier --raw)
INIT=$(node .claude/maxsim/bin/maxsim-tools.cjs init execute-phase "$PHASE_NUMBER")
```

Parse `$ARGUMENTS` for: phase number (required), `--auto` (skip confirmation prompts), `--gaps-only` (execute gap-closure plans only).

Parse JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `has_verification`, `executor_model`, `verifier_model`, `parallelization`, `phase_issue_number`, `task_mappings`.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.
Use /maxsim:progress to see available phases.
```
Exit workflow.

## 2. Load Phase Inventory from GitHub Issues

GitHub Issues is the SOLE source of truth. All plan discovery happens here.

**Step 2a — Fetch phase issue and sub-issues:**

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments

node .claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues \
  --phase-issue-number $PHASE_ISSUE_NUMBER
```

**Step 2b — Parse plan comments:**

A plan comment is one that contains either:
- A `<!-- maxsim:type=plan -->` HTML marker, OR
- A heading matching `## Plan NN`

For each plan comment, extract:
- Plan number (from `## Plan NN` heading or frontmatter)
- YAML frontmatter: `wave`, `dependencies`, `autonomous`, `objective`, `gap_closure`
- Task list and success criteria
- Associated task sub-issue numbers (from `task_mappings`)

**Step 2c — Determine completion per plan:**

A plan is complete when ALL its task sub-issues are closed. Also accept `<!-- maxsim:type=summary -->` comments as a secondary signal.

**Step 2d — Build plan inventory:**

```
plan_inventory:
  plans[]         — all plans with id, wave, autonomous, objective, task_issue_numbers
  incomplete[]    — plans with at least one open task sub-issue
  plan_count      — total plan comments found
  incomplete_count — count of incomplete plans
```

**If no plan comments found:**
```
No plans found for Phase {phase_number}.
Run /maxsim:plan {phase_number} first to create execution plans.
```
Exit workflow.

**Step 2e — Detect external edits (WIRE-06):**

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github detect-external-edits \
  --phase-number "$PHASE_NUMBER"
```

If external edits detected, warn before proceeding:
```
Warning: Phase issue #{phase_issue_number} was modified externally since last check.
Review changes before continuing? (yes/no)
```

## 3. Detect Execution State

| Condition | State | Action |
|-----------|-------|--------|
| `incomplete_count == 0` AND `has_verification == true` | Already done | Go to Re-entry flow (step 4) |
| `incomplete_count == 0` AND `has_verification == false` | Needs verification | Go to Auto-Verify (step 7) |
| `incomplete_count > 0` | Needs execution | Go to Plan Mode (step 5) |

Display detected state:
```
Phase {phase_number}: {phase_name}
State: {Already executed | Needs verification | Ready to execute}
Plans: {plan_count} total, {incomplete_count} incomplete
```

## 4. Re-entry Flow (Already Executed and Verified)

Display:
```
## Phase {phase_number} Already Executed

Plans: {plan_count} — all complete
Verification: Passed
Phase issue: #{phase_issue_number}

Options:
1. View results — show plan summaries from GitHub comments
2. Re-execute from scratch — reopen task sub-issues and restart
3. View verification — show verification comment
4. Done (exit)
```

Wait for user choice:
- **View results:** Fetch and display `<!-- maxsim:type=summary -->` comments, re-show options.
- **Re-execute:** Reopen all task sub-issues via `github reopen-issue`, restart at step 5.
- **View verification:** Fetch and display `<!-- maxsim:type=verification -->` comment, re-show options.
- **Done:** Exit workflow.

## 5. Plan Mode — Review and Confirm

**Call `EnterPlanMode` before spawning any executors.**

Group incomplete plans by wave. Display the full execution plan:

```
## Execution Plan

Phase {phase_number}: {phase_name} — {incomplete_count} plans across {wave_count} waves

| Wave | Plan ID | Objective |
|------|---------|-----------|
| 1    | {id}    | {from plan objective, 5-10 words} |
| 1    | {id}    | ... |
| 2    | {id}    | ... |

Execution model: {executor_model}
Parallelism: {parallelization}
Isolation: worktree (each agent gets its own git worktree)

Confirm to begin execution? (yes/no)
```

Wait for user confirmation unless `--auto` flag is set.

When `--auto` flag is set, still call `ExitPlanMode` after displaying the plan summary (auto-approval).

**Call `ExitPlanMode` after user confirms.** Begin wave execution.

## 6. Execute Waves

Execute each wave in sequence. Within a wave, spawn ALL agents in a SINGLE message block (all Agent calls at once) with `run_in_background: true` for parallelism.

**For each wave:**

### 6.1 Describe wave before spawning

> **Wave Adaptation:** Before spawning each wave, re-read the plan inventory from GitHub to check if any tasks have been completed or added since Plan Mode was exited. If the wave structure has changed, re-group incomplete plans by wave number and display the updated plan before spawning.

For each plan in the wave, read its `objective`. Display:

```
---
## Wave {N} — Spawning {count} agent(s)

**{Plan ID}: {Plan Name}**
{2-3 sentences: what this builds, technical approach, why it matters}

[Additional plans in this wave...]
---
```

### 6.2 Spawn all wave agents in ONE message block

All Agent calls for the wave are issued simultaneously. Each agent is isolated in its own worktree.

**Branch naming:** Each executor creates a branch named `maxsim/phase-{N}-task-{id}` (e.g., `maxsim/phase-3-task-42`), where `{N}` is the phase number and `{id}` is the task/plan issue number. This aligns with the `maxsim/` branch prefix convention.

For each plan in the wave:

```
Agent(
  subagent_type="executor",
  model="{executor_model}",
  isolation="worktree",
  run_in_background=true,
  prompt="
    Follow @.claude/maxsim/workflows/execute-plan.md end-to-end for this task.

    <task_context>
    Phase issue number: {phase_issue_number}
    Phase: {phase_number} — {phase_name}
    Plan ID: {plan_id}
    Task sub-issue numbers: {task_issue_numbers for this plan}
    Task mappings: {task_mappings for this plan}
    </task_context>

    <plan_content>
    {full plan_comment_body for this plan, including all tasks and success criteria}
    </plan_content>
  "
)
```

### 6.3 Competitive Implementation (Optional)

> **Opt-in feature.** Only activates when `config.execution.competitive_enabled` is `true` AND the task is marked as `critical` in its GitHub Issue labels.

When competitive mode is active for a task:
1. Spawn **2 executor agents** for the same task (each in its own worktree)
2. Each agent works independently with a different approach prompt variation
3. After both complete, spawn a **verifier agent** using `@.claude/maxsim/workflows/verify-phase.md` to compare both implementations
4. The verifier selects the better implementation based on: correctness, code quality, test coverage, and simplicity
5. Discard the losing implementation's worktree branch

#### Tier Selection

Before spawning competitive agents, evaluate the execution tier:

1. **Check Tier 2 availability:**
   - Verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env var is set (MaxsimCLI installer enables this by default)
   - Verify Agent Teams feature is stable and responsive (attempt a lightweight `TeamCreate` probe)
   - Read `config.execution.parallelism.competition_strategy` from `.claude/maxsim/config.json`

2. **If Tier 2 is available AND `competition_strategy` is `deep`:**
   - Use Agent Teams debate pattern:
     - `TeamCreate` to create a competition team
     - Spawn 2-3 teammates, each solving the same task independently
     - Teammates use `SendMessage` to actively challenge each other's approaches
     - The theory/implementation that survives adversarial cross-examination wins
   - This fights LLM anchoring bias (first plausible answer wins)

3. **If Tier 2 is NOT available (env var unset, feature not yet stable, or `competition_strategy` is `none`/`quick`/`standard`):**
   - **Graceful degradation to Tier 1** — inform the user:
     > "Competitive mode: using Tier 1 subagents (Agent Teams not available or not required for this strategy). Each executor works independently; verifier selects the best result."
   - Spawn 2 executor subagents via the `Agent` tool with `isolation: "worktree"` and `run_in_background: true`
   - Each agent gets a different approach prompt variation
   - After both complete, the verifier compares and selects the winner
   - This is the current default path and is fully functional

> **Graceful degradation guarantee:** Per PROJECT.md §7.2, if Agent Teams are unavailable (env var not set, unsupported plan, or feature not yet stable), MaxsimCLI falls back to Tier 1 subagents for all workflows. The user is informed but not blocked.

### 6.4 Wait for all wave agents to complete

Do not proceed until every agent in the current wave has returned.

### 6.5 Verify completed tasks (automatic)

For each plan completed in this wave, run spot-checks:

```bash
# Check summary comment exists
node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments
# Look for <!-- maxsim:type=summary --> comment for this plan

# Check at least one commit exists for this plan
git log --oneline --all --grep="{phase_number}-{plan_id}" 2>/dev/null

# Check all task sub-issues for this plan are closed
node .claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues \
  --phase-issue-number $PHASE_ISSUE_NUMBER
```

Spot-check passes when:
- A `<!-- maxsim:type=summary -->` comment exists for this plan
- At least 1 commit found matching `{phase}-{plan}` grep
- All task sub-issues for this plan are closed
- No `## Self-Check: FAILED` in the summary comment body

If any spot-check fails: report which plan failed. Ask user: "Retry plan or continue with remaining waves?"

### 6.6 Report wave completion

```
---
## Wave {N} Complete

{For each plan in wave:}
**{Plan ID}: {Plan Name}**
{What was built — from summary comment one-liner}
{Notable deviations, if any}

{If more waves remain: what this wave enables for wave N+1}
---
```

### 6.7 Handle checkpoint plans

Plans with `autonomous: false` may pause for user input. When a checkpoint is returned:
1. Present the checkpoint to the user
2. Collect user response
3. Spawn a continuation agent for that plan
4. Wait for continuation to complete before advancing to next wave

### 6.8 Merge worktree branches

After all plans in the wave are complete and spot-checks pass, merge each worktree branch back to main sequentially:

```bash
# For each completed worktree branch from this wave (branch name follows maxsim/phase-{N}-task-{id}):
git merge --no-ff maxsim/phase-{N}-task-{id}
```

After merging each branch, run the project's test suite to catch merge-induced regressions:

```bash
npm test 2>&1 || echo "MERGE VERIFICATION FAILED"
```

If the test suite fails after a merge, revert the merge (`git revert HEAD --no-edit`) and escalate to the user before continuing.

Branches are merged sequentially to minimize conflicts. If a merge conflict occurs:
- Check `auto_resolve_conflicts` in `.claude/maxsim/config.json` (default: true)
- If true: abort the conflicted merge (`git merge --abort`), then retry with `git merge -X theirs maxsim/phase-{N}-task-{id}` to auto-resolve in favor of the incoming branch
- If auto-resolve succeeds: run `npm test` to verify the result
- If auto-resolve fails or tests fail after auto-resolve: revert and ask the user to resolve manually
- If false: report immediately and ask the user to resolve before continuing

### 6.9 Advance to next wave

Repeat steps 6.1–6.8 for each subsequent wave.

## 7. Execution Summary Gate

After all waves complete:

```
## Gate: Execution Complete

Plans executed: {completed}/{total}
Waves: {wave_count}
Commits: {list commit summaries from summary comments}

Moving phase to In Review and proceeding to verification...
```

Move phase issue to "In Review":

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $PHASE_ISSUE_NUMBER --status "In Review"
```

Unless `--auto` is set, confirm with user before starting verification.

Initialize `attempt_count = 1` before invoking the verifier.

### 7.1 Log execution metrics

After verification completes (section 8), append a TSV row to `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`:

```
{wave_count}	{last_commit_hash}	{tasks_completed}	{delta_from_plan}	{guard_result}	{status}	Phase {N} execution complete
```

Where `status` is `keep` if verification passed, `discard` if it failed.

## 8. Auto-Verify

Spawn the verifier agent to check phase goal achievement:

```
Agent(
  subagent_type="verifier",
  model="{verifier_model}",
  isolation="worktree",
  prompt="
    Follow @.claude/maxsim/workflows/verify-phase.md end-to-end for this phase verification.

    <phase_context>
    Phase: {phase_number} — {phase_name}
    Phase issue: #{phase_issue_number}
    Phase goal: {goal from phase issue body}
    Success criteria: {success criteria from phase issue body}
    Phase sub-issues: {list of task sub-issue numbers}
    </phase_context>
  "
)
```

### 8.1 Parse verifier result

Read the verification comment from GitHub:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments
```

Look for `<!-- maxsim:type=verification -->` comment and parse its `status:` field.

**If passed:** Show gate and proceed to step 9.

```
## Gate: Verification Passed

Status: All must-haves verified
Evidence: {summary from verification comment}

Phase {phase_number} complete!
```

Move phase issue to Done:
```bash
node .claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $PHASE_ISSUE_NUMBER --status "Done"
```

Post phase completion comment:
```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Phase {phase_number} Complete

All plans executed and verified.

Plans: {completed}/{total}
Waves: {wave_count}
Verification: Passed (attempt {attempt_count}/3)
<!-- maxsim:type=phase-complete -->
BODY_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type phase-complete
```

Mark phase complete:
```bash
node .claude/maxsim/bin/maxsim-tools.cjs phase complete "${PHASE_NUMBER}"
```

> **Push strategy:** A single push occurs after full phase verification rather than per-wave, to avoid pushing partially-verified work. Each wave's merges are committed locally and verified by the test suite (step 6.8) before the next wave begins. If execution is interrupted, local commits preserve progress for re-entry via `/maxsim:execute`.

Push changes to remote:
```bash
git push origin HEAD
```

**If gaps_found:** Post gaps comment, then proceed to Retry Loop (step 9).

**If human_needed:** Present items for human testing. If approved, treat as passed. If issues reported, proceed to Retry Loop.

### 8.2 Error Recovery Protocol

When verification identifies unresolved gaps, recovery proceeds through three tiers:

**Tier 1 — Debug (attempts 1–3):**
- Spawn a fresh planner to analyze the failure and produce a targeted gap-closure plan
- Spawn a fresh executor to implement the fix in an isolated worktree
- Run verification again on the result
- If successful: phase completes. If fails: advance to next tier.

**Tier 2 — Rollback (after 3 failed attempts):**
- Revert the failing changes: `git revert HEAD --no-edit`
- Document which gaps remain unresolved with evidence
- Surface blockers to the user with exact error output

**Tier 3 — Escalate:**
- Create a diagnostic GitHub Issue labeled `type:bug` and `maxsim:auto`
- Include: original spec, all attempt summaries, exact gate failures, root cause analysis
- Move the phase to "Blocked" on the Project Board
- Notify the user and await manual intervention

## 9. Retry Loop (Max 3 Retries — 4 Total Attempts)

### 9.1 Check attempt budget

If `attempt_count > 3`:
```
## Verification Failed After 4 Attempts

Status: Could not resolve all gaps
Attempts: 4 (initial + 3 retries)

### What Failed
{List unresolved gaps with evidence from verification comment}

### Options
1. Fix manually and re-run /maxsim:execute {phase_number}
2. Accept as-is and continue to next phase
```

#### Diagnostic GitHub Issue

When all 4 attempts are exhausted, create a diagnostic GitHub Issue:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Task
{task_description}

## Failure Summary
{last_failure_output}

## Attempts
- Attempt 1: {result}
- Attempt 2: {result}
- Attempt 3: {result}
- Attempt 4: {result}

## Suggested Investigation
- Review the task requirements for ambiguity
- Check for environmental dependencies
- Consider breaking the task into smaller sub-tasks
BODY_EOF
gh issue create \
  --title "fix: [Phase {N}] Task {id} failed after 4 attempts" \
  --body-file "$TMPFILE" \
  --label "type:bug" --label "maxsim:auto"
```

Add the created issue number to the phase's gap list for user review.

Exit workflow.

### 9.2 Plan gap closure

Display: "Verification failed. Retrying... (attempt {attempt_count + 1}/4)"

Resolve planner model:
```bash
PLANNER_MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model planner --raw)
```

Spawn planner in gap-closure mode:

```
Agent(
  subagent_type="planner",
  model="{planner_model}",
  isolation="worktree",
  prompt="
    <planning_context>
    Phase: {phase_number}
    Mode: gap_closure
    Phase issue: #{phase_issue_number}

    Load phase context from GitHub:
    - Phase issue body: node .claude/maxsim/bin/maxsim-tools.cjs github get-issue --issue-number {phase_issue_number}
    - Phase milestone: node .claude/maxsim/bin/maxsim-tools.cjs github status
    </planning_context>

    Load the verification comment (type=verification) from the phase issue.
    Identify all gaps listed as FAILED or MISSING.

    Create focused gap-closure plans — one plan per gap cluster.
    Post each plan as a comment on phase issue #{phase_issue_number}:
    node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \\
      --issue-number {phase_issue_number} --body-file plan_file --type plan

    Each plan must include frontmatter with gap_closure: true.
  "
)
```

### 9.3 Execute gap-closure plans

Re-read the phase issue to discover new plan comments with `gap_closure: true` in frontmatter.

Before executing, analyze the failure using the `systematic-debugging` skill pattern:
1. Identify the root cause from the failure output
2. Classify: build error, test failure, lint violation, or runtime error
3. Include the diagnosis in the retry agent's prompt so it can avoid the same mistake

Execute them using the same wave logic (steps 6.1–6.9).

When spawning executor agents for gap-closure plans, append the following to each agent prompt:

```
IMPORTANT: This is a fresh retry attempt. Do NOT reference or build upon any previous attempt's reasoning, code, or approach. Start from scratch using only the original task specification and current codebase state.
```

### 9.4 Re-verify

Spawn verifier again (step 8). Increment `attempt_count`.

If verification passes: proceed to step 9 completion.
If verification fails and attempts remain: loop to 9.1.

## 10. Checkpoint Before /clear

When context is filling up, checkpoint automatically:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## MAXSIM Checkpoint

Command: /maxsim:execute
Stage: {current_stage}
Plans completed: {completed_count}/{total_count}
Verification attempts: {attempt_count}/3
Resume from: {next_action}
Timestamp: {ISO timestamp}
<!-- maxsim:type=checkpoint -->
BODY_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type checkpoint
```

Display:
```
Context is filling up. Checkpoint saved to GitHub issue #{phase_issue_number}.

Re-run /maxsim:execute {phase_number} after /clear — completed plans (with closed task
sub-issues) are detected automatically and skipped on resume.
```

## 11. Update State and Complete

After verification passes, display final report:

```
## Phase {phase_number}: {phase_name} — Execution Complete

Plans: {completed}/{total} complete
Waves: {wave_count}
Verification: Passed (attempt {attempt_count}/3)
Phase issue: #{phase_issue_number} (closed)

### Plan Details
{For each plan: plan_id — one-liner from summary comment}

### Next Steps
- /maxsim:plan {next_phase} — Plan next phase
- /maxsim:progress — View overall progress
```

</process>

<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Executor model resolved via maxsim-tools resolve-model
- [ ] Plan inventory loaded exclusively from GitHub Issue comments
- [ ] External edit detection warns user before proceeding
- [ ] Execution state correctly detected from task sub-issue closure and summary comments
- [ ] Plan Mode (EnterPlanMode) entered before spawning any executors
- [ ] All wave agents spawned in a SINGLE message block with isolation="worktree" and run_in_background=true
- [ ] All spawned agents use the Agent tool (NOT Task)
- [ ] Spot-checks read GitHub comments and sub-issue status (not local files)
- [ ] Worktree branches follow `maxsim/phase-{N}-task-{id}` naming convention
- [ ] Worktree branches merged back to main sequentially after each wave
- [ ] Phase issue moved to "In Review" after all tasks complete (before verification)
- [ ] Phase issue moved to "Done" on verification pass
- [ ] Summaries posted as GitHub comments: <!-- maxsim:type=summary -->
- [ ] Verification results posted as GitHub comments: <!-- maxsim:type=verification -->
- [ ] Retry loop with gap closure (max 3 retries, 4 total attempts)
- [ ] git push after successful verification
- [ ] Checkpoint before /clear posts to GitHub issue
</success_criteria>
