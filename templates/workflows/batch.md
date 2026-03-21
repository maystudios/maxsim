<sanity_check>
Before executing any step in this workflow, verify:
1. The current directory contains a `.planning/` folder — if not, stop and tell the user to run `/maxsim:init` first.
2. Git is initialized (`git rev-parse --git-dir` succeeds) — worktrees require a git repository.
3. `.planning/ROADMAP.md` exists — if not, stop and tell the user to initialize the project.
</sanity_check>

<purpose>
Decompose a large task into independent units, execute each in an isolated git worktree, and produce one PR per unit. Each unit gets its own branch, worktree, and PR — enabling parallel implementation with zero merge conflicts.

Follows the maxsim-batch skill process: Research (decompose) -> Plan (validate independence) -> Spawn (worktree agents) -> Track (progress and failures).
</purpose>

<required_reading>
Read all files referenced by the invoking prompt's execution_context before starting.
</required_reading>

<process>

<step name="initialize" priority="first">
Load context in one call:

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init quick "$DESCRIPTION")
```

Parse JSON for: `planner_model`, `executor_model`, `slug`, `date`, `timestamp`, `roadmap_exists`, `planning_exists`.

**If `roadmap_exists` is false:** Error — Batch mode requires an active project with ROADMAP.md. Run `/maxsim:init` first.

Verify git is available:
```bash
git rev-parse --git-dir > /dev/null 2>&1 || echo "ERROR: Not a git repository"
```

Store `BASE_BRANCH`:
```bash
BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD)
```
</step>

<step name="gather_task">
Parse `$ARGUMENTS` for the task description.

If `$ARGUMENTS` is empty, prompt user interactively:

```
AskUserQuestion(
  header: "Batch Task",
  question: "Describe the large task to decompose into independent worktree units.",
  followUp: null
)
```

Store response as `$DESCRIPTION`.

If still empty, re-prompt: "Please provide a task description."

Display banner:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM > BATCH WORKTREE EXECUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 Task: ${DESCRIPTION}
 Base branch: ${BASE_BRANCH}
```
</step>

<step name="decompose">
Spawn planner with batch-specific prompt to produce a decomposition:

```
Task(
  prompt="
<planning_context>

**Mode:** batch
**Description:** ${DESCRIPTION}
**Base branch:** ${BASE_BRANCH}

<files_to_read>
- .planning/STATE.md (Project State)
- .planning/ROADMAP.md (Phase structure)
- ./CLAUDE.md (if exists — follow project-specific guidelines)
- .skills/maxsim-batch/SKILL.md (if exists — maxsim-batch constraints)
</files_to_read>

**Project skills:** Check .skills/ directory (if exists) — read SKILL.md files, plans should account for project skill rules

</planning_context>

<constraints>
- Decompose into 3-30 independent units
- Each unit MUST be independently mergeable (hard gate from maxsim-batch skill)
- If fewer than 3 units are identified, STOP and recommend /maxsim:quick instead
- No file may appear in more than one unit
- No runtime dependency between units (unit A output must not be unit B input)
- Each unit must have: title, description, files owned, acceptance criteria
</constraints>

<output>
Write decomposition to: .planning/batch/${slug}/DECOMPOSITION.md

Format:
---
task: ${DESCRIPTION}
date: ${date}
base_branch: ${BASE_BRANCH}
unit_count: N
status: pending
---

## Units

### Unit 1: [Title]
**Description:** ...
**Files owned:**
- path/to/file1.ts
- path/to/file2.ts
**Acceptance criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

### Unit 2: [Title]
...

## Independence Matrix
[For each pair of units, confirm no file overlap and no runtime dependency]

Return: ## PLANNING COMPLETE with unit count and decomposition path
</output>
",
  subagent_type="planner",
  model="{planner_model}",
  description="Batch decomposition: ${DESCRIPTION}"
)
```

After planner returns:
1. Verify decomposition exists at `.planning/batch/${slug}/DECOMPOSITION.md`
2. Extract unit count
3. If unit count < 3: warn user and suggest `/maxsim:quick` instead. Ask: "Continue with batch (${unit_count} units) or switch to quick mode?"
4. Report: "Decomposition complete: ${unit_count} units identified"

