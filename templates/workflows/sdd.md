<sanity_check>
Before executing any step in this workflow, verify:
1. The current directory contains a `.planning/` folder — if not, stop and tell the user to run `/maxsim:init` first.
2. `.planning/ROADMAP.md` exists — if not, stop and tell the user to initialize the project.
</sanity_check>

<purpose>
Execute phase plans sequentially using fresh-context subagents with mandatory 2-stage review between every task. Each task agent receives only the minimum context it needs. Review is a hard gate — no task starts until the previous task passes both review stages.
</purpose>

<core_principle>
Fresh context per task. No context bleeding between tasks. Review is mandatory, never skippable. Previous task's full diff and conversation are NEVER passed to the next task agent.
</core_principle>

<required_reading>
Read STATE.md before any operation to load project context.
</required_reading>

<process>

<step name="initialize" priority="first">
Reuse the execute-phase init to load phase directory, plans, and model configuration:

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init execute-phase "${PHASE_ARG}")
```

Parse JSON for: `executor_model`, `verifier_model`, `commit_docs`, `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`, `plans`, `incomplete_plans`, `plan_count`, `incomplete_count`, `state_exists`, `roadmap_exists`, `phase_req_ids`.

**If `phase_found` is false:** Error — phase directory not found.
**If `plan_count` is 0:** Error — no plans found in phase.
</step>

<step name="discover_plans">
Find incomplete plans by querying GitHub Issues (the source of truth for plans and completion status):

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue ${phase_issue_number} --include-comments
node ~/.claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues ${phase_issue_number}
```

Parse plan comments (`<!-- maxsim:type=plan -->`) from the phase issue. A plan is complete when all its task sub-issues are closed.

**Filtering:** Skip plans where all task sub-issues are closed. If all plans complete: "All plans in phase are already complete" — exit.

Report:
```
## SDD Execution Plan

**Phase {X}: {Name}** — {incomplete_count} plans to execute

| Plan | Tasks | Objective |
|------|-------|-----------|
| 01-01 | 5 | {from plan objective, 5-10 words} |
| 01-02 | 3 | ... |

**Mode:** Spec-Driven Dispatch — fresh agent per task, 2-stage review between tasks
```
</step>

<step name="load_plan">
For each incomplete plan, read the plan content from the GitHub Issue comment (loaded in discover_plans) and extract the ordered task list.

Extract for each task:
- **Task number** (sequential order in plan)
- **Task name**
- **Description** (what to implement)
- **Acceptance criteria** (done criteria from plan)
- **Relevant files** (files to read and/or modify)
- **Done criteria** (verification steps)

Store as structured task list for the dispatch loop.
</step>

<step name="dispatch_loop">
For each task in order within the current plan:

**4a — Assemble Context**

Build minimal context for the task agent. Include ONLY:
- Task description and acceptance criteria
- Relevant files list (files to read and modify)
- Previous task commit hashes and files modified (NOT full diffs, NOT previous agent conversations)
- Project CLAUDE.md (if exists) for coding conventions
- .skills/ SKILL.md files (if exist) for relevant project rules

Context table (SDD principle):
| Item | Include? |
|------|----------|
| Task description + acceptance criteria | ALWAYS |
| Relevant files list | ALWAYS |
| Project CLAUDE.md | ALWAYS (if exists) |
| Previous task commit hash + files modified | YES (minimal summary only) |
| Previous task full diff | NEVER |
| Previous agent conversation | NEVER |
| Full plan file | NO (only current task extracted) |

**4b — Spawn Executor**

Fresh executor agent with minimal context:

```
Task(
  subagent_type="executor",
  model="{executor_model}",
  prompt="
    <objective>
    Execute task {task_number} of plan {plan_id} in phase {phase_number}-{phase_name}.
    Commit atomically when done.
    </objective>

    <task>
    Name: {task_name}
    Description: {task_description}
    Acceptance criteria: {acceptance_criteria}
    Done criteria: {done_criteria}
    </task>

    <files_to_read>
    Read these files at execution start using the Read tool:
    - {relevant_files list}
    - ./CLAUDE.md (Project instructions, if exists — follow coding conventions)
    - .skills/ (Project skills, if exists — read SKILL.md for each, follow relevant rules)
    </files_to_read>

    <previous_task_context>
    {If first task: 'This is the first task in the plan.'}
    {If not first: 'Previous task committed as {commit_hash}. Files modified: {file_list}. Do NOT re-read or re-implement previous work.'}
    </previous_task_context>

    <commit_protocol>
    After implementation:
    1. Run tests relevant to changed files
    2. Stage files individually (NEVER git add . or git add -A)
    3. Commit: {type}({phase}-{plan}): {description}
    4. Report: commit hash, files modified, tests run
    </commit_protocol>

    <success_criteria>
    - [ ] All acceptance criteria met
    - [ ] Done criteria verified
    - [ ] Tests pass
    - [ ] Atomic commit created
    </success_criteria>
  "
)
```

