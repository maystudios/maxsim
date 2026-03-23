<sanity_check>
Before executing any step in this workflow, verify:
1. The current directory contains a `.planning/` folder — if not, stop and tell the user to run `/maxsim:init` first.
2. `.planning/ROADMAP.md` exists — if not, stop and tell the user to initialize the project.
</sanity_check>

<purpose>
Spec-Driven Dispatch: fresh-agent-per-task execution for maximum context isolation. Each task gets a new executor agent with only the minimum context it needs. After each task, two reviewer agents check spec compliance and code quality. Review is a hard gate — the next task never starts until the current task passes both reviews. Max 3 fix attempts per task before escalation.

GitHub Issues is the SOLE source of truth for plan content, task status, and completion.
</purpose>

<core_principle>
Fresh context per task. No context bleeding between tasks. Review is mandatory and never skippable. Previous task diffs and agent conversations are NEVER passed to subsequent agents.
</core_principle>

<process>

## Step 1 — Initialize

```bash
EXECUTOR_MODEL=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs resolve-model executor --raw)
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init execute-phase "${PHASE_ARG}")
```

Parse JSON: `executor_model`, `verifier_model`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_issue_number`, `plan_count`, `incomplete_count`.

If `phase_found` is false: error — phase not found.
If `plan_count` is 0: error — no plans found. Run `/maxsim:plan {phase}` first.

## Step 2 — Load Plans from GitHub Issues

GitHub Issues is the sole source of truth. Fetch phase issue and its plan comments:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments

node ~/.claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues \
  --phase-issue-number $PHASE_ISSUE_NUMBER
```

Parse plan comments (`<!-- maxsim:type=plan -->`). A plan is complete when all its task sub-issues are closed.

Skip plans where all task sub-issues are closed (resume support).

If all plans are complete: exit with "All plans in phase are already complete."

Report:
```
## SDD Execution Plan

Phase {phase_number}: {phase_name} — {incomplete_count} plans to execute

| Plan | Tasks | Objective |
|------|-------|-----------|
| {plan_id} | {task_count} | {objective, 5-10 words} |

Mode: Spec-Driven Dispatch — fresh agent per task, 2-stage review gate between tasks
```

## Step 3 — Dispatch Loop

For each incomplete plan, execute all tasks in sequence.

### Step 3a — Parse plan tasks

From the plan comment body, extract an ordered task list. For each task:
- Task number
- Task name
- Description
- Files to read and/or modify
- Acceptance criteria
- Done criteria

### Step 3b — For each task: Assemble minimal context

Build the minimum context for this task executor. Include ONLY:

| Item | Include? |
|------|----------|
| Task description + acceptance criteria | ALWAYS |
| Files to read and modify | ALWAYS |
| Project CLAUDE.md | ALWAYS (if exists) |
| Previous task commit hash + files modified | YES — minimal summary only |
| Previous task full diff | NEVER |
| Previous agent conversation | NEVER |
| Full plan content | NO — only current task extracted |

### Step 3c — Spawn executor (fresh agent per task)

```
Agent(
  subagent_type="executor",
  model="{executor_model}",
  isolation="worktree",
  prompt="
    You are executing a single task in a Spec-Driven Dispatch workflow.
    You receive only the context for THIS task. Do not ask about other tasks.

    <objective>
    Execute task {task_number} of plan {plan_id} in phase {phase_number}: {phase_name}.
    Commit atomically when complete.
    Move the task sub-issue on the board: In Progress when starting, Done when complete.
    </objective>

    <task>
    Name: {task_name}
    Description: {task_description}
    Acceptance criteria:
    {acceptance_criteria}
    Done criteria:
    {done_criteria}
    </task>

    <files_to_read>
    Read these files at execution start:
    {relevant_files_list}
    - ./CLAUDE.md (if exists — follow coding conventions)
    - .skills/ (if exists — read SKILL.md for each relevant skill)
    </files_to_read>

    <previous_task_context>
    {If first task: 'This is the first task in the plan.'}
    {If not first: 'Previous task: {task_name}, commit: {commit_hash}, files modified: {file_list}. Do NOT re-read or re-implement previous work.'}
    </previous_task_context>

    <board_transition>
    Task sub-issue number: {task_issue_number}
    Mark In Progress when starting:
      node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number {task_issue_number} --status 'In Progress'
    Mark Done when complete (before committing):
      node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number {task_issue_number} --status 'Done'
      node ~/.claude/maxsim/bin/maxsim-tools.cjs github close-issue --issue-number {task_issue_number}
    </board_transition>

    <commit_protocol>
    After implementation:
    1. Run tests relevant to changed files
    2. Stage specific files only (NEVER git add . or git add -A)
    3. Commit: {type}({phase_number}-{plan_id}): {task_description_as_message}
    4. Report exactly: COMMIT: {hash} | FILES: {comma-separated list}
    </commit_protocol>

    <success_criteria>
    - [ ] All acceptance criteria met
    - [ ] Done criteria verified
    - [ ] Tests pass
    - [ ] Task sub-issue marked In Progress then Done and closed
    - [ ] Atomic commit created
    - [ ] Final output includes: COMMIT: {hash} | FILES: {list}
    </success_criteria>
  "
)
```