If decomposition not found, error: "Planner failed to create DECOMPOSITION.md"
</step>

<step name="validate_independence">
Read the DECOMPOSITION.md and validate file independence across all units.

For each pair of units:
1. Extract the files owned by each unit
2. Compute the intersection
3. If any file appears in more than one unit, the validation fails

**If validation fails:**

Report the overlapping files and which units conflict:
```
## Independence Validation Failed

| File | Unit A | Unit B |
|------|--------|--------|
| path/to/file.ts | Unit 1: Title | Unit 3: Title |
```

Return to planner with revision prompt:
```
Task(
  prompt="
<revision_context>

<files_to_read>
- .planning/batch/${slug}/DECOMPOSITION.md (Existing decomposition)
</files_to_read>

**Independence validation failed.** The following files appear in multiple units:
${overlap_table}

Options:
1. Merge overlapping units into one
2. Extract shared files into a prerequisite unit that runs first
3. Redesign the split so each file belongs to exactly one unit

Revise DECOMPOSITION.md to resolve all overlaps.
</revision_context>
",
  subagent_type="planner",
  model="{planner_model}",
  description="Revise batch decomposition: fix overlaps"
)
```

Re-validate after revision. If validation fails a second time, stop and escalate to user.

**If validation passes:**

```
Independence validated: ${unit_count} units, no file overlap
```
</step>

<step name="record_decision">
Record the decomposition decision in STATE.md:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs state add-decision --phase "batch" --summary "Batch decomposition: ${unit_count} units, no file overlap confirmed"
```
</step>

<step name="spawn_worktree_agents">
For each unit in the decomposition, spawn a worktree agent.

Display progress table header:
```
## Spawning Worktree Agents

| # | Unit | Status | PR |
|---|------|--------|----|
```

For each unit (spawn all with `run_in_background: true` for parallel execution):

```
Task(
  subagent_type="executor",
  model="{executor_model}",
  isolation="worktree",
  run_in_background=true,
  prompt="
You are implementing Unit ${unit_number} of a batch worktree execution.

<unit_spec>
**Title:** ${unit_title}
**Description:** ${unit_description}
**Base branch:** ${BASE_BRANCH}
**Branch name:** batch/${slug}/unit-${unit_number}
**Files owned (ONLY touch these files):**
${unit_files}
**Acceptance criteria:**
${unit_criteria}
</unit_spec>

<files_to_read>
- ./CLAUDE.md (if exists — follow project-specific guidelines)
- .planning/STATE.md (Project state)
- .skills/ (if exists — list skills, read SKILL.md for each, follow relevant rules)
</files_to_read>

<instructions>
1. Create branch: git checkout -b batch/${slug}/unit-${unit_number}
2. Implement the changes described in the unit spec
3. ONLY modify files listed in 'Files owned' — do not touch any other files
4. Run tests relevant to your changes
5. Commit atomically with message: feat(batch): ${unit_title}
6. Push branch: git push -u origin batch/${slug}/unit-${unit_number}
7. Create PR: gh pr create --title 'batch(${slug}): ${unit_title}' --body '## Unit ${unit_number}: ${unit_title}\n\n${unit_description}\n\nPart of batch: ${DESCRIPTION}'
8. Return the PR URL

If tests fail, fix and retry. If you cannot fix after 2 attempts, report failure with error details.
</instructions>

<output>
Return one of:
- ## UNIT COMPLETE\nPR: <url>
- ## UNIT FAILED\nError: <details>
</output>
",
  description="Batch unit ${unit_number}: ${unit_title}"
)
```
</step>

<step name="track_progress">
As agents complete, update the status table:

| # | Unit | Status | PR |
|---|------|--------|----|
| 1 | title | done | #123 |
| 2 | title | in-progress | -- |
| 3 | title | failed | -- |

Statuses: `pending`, `in-progress`, `done`, `failed`

After each agent returns:
1. Parse output for `## UNIT COMPLETE` or `## UNIT FAILED`
2. Extract PR URL if complete
3. Update status table
4. Report progress: "${completed}/${unit_count} units complete"

