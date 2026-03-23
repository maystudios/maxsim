<purpose>
Planning stage sub-workflow for /maxsim:plan. Spawns a Planner agent (using Agent tool) to
create the task breakdown plan, optionally spawns a Checker agent for verification with a
revision loop, posts plans to GitHub as comments on the phase issue, creates task sub-issues,
and moves the phase board card to "In Progress".

This file is loaded by the plan.md orchestrator. It does NOT handle gate confirmations or
stage routing -- the orchestrator handles that. This sub-workflow focuses ONLY on creating,
verifying, and publishing plans to GitHub.

GitHub Issues is the sole source of truth. No local PLAN.md files are written.
</purpose>

<critical_rules>
- Tool name is `Agent` (NOT `Task`)
- Agent spawning: Agent(prompt, subagent_type, model, isolation, run_in_background)
- Plans are posted to GitHub with <!-- maxsim:type=plan -->
- Use `node .claude/maxsim/bin/maxsim-tools.cjs` for all CLI operations
- No local PLAN.md files are written -- GitHub is the sole source of truth
- Do NOT show gate confirmation or next steps -- the orchestrator handles those
</critical_rules>

<process>

## Step 1: Check Prerequisites

The orchestrator provides phase context. Verify we have what we need:

- `phase_number`, `phase_name`, `phase_dir`, `padded_phase`, `phase_slug`
- `planner_model`, `checker_model`, `plan_checker_enabled`
- `commit_docs`
- `phase_req_ids` (requirement IDs that this phase must address)
- `phase_issue_number` (GitHub Issue number for the phase)
- `--skip-verify` flag presence

## Step 2: Check Existing Plans

Query the phase GitHub Issue for existing plan comments:
```bash
ISSUE_DATA=$(node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments)
```

Look for comments that contain `<!-- maxsim:type=plan -->`.

**If plan comment(s) exist:** Offer options via natural conversation:
```
Phase {phase_number} already has plan(s) on GitHub Issue #{phase_issue_number}.

1. Add more plans (keep existing)
2. View existing plans
3. Re-plan from scratch (removes existing plan comments)
```

- If "Add more": Continue to Step 3 with existing plans preserved.
- If "View": Display plan comment contents, then re-offer options.
- If "Re-plan": Delete existing plan comments from the issue:
  ```bash
  node .claude/maxsim/bin/maxsim-tools.cjs github delete-comments \
    --issue-number $PHASE_ISSUE_NUMBER --type plan
  ```
  Then continue to Step 3.

**If no plan comments exist:** Continue to Step 3.

## Step 3: Read Context and Research from GitHub

Fetch the phase issue with all comments to supply the planner with context and research:

```bash
ISSUE_DATA=$(node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments)
```

Extract:
- Context comment content (from `<!-- maxsim:type=context -->` comment)
- Research comment content (from `<!-- maxsim:type=research -->` comment)
- Issue body (phase goal, description, success criteria)

These are passed directly into the planner prompt. No local files are read for context or research.

## Step 4: Spawn Planner Agent

Display:
```
Planning Phase {phase_number}: {phase_name}...
```

Construct the planner prompt. The planner must return plan content as structured markdown
in its response (not write local files):

```markdown
<planning_context>
**Phase:** {phase_number} -- {phase_name}
**Mode:** standard

<github_context>
**Phase Issue:** #{phase_issue_number}
**Phase Goal:** {phase_goal from issue body}

**User Decisions (from context comment):**
{content of the <!-- maxsim:type=context --> comment}

**Research Findings (from research comment):**
{content of the <!-- maxsim:type=research --> comment}
</github_context>

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists -- follow project-specific guidelines
**Project skills:** Check .claude/skills/ directory (if exists) -- read SKILL.md files, plans should account for project skill rules
</planning_context>

<task_format>
Every task must include:
- `id` and `type` (auto or checkpoint)
- `<files>` -- list of files created or modified with CREATE/MODIFY/DELETE
- `<action>` -- detailed implementation instructions the executor can follow without ambiguity
- `<verify>` -- automated verification command (must be runnable via Bash)
- `<done>` -- bullet list of completion criteria (each independently verifiable)
</task_format>

<plan_frontmatter>
Every plan must have valid YAML frontmatter:
---
phase: {phase-name}
plan: {number}
type: execute
wave: {wave-number}
depends_on: [{prior-plan-ids}]
files_modified: [{key-files}]
autonomous: true|false
requirements: [{req-ids}]
must_haves:
  truths: [{invariant-statements}]
  artifacts: [{path, provides, min_lines}]
  key_links: [{from, to, via, pattern}]
---
</plan_frontmatter>

<wave_design>
Break the phase into atomic tasks (2-5 minutes each for an AI agent).
Group independent tasks into the same wave for parallel execution.
Tasks that depend on prior task outputs go in later waves.
Each plan covers one logical deliverable.
Plans within the same wave can execute in parallel.
</wave_design>

<downstream_consumer>
Output consumed by /maxsim:execute via GitHub Issue comments. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<output_format>
Return each plan as a separate section with a plan number header.
Do NOT write local PLAN.md files -- plans will be posted to GitHub by the orchestrator.

Example structure:
## Plan 01

```yaml
{frontmatter}
```

<tasks>
<task id="1.1" type="auto">
  <files>...</files>
  <action>...</action>
  <verify>...</verify>
  <done>...</done>
</task>
</tasks>
</output_format>

<quality_gate>
Before returning:
- [ ] Each plan returned in response with valid frontmatter
- [ ] Tasks are specific and actionable (2-5 min each)
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
- [ ] Every phase_req_id appears in at least one plan's requirements field
- [ ] Goal-backward verification passes (completing all tasks achieves the phase goal)
</quality_gate>
```

