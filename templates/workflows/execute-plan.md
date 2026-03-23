<purpose>
Template prompt for individual plan execution by a spawned executor agent. This file defines what each executor agent receives and must produce. It is self-contained — the executor has no access to the orchestrator's context and must work from what is explicitly provided here.

Executor agents run in isolated git worktrees. Each agent executes all tasks in one plan, commits atomically per task, updates the GitHub board, and posts a summary comment on the phase issue.
</purpose>

<agent_type>executor</agent_type>
<isolation>worktree</isolation>

<required_reading>
Read these files immediately upon start, before any other action:
- .planning/STATE.md — project state and position
- .planning/config.json — planning behavior settings (if exists)
- ./CLAUDE.md — project-specific coding conventions (if exists)
</required_reading>

<process>

## Step 1 — Load Context

Load execution context:

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init execute-phase "${PHASE_NUMBER}")
```

Extract: `phase_dir`, `phase_number`, `phase_name`, `executor_model`, `commit_docs`, `phase_issue_number`.

If `.planning/` is missing: exit immediately with `RESULT: FAIL — .planning/ directory not found`.

Record start time:
```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```

## Step 2 — Parse Plan Content

The plan content is provided in the orchestrator's prompt via `<plan_content>` and `<github_context>` blocks.

Parse from the plan content:
- **Plan ID** — e.g. `03-02`
- **Objective** — one-line description of what this plan builds
- **Wave** — wave number (for ordering context only)
- **Task list** — ordered list of tasks, each with: name, description, files to modify, acceptance criteria, done criteria
- **Success criteria** — overall plan success criteria
- **Task sub-issue numbers** — from `task_mappings` in github_context

Detect checkpoint type from plan content:
- No checkpoints → **Pattern A** (autonomous, single pass)
- Checkpoint markers present → **Pattern B** (segmented execution)

## Step 3 — Execute Tasks (Pattern A — Autonomous)

Execute all tasks in sequence. For each task:

### 3a — Announce task start

Move task sub-issue to "In Progress" on the board:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number {task_issue_number} --status "In Progress"
```

Display:
```
## Task {N}/{total}: {task_name}
Files: {files_to_modify}
```

### 3b — Implement task

Read all files listed in the task's `files_to_modify` list using the Read tool.

Implement the changes required by the task description and acceptance criteria.

Conventions (from CLAUDE.md if present, otherwise defaults):
- Follow existing code style and patterns
- No dead code, no placeholder comments
- All logic must be complete and functional (no TODOs)
- Handle errors explicitly
- Write tests if the task requires them or if the project has a test suite

### 3c — Verify before commit

Run tests relevant to the changed files:
```bash
# Detect and run test runner
if [ -f package.json ]; then
  # Check for test script
  node -e "const p=require('./package.json'); process.exit(p.scripts?.test ? 0 : 1)" && npm test 2>&1 | tail -20
fi
```

Check for anti-patterns in changed files:
- No `TODO`, `FIXME`, `XXX`, `HACK` comments introduced
- No placeholder content ("coming soon", "will be here")
- No stub functions (functions that only `console.log` or `return null`)
- No empty error handlers

If tests fail: diagnose and fix. Retry up to 2 times before reporting failure.

### 3d — Commit atomically

Stage only the specific files changed by this task (NEVER `git add .` or `git add -A`):

```bash
git add {specific_files_changed_by_this_task}
git commit -m "{type}({phase_number}-{plan_id}): {task_description_as_commit_message}"
TASK_COMMIT=$(git rev-parse HEAD)
```

Commit type conventions:
- `feat` — new feature or capability
- `fix` — bug fix
- `refactor` — code restructure without behavior change
- `test` — adding or updating tests
- `docs` — documentation only
- `chore` — tooling, config, dependencies

### 3e — Close task on board

Move task sub-issue to Done and close it:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number {task_issue_number} --status "Done"
node ~/.claude/maxsim/bin/maxsim-tools.cjs github close-issue \
  --issue-number {task_issue_number}
```

Record task result:
```
Task {N}: {task_name} — DONE
Commit: {TASK_COMMIT}
Files: {files_changed}
```

### 3f — Repeat for next task

Pass only the commit hash and files-modified list to the next task context. Do NOT carry forward full diffs or task agent conversations.

## Step 4 — Execute Tasks (Pattern B — Segmented)

For plans with checkpoint markers:

Execute each segment autonomously (tasks before the checkpoint). At each checkpoint:
- Pause and surface the checkpoint to the orchestrator
- Wait for orchestrator/user response before continuing
- Resume with user feedback as additional context

After all segments complete, aggregate results for the summary step.

## Step 5 — Self-Check

Before posting the summary, run self-verification:

```bash
# Verify key files from task list exist on disk
for file in {key_files_created_or_modified}; do
  [ -f "$file" ] && echo "EXISTS: $file" || echo "MISSING: $file"
done

# Verify commits exist for this plan
git log --oneline --all --grep="{phase_number}-{plan_id}" 2>/dev/null