Record the commit hash from executor output.

### Step 3d — Review Stage 1: Spec Compliance

Spawn reviewer immediately after executor completes (foreground, no worktree):

```
Agent(
  subagent_type="verifier",
  model="{executor_model}",
  prompt="
    Review task {task_number} of plan {plan_id} for SPEC COMPLIANCE.

    <task_spec>
    Name: {task_name}
    Description: {task_description}
    Acceptance criteria: {acceptance_criteria}
    Done criteria: {done_criteria}
    Files to modify: {relevant_files}
    </task_spec>

    <commit>
    Commit hash: {task_commit_hash}
    </commit>

    Instructions:
    1. Read each file in the relevant files list
    2. Run: git diff --name-only {task_commit_hash}^..{task_commit_hash}
    3. Verify every acceptance criterion is met in the implementation
    4. Verify done criteria pass
    5. Verify ONLY the specified files were modified (no extra files)
    6. If FAIL: list each unmet criterion with specific file:line evidence

    Evidence format (use for each criterion):
    CLAIM: {criterion text}
    EVIDENCE: {file:line or command run}
    OUTPUT: {what was found}
    VERDICT: PASS | FAIL — {reason if fail}

    Final line must be exactly:
    SPEC REVIEW: PASS or SPEC REVIEW: FAIL — {unmet criteria list}
  "
)
```

### Step 3e — Review Stage 2: Code Quality

Spawn second reviewer in parallel with stage 1 or immediately after (foreground, no worktree):

```
Agent(
  subagent_type="verifier",
  model="{executor_model}",
  prompt="
    Review task {task_number} of plan {plan_id} for CODE QUALITY.
    Spec compliance is being checked separately.

    <commit>
    Commit hash: {task_commit_hash}
    Files modified: {files_from_commit}
    </commit>

    Instructions:
    1. Read ./CLAUDE.md for project conventions (if exists)
    2. Read each modified file
    3. Check for BLOCKERS:
       - Bugs or logical errors
       - Unhandled error paths
       - Missing error handling for I/O or network calls
       - Security issues (unsanitized input, exposed secrets)
       - Convention violations (from CLAUDE.md)
    4. Check for ADVISORIES:
       - Minor style inconsistencies
       - Missing edge case handling (non-critical)
       - Optimization opportunities

    Evidence format:
    CLAIM: {what was checked}
    EVIDENCE: {file:line}
    OUTPUT: {what was found}
    VERDICT: PASS | FAIL — BLOCKER: {reason}

    Final line must be exactly:
    CODE REVIEW: PASS or CODE REVIEW: FAIL — {blocker list}
  "
)
```

### Step 3f — Handle Review Failure (Max 3 Fix Attempts)

If EITHER review returns FAIL:

Spawn a fresh fix executor with only what is needed:

```
Agent(
  subagent_type="executor",
  model="{executor_model}",
  isolation="worktree",
  prompt="
    Fix review failures for task {task_number} of plan {plan_id}.
    Fix ONLY the issues listed. Do NOT add features or refactor beyond what is required.

    <original_task>
    Name: {task_name}
    Acceptance criteria: {acceptance_criteria}
    </original_task>

    <review_failures>
    {spec_failures if any — each as: CRITERION: {text} | VERDICT: FAIL — {reason}}
    {code_failures if any — each as: BLOCKER: {description} | EVIDENCE: {file:line}}
    </review_failures>

    <files_to_read>
    {files modified by failed attempt — read current state from disk}
    </files_to_read>

    Instructions:
    1. Read each file in files_to_read to see current state
    2. Fix each listed issue precisely
    3. Run tests after fixing
    4. Commit: fix({phase_number}-{plan_id}): address review feedback for task {task_number}
    5. Report: COMMIT: {hash} | FILES: {list}
  "
)
```

Re-run BOTH review stages (3d and 3e) on the fix commit.

**Cap at 3 fix attempts total.** If still failing after 3 attempts, hard-stop and escalate:

```
## TASK BLOCKED — Review Failed After 3 Fix Attempts

Task: {task_number} — {task_name}
Plan: {plan_id}
Phase: {phase_number}: {phase_name}

### Unresolved Failures
{remaining spec failures}
{remaining code blockers}

### Fix Attempt History
| Attempt | Spec Review | Code Review | Commit |
|---------|-------------|-------------|--------|
| 1 | {PASS/FAIL} | {PASS/FAIL} | {hash} |
| 2 | {PASS/FAIL} | {PASS/FAIL} | {hash} |
| 3 | {PASS/FAIL} | {PASS/FAIL} | {hash} |

Options:
- "fix manually" — fix issues yourself, then type "resume" to continue
- "skip task" — mark incomplete, continue to next task
- "stop" — halt SDD execution
```

