<sanity_check>
Before executing any step in this workflow, verify:
1. The current directory contains a `.planning/` folder — if not, stop and tell the user to run `/maxsim:init` first.
2. `.planning/ROADMAP.md` exists — if not, stop and tell the user to initialize the project.
3. Git is initialized (`git rev-parse --git-dir` succeeds) — worktrees require a git repository.
</sanity_check>

<purpose>
Execute multiple independent tasks in parallel using the Agent tool. Each unit gets its own isolated git worktree, branch, and PR. Based on Anthropic's own /batch pattern: decompose → validate independence → spawn ALL agents in ONE message block → track → report.

Use this when you have 3+ tasks that share no files and have no runtime dependencies between them.
</purpose>

<process>

## Step 1 — Initialize

```bash
EXECUTOR_MODEL=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs resolve-model executor --raw)
PLANNER_MODEL=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs resolve-model planner --raw)
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init quick "$DESCRIPTION")
```

Parse JSON: `planner_model`, `executor_model`, `slug`, `date`, `timestamp`, `roadmap_exists`.

If `roadmap_exists` is false: error — batch mode requires an active project. Run `/maxsim:init` first.

Store base branch:
```bash
BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
```

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM > BATCH PARALLEL EXECUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task: {description from $ARGUMENTS}
Base branch: {BASE_BRANCH}
```

If `$ARGUMENTS` is empty, prompt: "Describe the large task to decompose into independent units."

## Step 2 — Decompose into Independent Units

Spawn planner to produce a decomposition:

```
Agent(
  subagent_type="planner",
  model="{planner_model}",
  prompt="
    <planning_context>
    Mode: batch
    Description: {description}
    Base branch: {BASE_BRANCH}

    Read these files:
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - ./CLAUDE.md (if exists — follow project guidelines)
    </planning_context>

    <constraints>
    Decompose into 3–30 independent units. Hard rules:
    - Each unit MUST be independently mergeable — no unit depends on another unit's output
    - No file may appear in more than one unit
    - No runtime dependency between units (unit A output must not be unit B input)
    - If fewer than 3 independent units can be identified, output: INSUFFICIENT UNITS — recommend /maxsim:quick instead
    - Each unit must have: title, description, files owned (exhaustive list), acceptance criteria
    </constraints>

    <output>
    Write decomposition to: .planning/batch/{slug}/DECOMPOSITION.md

    Format:
    ---
    task: {description}
    date: {date}
    base_branch: {BASE_BRANCH}
    unit_count: N
    status: pending
    ---

    ## Units

    ### Unit 1: {Title}
    **Description:** ...
    **Files owned:**
    - path/to/file1.ts
    **Acceptance criteria:**
    - [ ] Criterion 1

    ### Unit 2: {Title}
    ...

    ## Independence Matrix
    [For each pair of units: confirm no file overlap and no runtime dependency]

    Return: ## PLANNING COMPLETE — {N} units
    </output>
  "
)
```

After planner returns:
1. Verify `.planning/batch/{slug}/DECOMPOSITION.md` exists
2. Extract unit count
3. If `INSUFFICIENT UNITS`: warn and suggest `/maxsim:quick`. Ask: "Continue with batch ({N} units) or switch to quick?"
4. Report: "Decomposition complete: {N} units identified"

## Step 3 — Validate Independence

Read `DECOMPOSITION.md` and check file independence across all unit pairs.

For each pair (Unit A, Unit B): compute intersection of their file lists.

**If any overlap found:**

```
## Independence Validation Failed

| File | Unit A | Unit B |
|------|--------|--------|
| {path} | {Unit N: title} | {Unit M: title} |
```

Return to planner with revision prompt. Re-validate after revision. If validation fails a second time, stop and escalate to user.

**If validation passes:**
```
Independence validated: {N} units, no file overlap confirmed
```

Record decision:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs state add-decision \
  --phase "batch" \
  --summary "Batch decomposition: {N} units, independence validated"
```