Record the commit hash from the executor's output.

**4c — Review Stage 1: Spec Compliance**

Spawn verifier to check implementation matches task spec:

```
Task(
  subagent_type="verifier",
  model="{executor_model}",
  prompt="
    ## Task: Review for spec compliance

    ## Suggested Skills: verification-gates, evidence-collection

    <objective>
    Review task {task_number} of plan {plan_id} for spec compliance.
    </objective>

    <task_spec>
    Name: {task_name}
    Description: {task_description}
    Acceptance criteria: {acceptance_criteria}
    Done criteria: {done_criteria}
    Relevant files: {relevant_files}
    </task_spec>

    <commit>
    Commit hash: {task_commit_hash}
    </commit>

    <instructions>
    1. Read each file in the relevant files list
    2. Verify every acceptance criterion is met in the implementation
    3. Verify done criteria pass
    4. Check that ONLY specified files were modified (run: git diff --name-only {task_commit_hash}^..{task_commit_hash})
    5. Report verdict: PASS or FAIL
    6. If FAIL: list each unmet criterion with specific details
    </instructions>
  "
)
```

**4d — Review Stage 2: Code Quality**

Spawn verifier to check for bugs, edge cases, and conventions:

```
Task(
  subagent_type="verifier",
  model="{executor_model}",
  prompt="
    ## Task: Review for code quality

    ## Suggested Skills: code-review

    <objective>
    Review task {task_number} of plan {plan_id} for code quality.
    Spec compliance already verified.
    </objective>

    <commit>
    Commit hash: {task_commit_hash}
    Files modified: {files_from_commit}
    </commit>

    <instructions>
    1. Read CLAUDE.md for project conventions
    2. Read each modified file
    3. Check for: bugs, unhandled edge cases, missing error handling, convention violations, security issues
    4. Categorize: BLOCKER (must fix) or ADVISORY (note for later)
    5. Report verdict: PASS (no blockers) or FAIL (list blocking issues)
    </instructions>
  "
)
```

**4e — Handle Failure**

If EITHER review stage returns FAIL:

1. Spawn a NEW fresh executor agent with:
   - Original task spec (description + acceptance criteria)
   - Review feedback (specific failures from reviewer)
   - Current file state (files to read, NOT previous agent conversation)
   - Instruction: fix ONLY the review issues, do NOT add new features

```
Task(
  subagent_type="executor",
  model="{executor_model}",
  prompt="
    <objective>
    Fix review failures for task {task_number} of plan {plan_id}.
    Fix ONLY the issues listed below. Do NOT add new features or refactor beyond what is required.
    </objective>

    <original_task>
    Name: {task_name}
    Description: {task_description}
    Acceptance criteria: {acceptance_criteria}
    </original_task>

    <review_failures>
    {spec_review_failures if any}
    {code_review_failures if any}
    </review_failures>

    <files_to_read>
    {files modified by previous attempt — read current state}
    </files_to_read>

    <commit_protocol>
    Stage and commit fixes: fix({phase}-{plan}): address review feedback for task {task_number}
    </commit_protocol>
  "
)
```

2. Re-run BOTH review stages (4c and 4d) on the fix commit
3. **Cap at 3 fix attempts.** If still failing after 3 attempts: STOP and escalate to user.

```
## TASK BLOCKED — Review Failed After 3 Fix Attempts

**Task:** {task_number} - {task_name}
**Plan:** {plan_id}
**Phase:** {phase_number} - {phase_name}

### Unresolved Review Failures
{remaining failures from last review}

### Fix Attempt History
| Attempt | Spec Review | Code Review | Commit |
|---------|-------------|-------------|--------|
| 1 | {PASS/FAIL} | {PASS/FAIL} | {hash} |
| 2 | {PASS/FAIL} | {PASS/FAIL} | {hash} |
| 3 | {PASS/FAIL} | {PASS/FAIL} | {hash} |

Options:
- "fix manually" — You fix the issues, then resume
- "skip task" — Mark incomplete, continue to next task
- "stop" — Halt SDD execution
```

**4f — Advance**

After both reviews PASS, record task completion:
- Commit hash
- Files modified

Pass ONLY this minimal summary to the next task context. Do NOT pass:
- Full diff output
- Review conversation content
- Previous agent's reasoning or approach

**4g — Report Task**

Display task completion:

```
---
## Task {N}/{total}: {task_name} — COMPLETE

**Commit:** {commit_hash}
**Files:** {files_modified_count} modified
**Spec Review:** PASS
**Code Review:** PASS
{If fix iterations > 0: **Fix Iterations:** {count}}

{If more tasks: Dispatching next task...}
---
```
</step>

<step name="create_summary">
After all tasks in a plan complete, build the summary content in memory and post it as a GitHub comment on the phase issue. Include:

**Frontmatter:** phase, plan, subsystem, tags, requires/provides/affects, tech-stack, key-files.created/modified, key-decisions, requirements-completed (copy from PLAN.md frontmatter), duration, completed date.

**Body:**
- One-liner: substantive description of what was built
- Per-task status table:

```markdown
## Task Execution (SDD)

| Task | Name | Status | Commit | Fix Iterations |
|------|------|--------|--------|----------------|
| 1 | {name} | PASS | {hash} | 0 |
| 2 | {name} | PASS | {hash} | 1 |
| 3 | {name} | PASS | {hash} | 0 |

**Execution mode:** Spec-Driven Dispatch (fresh agent per task, 2-stage review)
```

- Review summary per task
- Deviations (if any)
- Issues encountered

Post summary to GitHub:
```bash
# Write summary content to tmpfile
SUMMARY_FILE=$(mktemp)
cat > "$SUMMARY_FILE" << 'SUMMARY_EOF'
{summary_content}
SUMMARY_EOF

node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number ${phase_issue_number} --body-file "$SUMMARY_FILE" --type summary
```

Self-check:
- Verify first 2 files from `key-files.created` exist on disk
- Check `git log --oneline --all --grep="{phase}-{plan}"` returns commits
- Append `## Self-Check: PASSED` or `## Self-Check: FAILED` to summary content before posting
</step>

<step name="update_state">
Standard state updates after plan completion:

```bash
# Advance plan counter
node ~/.claude/maxsim/bin/maxsim-tools.cjs state advance-plan

# Recalculate progress
node ~/.claude/maxsim/bin/maxsim-tools.cjs state update-progress

# Record execution metrics
node ~/.claude/maxsim/bin/maxsim-tools.cjs state record-metric \
  --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}" \
  --tasks "${TASK_COUNT}" --files "${FILE_COUNT}"

# Record session
node ~/.claude/maxsim/bin/maxsim-tools.cjs state record-session \
  --stopped-at "Completed ${PHASE}-${PLAN}-PLAN.md (SDD)" \
  --resume-file "None"

# Update roadmap progress
node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap update-plan-progress "${PHASE}"

# Mark requirements complete (if plan has requirements field)
node ~/.claude/maxsim/bin/maxsim-tools.cjs requirements mark-complete ${REQ_IDS}
```
</step>

<step name="git_commit_metadata">
Task code already committed per-task. Commit planning artifacts:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs({phase}-{plan}): complete SDD execution" --files .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

Note: No local SUMMARY.md is committed -- summary was posted to GitHub as a comment.
</step>

<step name="offer_next">
After all plans in the phase are processed:

Check completion by querying the phase issue's task sub-issues:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues ${phase_issue_number}
```

Count open vs closed sub-issues to determine completion.

| Condition | Route | Action |
|-----------|-------|--------|
| open sub-issues remain | **A: More plans** | Find next incomplete plan (by open sub-issues). Show next plan, suggest `/maxsim:execute {phase}` (SDD mode) to continue. |
| all sub-issues closed, more phases exist | **B: Phase done** | Show completion, suggest `/maxsim:execute {phase}` (verification) then `/maxsim:plan {next}`. |
| all sub-issues closed, last phase | **C: Milestone done** | Show banner, suggest `/maxsim:progress` (milestone completion) + `/maxsim:execute` (verification). |

All routes: recommend `/clear` first for fresh context.
</step>

</process>

<failure_handling>
- **Task agent fails (no commit):** Report failure, ask user: retry task or skip
- **Review agent fails to return verdict:** Treat as FAIL, re-run review
- **3 fix attempts exhausted:** Hard stop on task, escalate to user with full history
- **classifyHandoffIfNeeded bug:** If agent reports "failed" with `classifyHandoffIfNeeded is not defined` — Claude Code runtime bug. Spot-check (commit exists, files modified) — if pass, treat as success
- **All tasks in plan blocked:** Stop plan, report to user, suggest manual intervention
</failure_handling>

<resumption>
Re-run `/maxsim:execute {phase}` (SDD mode) — discover_plans queries GitHub for task sub-issue status, skips plans with all sub-issues closed, resumes from first incomplete plan. Within a plan, completed tasks (those with commits matching the plan pattern) can be detected and skipped.
</resumption>