Wait for all agents to finish before proceeding.
</step>

<step name="handle_failures">
For each failed unit:

**Attempt 1 — spawn fix agent:**
```
Task(
  subagent_type="executor",
  model="{executor_model}",
  isolation="worktree",
  prompt="
Unit ${unit_number} failed with error:
${error_details}

<unit_spec>
${original_unit_spec}
</unit_spec>

Fix the failing unit. The worktree and branch already exist.
Check out the existing branch, diagnose the failure, fix it, test, commit, push, create PR.
",
  description="Fix batch unit ${unit_number}: ${unit_title}"
)
```

**Merge conflict detected:** Flag to user — decomposition had hidden overlap.
```
AskUserQuestion(
  header: "Merge Conflict in Unit ${unit_number}",
  question: "Unit ${unit_number} (${unit_title}) has a merge conflict. This suggests the decomposition missed a dependency. Options:\n1. Fix manually\n2. Skip this unit\n3. Abort remaining units",
  followUp: null
)
```

**3+ failures on same unit:** Stop retrying and escalate:
```
## Unit ${unit_number} Escalated

Unit "${unit_title}" failed 3+ times. Manual intervention required.
Error history: ${error_summaries}
Branch: batch/${slug}/unit-${unit_number}
```
</step>

<step name="report">
After all units are resolved (complete or escalated):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MAXSIM > BATCH EXECUTION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Task: ${DESCRIPTION}
Units: ${completed_count}/${unit_count} complete

| # | Unit | Status | PR |
|---|------|--------|----|
${final_status_table}

${failed_count > 0 ? "Failed units require manual attention." : "All units completed successfully."}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Update STATE.md with batch completion:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs state add-decision --phase "batch" --summary "Batch complete: ${completed_count}/${unit_count} units done. PRs: ${pr_list}"
```
</step>

<step name="commit_metadata">
Store batch record in `.planning/batch/` directory.

Update DECOMPOSITION.md frontmatter status:
- All units done: `status: complete`
- Some failed: `status: partial`

Create `.planning/batch/${slug}/RESULTS.md`:
```markdown
---
task: ${DESCRIPTION}
date: ${date}
status: ${all_done ? "complete" : "partial"}
units_total: ${unit_count}
units_complete: ${completed_count}
units_failed: ${failed_count}
---

## Results

| # | Unit | Status | PR | Branch |
|---|------|--------|----|--------|
${results_table}

## Failed Units
${failed_summaries or "None"}
```

Commit metadata:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs(batch): ${DESCRIPTION}" --files .planning/batch/${slug}/DECOMPOSITION.md .planning/batch/${slug}/RESULTS.md .planning/STATE.md
```
</step>

</process>

<success_criteria>
- [ ] `.planning/` and git repository verified
- [ ] User provides task description
- [ ] Decomposition produces 3+ independent units
- [ ] File independence validated across all unit pairs
- [ ] Decision recorded in STATE.md
- [ ] One worktree agent spawned per unit
- [ ] Each agent creates its own branch and PR
- [ ] Progress tracked with status table
- [ ] Failed units retried once before escalation
- [ ] Final report lists all PRs and flags failures
- [ ] Batch metadata committed to `.planning/batch/`
</success_criteria>

<failure_handling>
- **classifyHandoffIfNeeded false failure:** Agent reports "failed" with `classifyHandoffIfNeeded is not defined` error — Claude Code bug, not MAXSIM. Check if branch exists and has commits. If so, treat as success.
- **Independence validation fails twice:** Stop, present overlaps to user, ask for manual decomposition guidance.
- **Agent fails to create PR:** Check if `gh` CLI is authenticated. If not, report branch name for manual PR creation.
- **All agents fail:** Likely systemic issue (git config, permissions). Stop and report for investigation.
- **Fewer than 3 units identified:** Suggest `/maxsim:quick` instead. Do not force worktree overhead for small tasks.
</failure_handling>