## Step 4 — Plan Mode — Confirm Before Spawning

**Enter Plan Mode.** Display the full execution plan:

```
## Batch Execution Plan

Task: {description}
Units: {N} independent worktree agents
Base branch: {BASE_BRANCH}

| # | Unit | Files | Acceptance Criteria |
|---|------|-------|---------------------|
| 1 | {title} | {file count} | {criteria count} |
| 2 | {title} | {file count} | {criteria count} |

Each unit runs in isolation: own branch, own worktree, own PR.

Confirm to spawn all {N} agents? (yes/no)
```

Wait for user confirmation. **Exit Plan Mode after user confirms.**

## Step 5 — Spawn All Agents in ONE Message Block

All Agent calls are issued simultaneously in a single message. Every agent gets `isolation="worktree"` and `run_in_background=true`.

Display header:
```
## Spawning {N} Worktree Agents

| # | Unit | Status | Branch | PR |
|---|------|--------|--------|----|
```

For EACH unit (all in one message block):

```
Agent(
  subagent_type="executor",
  model="{executor_model}",
  isolation="worktree",
  run_in_background=true,
  prompt="
    You are implementing Unit {unit_number} of a batch parallel execution.
    You are running in an isolated git worktree with your own branch.

    <unit_spec>
    Title: {unit_title}
    Description: {unit_description}
    Base branch: {BASE_BRANCH}
    Branch name: batch/{slug}/unit-{unit_number}
    Files owned (ONLY touch these files — do not modify any others):
    {unit_files_list}
    Acceptance criteria:
    {unit_acceptance_criteria}
    </unit_spec>

    <files_to_read>
    - ./CLAUDE.md (if exists — follow project coding conventions)
    - .planning/STATE.md
    </files_to_read>

    <instructions>
    1. Create branch:
       git checkout -b batch/{slug}/unit-{unit_number}
    2. Read each file listed in Files owned to understand current state
    3. Implement the changes described in unit_description
    4. ONLY modify files listed in Files owned
    5. Run tests relevant to your changed files
    6. If tests fail: diagnose and fix. Retry up to 2 times.
    7. Commit with conventional commit message:
       git add {specific_files_only}
       git commit -m 'feat(batch/{slug}): {unit_title}'
    8. Push branch:
       git push -u origin batch/{slug}/unit-{unit_number}
    9. Create PR:
       gh pr create \\
         --title 'batch({slug}): {unit_title}' \\
         --body 'Unit {unit_number}: {unit_description}\n\nPart of batch: {description}\n\nAcceptance criteria:\n{unit_acceptance_criteria}'
    10. Return the PR URL
    </instructions>

    <codebase_conventions>
    - Follow existing code style and patterns in the files you modify
    - No dead code, TODOs, stubs, or placeholder comments
    - Handle errors explicitly
    - Stage specific files only — never git add . or git add -A
    </codebase_conventions>

    <output>
    Final output must be exactly one of:
    ## UNIT COMPLETE
    PR: {pr_url}

    ## UNIT FAILED
    Error: {specific error details}
    </output>
  ",
  description="Batch unit {unit_number}: {unit_title}"
)
```

## Step 6 — Track Progress

As agents complete, update the status table:

| # | Unit | Status | Branch | PR |
|---|------|--------|--------|----|
| 1 | {title} | done | batch/{slug}/unit-1 | #{pr_number} |
| 2 | {title} | in-progress | batch/{slug}/unit-2 | — |
| 3 | {title} | failed | batch/{slug}/unit-3 | — |

Statuses: `pending` → `in-progress` → `done` | `failed`

After each agent returns:
1. Parse output for `## UNIT COMPLETE` or `## UNIT FAILED`
2. Extract PR URL if complete
3. Update status table row
4. Print progress: "{done}/{total} units complete"

Wait for ALL agents to finish before proceeding.

## Step 7 — Handle Failures

For each failed unit, spawn a fix agent:

```
Agent(
  subagent_type="executor",
  model="{executor_model}",
  isolation="worktree",
  prompt="
    Unit {unit_number} ({unit_title}) failed with this error:
    {error_details}

    The worktree and branch may already exist. Check:
    git worktree list
    git checkout batch/{slug}/unit-{unit_number} 2>/dev/null || git checkout -b batch/{slug}/unit-{unit_number}

    Original unit spec:
    {unit_spec}

    Fix the failure. Diagnose the root cause before attempting changes.
    After fixing: test, commit, push, create PR.
    Return: ## UNIT COMPLETE\nPR: {url} or ## UNIT FAILED\nError: {details}
  ",
  description="Fix batch unit {unit_number}: {unit_title}"
)
```

**Merge conflict detected:** Decomposition had hidden overlap. Escalate to user:
```
Merge conflict in Unit {unit_number} ({unit_title}).
This suggests the decomposition missed a dependency.
Options:
1. Fix manually on branch batch/{slug}/unit-{unit_number}
2. Skip this unit
3. Abort remaining fix attempts
```

**3+ failures on same unit:** Stop retrying. Escalate:
```
## Unit {unit_number} Escalated

Unit "{unit_title}" failed 3+ times. Manual intervention required.
Branch: batch/{slug}/unit-{unit_number}
Error history:
{error_summaries}
```

## Step 8 — Final Report

After all units are resolved (complete or escalated):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM > BATCH EXECUTION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task: {description}
Units: {completed}/{total} complete

| # | Unit | Status | PR |
|---|------|--------|----|
{final_status_table}

{failed_count > 0 ? "Failed units require manual attention." : "All units completed."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Update STATE.md:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs state add-decision \
  --phase "batch" \
  --summary "Batch complete: {completed}/{total} units done. PRs: {pr_list}"
```

## Step 9 — Commit Batch Metadata

Update `DECOMPOSITION.md` status:
- All done: `status: complete`
- Some failed: `status: partial`

Write `.planning/batch/{slug}/RESULTS.md`:
```markdown
---
task: {description}
date: {date}
status: {complete | partial}
units_total: {N}
units_complete: {completed}
units_failed: {failed}
---

## Results

| # | Unit | Status | PR | Branch |
|---|------|--------|----|--------|
{results_table}

## Failed Units
{failed_summaries or "None."}
```

Commit metadata:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit \
  "docs(batch): {description}" \
  --files .planning/batch/{slug}/DECOMPOSITION.md \
          .planning/batch/{slug}/RESULTS.md \
          .planning/STATE.md
```

</process>

<success_criteria>
- [ ] .planning/ and git repository verified
- [ ] Decomposition produces 3+ independent units (or user confirms fewer)
- [ ] File independence validated across all unit pairs before spawning
- [ ] Plan Mode shown and confirmed before any agents spawned
- [ ] All agents spawned in a SINGLE message block using Agent tool (not Task)
- [ ] Every agent has isolation="worktree" and run_in_background=true
- [ ] Each agent creates its own branch and PR
- [ ] Progress tracked with live status table
- [ ] Failed units retried with fix agent (max 2 retries before escalation)
- [ ] Merge conflicts escalated to user immediately
- [ ] Final report lists all PRs and flags failures
- [ ] Batch metadata committed to .planning/batch/
</success_criteria>

<failure_handling>
- **Independence validation fails twice:** Present overlaps to user. Ask for manual decomposition guidance.
- **Agent fails to create PR:** Check `gh` CLI auth. If not authenticated, report branch name for manual PR creation.
- **All agents fail:** Likely systemic issue (git config, permissions, worktree limit). Stop and report for investigation.
- **Fewer than 3 independent units:** Suggest `/maxsim:quick`. Do not force worktree overhead for small tasks.
- **classifyHandoffIfNeeded error:** Claude Code runtime bug (not MAXSIM). Check if branch has commits. If commits exist, treat as success and extract PR URL from branch.
</failure_handling>