Spawn the planner:

```
Agent(
  prompt=planner_prompt,
  subagent_type="planner",
  model="{planner_model}",
  isolation="worktree",
  run_in_background=false
)
```

## Step 5: Handle Planner Return

Parse the planner's return message:

- **`## PLANNING COMPLETE`:**
  Extract the plan content from the planner's response. Parse out individual plans
  (each is a separate section with a plan number header).

  If plans found in response:
  - Display plan count.
  - Store plans in memory as `plans_content` array.
  - If `--skip-verify` flag is set OR `plan_checker_enabled` is false: skip to Step 8.
  - Otherwise: continue to Step 6 (verification).

  If no plans in response:
  - Error: "Planner reported complete but returned no plan content."
  - Offer: retry or abort.

- **`## CHECKPOINT REACHED`:**
  Present checkpoint to user, get response, spawn continuation Agent with checkpoint context.
  If planner needs a decision, relay it to the user.

- **`## PLANNING INCONCLUSIVE`:**
  Display what was attempted. Offer:
  ```
  Planning inconclusive after {N} attempts.

  1. Provide more context and retry
  2. Try with different approach
  3. Abort
  ```
  Handle user choice accordingly.

## Step 6: Spawn Plan Checker

Initialize iteration tracking: `iteration_count = 1`.

Display:
```
Verifying plans...
```

Construct the checker prompt. Pass the in-memory `plans_content` directly:

```markdown
<verification_context>
**Phase:** {phase_number} -- {phase_name}
**Phase Goal:** {goal from GitHub Issue}

<plans_to_verify>
{plans_content -- the plan(s) returned by the planner in Step 4}
</plans_to_verify>

<github_context>
**User Decisions (from context comment):**
{content of the <!-- maxsim:type=context --> comment}

**Research Findings (from research comment):**
{content of the <!-- maxsim:type=research --> comment}
</github_context>

**Phase requirement IDs (MUST ALL be covered):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists -- verify plans honor project guidelines
**Project skills:** Check .claude/skills/ directory (if exists) -- verify plans account for project skill rules
</verification_context>

<expected_output>
- ## VERIFICATION PASSED -- all checks pass
- ## ISSUES FOUND -- structured issue list with specific problems and which plan/task they affect
</expected_output>
```

Spawn the checker:

```
Agent(
  prompt="## Task: Verify plans achieve phase goal\n\n## Suggested Skills: verification\n\n" + checker_prompt,
  subagent_type="verifier",
  model="{checker_model}",
  isolation="worktree",
  run_in_background=false
)
```

## Step 7: Handle Checker Return and Revision Loop

- **`## VERIFICATION PASSED`:**
  Display confirmation:
  ```
  Plan verification passed.
  ```
  Continue to Step 8.