# Verify all task sub-issues are closed
node ~/.claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues \
  --phase-issue-number {phase_issue_number}
```

Self-check result:
- All key files exist + all commits found + all sub-issues closed → `## Self-Check: PASSED`
- Any miss → `## Self-Check: FAILED — {reason}`

## Step 6 — Post Summary to GitHub

Build summary content and post as a comment on the phase issue.

The summary comment IS the completion record. No local SUMMARY.md file is written.

```bash
PLAN_END_EPOCH=$(date +%s)
PLAN_DURATION=$(( (PLAN_END_EPOCH - PLAN_START_EPOCH) / 60 ))m

SUMMARY_FILE=$(mktemp)
cat > "$SUMMARY_FILE" << 'SUMMARY_EOF'
---
phase: {phase_number}
plan: {plan_id}
objective: {objective}
wave: {wave_number}
completed: {ISO timestamp}
duration: {PLAN_DURATION}
key_files_created:
{list of files created}
key_files_modified:
{list of files modified}
key_decisions:
{list of any architectural decisions made during execution}
---

## {Plan ID}: {Objective}

{One-liner: substantive description of what was built and how it works}

## Task Execution

| Task | Name | Status | Commit | Notes |
|------|------|--------|--------|-------|
| 1 | {name} | PASS | {hash} | |
| 2 | {name} | PASS | {hash} | {deviation if any} |

## Deviations
{List any departures from the plan spec, with rationale. "None." if no deviations.}

## Issues Encountered
{List any problems hit during execution and how they were resolved. "None." if clean.}

{self_check_result}
<!-- maxsim:type=summary -->
SUMMARY_EOF

node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number {phase_issue_number} \
  --body-file "$SUMMARY_FILE" \
  --type summary
```

## Step 7 — Update State Files

```bash
# Advance plan counter
node ~/.claude/maxsim/bin/maxsim-tools.cjs state advance-plan

# Recalculate progress
node ~/.claude/maxsim/bin/maxsim-tools.cjs state update-progress

# Record session metrics
node ~/.claude/maxsim/bin/maxsim-tools.cjs state record-metric \
  --phase "{PHASE_NUMBER}" --plan "{PLAN_ID}" --duration "{PLAN_DURATION}" \
  --tasks "{TASK_COUNT}" --files "{FILE_COUNT}"

# Record session stop position
node ~/.claude/maxsim/bin/maxsim-tools.cjs state record-session \
  --stopped-at "Completed {PHASE_NUMBER}-{PLAN_ID} (execute-plan)" \
  --resume-file "None"

# Update roadmap progress
node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap update-plan-progress "{PHASE_NUMBER}"
```

Commit planning metadata (task code was already committed per-task):
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit \
  "docs({phase_number}-{plan_id}): complete plan execution" \
  --files .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

## Step 8 — Return Result

The final line of output MUST be exactly one of:
- `RESULT: PASS`
- `RESULT: FAIL — {specific reason}`

Do not add text after the RESULT line.

</process>

<verification_checklist>
Before returning RESULT: PASS, confirm ALL of the following:
- [ ] All tasks in the plan were executed
- [ ] Each task has exactly one atomic commit with a conventional commit message
- [ ] No task was committed with `git add .` or `git add -A`
- [ ] Tests were run and pass (or no test runner detected)
- [ ] No TODOs, stubs, or placeholder content introduced
- [ ] All task sub-issues are closed on GitHub
- [ ] Summary comment posted to phase issue with <!-- maxsim:type=summary -->
- [ ] Self-check ran and result appended to summary
- [ ] STATE.md and ROADMAP.md updated
</verification_checklist>

<failure_handling>
- **Task tests fail after 2 retries:** Diagnose root cause. If cannot fix, return `RESULT: FAIL — task {N} tests failing: {error}`
- **File cannot be found:** Check path relative to worktree root. If genuinely missing, create it as specified in the task.
- **Sub-issue board transition fails:** Log the error, continue execution. Include note in summary.
- **GitHub post-comment fails:** Retry once with exponential backoff. If still failing, write summary to `.planning/phases/{phase_dir}/{plan_id}-SUMMARY.md` as fallback and report error.
- **Commit fails (merge conflict):** You are in an isolated worktree. Conflicts indicate unexpected overlap. Report immediately: `RESULT: FAIL — merge conflict in worktree: {files}`
</failure_handling>

<success_criteria>
- [ ] Plan content parsed from GitHub context (not from local PLAN.md)
- [ ] External edit detection checked before execution begins
- [ ] All tasks executed in order
- [ ] Each task committed individually with conventional commit message
- [ ] Board transitions: In Progress when task starts, Done+closed when task completes
- [ ] Self-check ran and result recorded in summary
- [ ] Summary posted as GitHub comment (<!-- maxsim:type=summary -->) — no local SUMMARY.md written
- [ ] State files updated
- [ ] Final output line is exactly RESULT: PASS or RESULT: FAIL — {reason}
</success_criteria>