### Step 3g — Advance to next task

After both reviews PASS:
- Record commit hash and files-modified list
- Pass ONLY this minimal summary to the next task's `previous_task_context`
- Do NOT pass diffs, review content, or agent reasoning

Display task completion:
```
---
## Task {N}/{total}: {task_name} — COMPLETE

Commit: {commit_hash}
Files modified: {count}
Spec Review: PASS
Code Review: PASS
{If fix_iterations > 0: Fix iterations: {count}}

{If more tasks remain: Dispatching task {N+1}...}
---
```

Repeat step 3b–3g for the next task.

## Step 4 — Post Plan Summary to GitHub

After all tasks in a plan complete, post a summary comment on the phase issue:

```bash
SUMMARY_FILE=$(mktemp)
cat > "$SUMMARY_FILE" << 'SUMMARY_EOF'
---
phase: {phase_number}
plan: {plan_id}
execution_mode: sdd
completed: {ISO timestamp}
---

## {Plan ID}: {Objective}

{One-liner: substantive description of what was built}

## Task Execution (SDD)

| Task | Name | Status | Commit | Fix Iterations |
|------|------|--------|--------|----------------|
| 1 | {name} | PASS | {hash} | {count} |
| 2 | {name} | PASS | {hash} | 0 |

**Execution mode:** Spec-Driven Dispatch — fresh agent per task, 2-stage review gate

## Deviations
{List any departures from plan spec with rationale. "None." if clean.}

## Issues Encountered
{List problems and resolutions. "None." if clean.}

## Self-Check
{Verify first 2 created files exist: [ -f {file} ]}
{Verify commits: git log --oneline --all --grep="{phase_number}-{plan_id}"}
## Self-Check: PASSED | ## Self-Check: FAILED — {reason}

<!-- maxsim:type=summary -->
SUMMARY_EOF

node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number {phase_issue_number} \
  --body-file "$SUMMARY_FILE" \
  --type summary
```

## Step 5 — Update State Files

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs state advance-plan
node ~/.claude/maxsim/bin/maxsim-tools.cjs state update-progress
node ~/.claude/maxsim/bin/maxsim-tools.cjs state record-session \
  --stopped-at "Completed {phase_number}-{plan_id} (SDD)" \
  --resume-file "None"
node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap update-plan-progress "{phase_number}"

# Task code committed per-task; commit only planning artifacts
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit \
  "docs({phase_number}-{plan_id}): complete SDD execution" \
  --files .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

## Step 6 — Completion Check and Next Steps

After all plans are processed:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues \
  --phase-issue-number $PHASE_ISSUE_NUMBER
```

| Condition | Action |
|-----------|--------|
| Open sub-issues remain | Suggest `/maxsim:execute {phase}` (SDD mode) to continue |
| All sub-issues closed, more phases exist | Suggest `/maxsim:execute {phase}` (verification) then `/maxsim:plan {next}` |
| All sub-issues closed, last phase | Show completion banner, suggest `/maxsim:progress` |

Always recommend `/clear` before continuing to next phase.

</process>

<success_criteria>
- [ ] Plan content loaded from GitHub Issue comments (not local PLAN.md)
- [ ] Plans with all closed task sub-issues skipped (resume support)
- [ ] Each task gets a FRESH executor agent with minimal context (no diff bleed)
- [ ] Previous task context is commit hash + files only (never full diff)
- [ ] Each executor uses isolation="worktree" and the Agent tool (not Task)
- [ ] Task sub-issues moved: In Progress when starting, Done+closed when complete
- [ ] Spec compliance review spawned after each executor
- [ ] Code quality review spawned after each executor
- [ ] Both reviews must PASS before next task starts (hard gate)
- [ ] Fix agents cap at 3 attempts before escalation to user
- [ ] Summary posted as GitHub comment: <!-- maxsim:type=summary -->
- [ ] No local SUMMARY.md written
- [ ] State files updated after each plan completes
</success_criteria>

<failure_handling>
- **Executor returns no commit:** Ask user — retry task or skip
- **Review agent fails to return PASS/FAIL line:** Treat as FAIL, re-run review
- **3 fix attempts exhausted:** Hard stop on task, present full failure history to user
- **classifyHandoffIfNeeded error:** Claude Code runtime bug. Check if commit exists. If yes, treat as success and extract hash from git log.
- **All tasks in a plan blocked:** Stop plan, report to user, suggest manual intervention
- **GitHub sub-issue transition fails:** Log error, continue execution, note in summary
</failure_handling>

<resumption>
Re-run `/maxsim:execute {phase}` — load_plans queries GitHub for task sub-issue status, skips plans with all sub-issues closed. Within a plan, completed tasks (commits matching `{phase}-{plan}` grep) can be detected and skipped if needed.
</resumption>