- **`## ISSUES FOUND`:**
  Display the issues found. Check iteration count.

  **If iteration_count < 3:**

  Display:
  ```
  Sending plans back for revision... (iteration {iteration_count}/3)
  ```

  Construct revision prompt. Pass the current in-memory `plans_content` directly:

  ```markdown
  <revision_context>
  **Phase:** {phase_number}
  **Mode:** revision

  <existing_plans>
  {plans_content -- current in-memory plan content}
  </existing_plans>

  <github_context>
  **User Decisions (from context comment):**
  {content of the <!-- maxsim:type=context --> comment}
  </github_context>

  **Checker issues:** {structured_issues_from_checker}
  </revision_context>

  <instructions>
  Make targeted updates to address checker issues.
  Do NOT replan from scratch unless issues are fundamental.
  Return the full revised plan content (same format as original -- one section per plan).
  </instructions>
  ```

  Spawn planner for revision:

  ```
  Agent(
    prompt=revision_prompt,
    subagent_type="planner",
    model="{planner_model}",
    isolation="worktree",
    run_in_background=false
  )
  ```

  After planner returns: increment `iteration_count`, update `plans_content` with revised content,
  re-spawn checker (go back to Step 6).

  **If iteration_count >= 3:**

  Display:
  ```
  Max verification iterations reached. {N} issues remain:
  {issue list}

  1. Force proceed -- accept plans with known issues
  2. Provide guidance -- give planner hints and retry
  3. Abort -- stop planning
  ```

  Wait for user choice.

  - If "Force proceed": Continue to Step 8.
  - If "Provide guidance": Get user input, re-spawn planner with user guidance appended to
    revision prompt, reset `iteration_count` to 1, go to Step 6.
  - If "Abort": Exit workflow.

## Step 8: Post Plans to GitHub

After verification passes (or is skipped), post each plan as a separate comment on the phase
GitHub Issue.

For each plan in `plans_content`:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
<!-- maxsim:type=plan -->
{plan_content}
BODY_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-plan-comment \
  --phase-issue-number $PHASE_ISSUE_NUMBER \
  --plan-number "{plan_number}" \
  --plan-content-file "$TMPFILE"
```

If posting any plan comment fails:
- Report which plans failed to post.
- Offer retry for failed plans.
- Do not proceed to task creation until all plans are successfully posted.

Display:
```
Plans posted to GitHub Issue #{phase_issue_number}: {plan_count} plan(s).
```

## Step 9: Create Task Sub-Issues

Parse tasks from the posted plans. For each `<task>` element in the plan XML, extract:
- `id` (e.g. "1.1", "1.2")
- `title` (from action summary or first line of action)
- `body` content (full task details: action, verify, done criteria)

Run `github batch-create-tasks` with the full tasks array and the phase issue number:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github batch-create-tasks \
  --phase-number "$PHASE_NUMBER" \
  --parent-issue-number $PHASE_ISSUE_NUMBER \
  --tasks '[{"task_id":"1.1","title":"Task title","body":"Task body"}, ...]'
```

Each task becomes a GitHub sub-issue linked to the phase issue. The task body should include:
- Wave number
- Dependencies (depends_on)
- Full action description
- Verify command
- Done criteria

**If batch creation fails (partial or total):**
- Report which task IDs failed to create.
- Offer: retry failed tasks, skip and continue, or abort.
- Do not proceed to board transition until task creation succeeds or user accepts partial failure.

Display:
```
Task sub-issues created: {task_count} tasks linked to Issue #{phase_issue_number}.
```

## Step 10: Move Phase to In Progress

After all plans are posted and task sub-issues are created, move the phase issue to "In Progress"
on the project board:

```bash
node .claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $PHASE_ISSUE_NUMBER --status "In Progress"
```

Display:
```
Phase #{phase_issue_number} moved to "In Progress" on the board.
```

## Step 11: Return to Orchestrator

After plans are posted, task sub-issues created, and the phase moved to "In Progress", return
control to the plan.md orchestrator. Do NOT show gate confirmation or next steps -- the
orchestrator handles the final gate.

Display a brief completion message:
```
Planning complete. {plan_count} plan(s) posted to GitHub Issue #{phase_issue_number}. {task_count} task sub-issues created.
```

</process>

<success_criteria>
- [ ] Planner and checker models resolved from config
- [ ] Existing plans detected from GitHub Issue comments and handled (add/view/replan options)
- [ ] Context and research read from GitHub Issue comments (not local files)
- [ ] Planner agent spawned with Agent tool (not Task) with isolation="worktree"
- [ ] Plan content returned from planner as in-memory document (no local PLAN.md files written)
- [ ] Checker verification loop runs (max 3 iterations) unless --skip-verify
- [ ] Revision loop passes in-memory plan content to planner for targeted fixes
- [ ] Agent tool used (not Task) for planner, checker, and revision spawning
- [ ] Plans posted to GitHub Issue #{phase_issue_number} as comments with <!-- maxsim:type=plan --> markers
- [ ] Task sub-issues created via `github batch-create-tasks` linked to phase issue
  - Sub-issue bodies include: wave, dependencies, action, verify command, done criteria
- [ ] Phase issue moved to "In Progress" via `github move-issue`
- [ ] Failed task creation surfaced with retry option
- [ ] Control returned to orchestrator without showing gate or next steps
</success_criteria>
