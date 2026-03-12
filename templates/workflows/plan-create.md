<purpose>
Planning stage sub-workflow for /maxsim:plan. Spawns the planner agent to create plan content, posts plans to GitHub as comments on the phase issue, creates task sub-issues, and moves the phase board card to "In Progress". Optionally spawns the planner (in plan-checking mode) for verification with a revision loop.

This file is loaded by the plan.md orchestrator. It does NOT handle gate confirmations or stage routing -- the orchestrator handles that. This sub-workflow focuses ONLY on creating, verifying, and publishing plans to GitHub.
</purpose>

<process>

## Step 1: Check Prerequisites

The orchestrator provides phase context. Verify we have what we need:

- `phase_number`, `phase_name`, `phase_dir`, `padded_phase`, `phase_slug`
- `planner_model`, `checker_model`, `plan_checker_enabled`
- `commit_docs`
- `state_path`, `roadmap_path`, `requirements_path`, `context_path`, `research_path`
- `phase_req_ids` (requirement IDs that this phase must address)
- `phase_issue_number` (GitHub Issue number for the phase)
- `--skip-verify` flag presence

## Step 2: Resolve Models

```bash
PLANNER_MODEL=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs resolve-model planner --raw)
CHECKER_MODEL=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs resolve-model planner --raw)
```

## Step 3: Check Existing Plans

Query the phase GitHub Issue for existing plan comments:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue --issue-number $PHASE_ISSUE_NUMBER --include-comments
```

Look for comments that contain `<!-- maxsim:type=plan -->`.

**If plan comment(s) exist:** Offer options via natural conversation:
```
Phase {phase_number} already has plan(s) on GitHub Issue #{phase_issue_number}.

1. Add more plans (keep existing)
2. View existing plans
3. Re-plan from scratch (deletes existing plan comments)
```

- If "Add more": Continue to Step 4 with existing plans preserved.
- If "View": Display plan comment contents, then re-offer options.
- If "Re-plan": Delete existing plan comments from the issue, continue to Step 4.

**If no plan comments exist:** Continue to Step 4.

## Step 4: Gather Context Paths

Extract file paths and GitHub context from the orchestrator context (provided via init JSON):

```bash
STATE_PATH=$(echo "$INIT" | jq -r '.state_path // empty')
ROADMAP_PATH=$(echo "$INIT" | jq -r '.roadmap_path // empty')
REQUIREMENTS_PATH=$(echo "$INIT" | jq -r '.requirements_path // empty')
```

Context and research content will be read from GitHub Issue #{phase_issue_number} comments (identified by `<!-- maxsim:type=context -->` and `<!-- maxsim:type=research -->` markers) rather than from local files.

## Step 5: Spawn Planner

Display:
```
Planning Phase {phase_number}: {phase_name}...
```

Construct the planner prompt. The planner must return plan content as structured markdown in its response (not write local files):

```markdown
<planning_context>
**Phase:** {phase_number}
**Mode:** standard

<context_sources>
- GitHub Issue #{phase_issue_number} context comment (USER DECISIONS -- locked choices from discussion stage)
- GitHub Issue #{phase_issue_number} research comment (Technical Research findings)
- {state_path} (Project State)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
</context_sources>

**Phase requirement IDs (every ID MUST appear in a plan's `requirements` field):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists -- follow project-specific guidelines
**Project skills:** Check .skills/ directory (if exists) -- read SKILL.md files, plans should account for project skill rules
</planning_context>

<downstream_consumer>
Output consumed by /maxsim:execute via GitHub Issue comments. Plans need:
- Frontmatter (wave, depends_on, files_modified, autonomous)
- Tasks in XML format
- Verification criteria
- must_haves for goal-backward verification
</downstream_consumer>

<output_format>
Return each plan as a separate fenced code block with a plan number header.
Do NOT write local PLAN.md files -- plans will be posted to GitHub by the orchestrator.

Example structure:
## Plan 01

```yaml
# frontmatter here
```

<tasks>
...
</tasks>
</output_format>

<quality_gate>
- [ ] Each plan returned in response with valid frontmatter
- [ ] Tasks are specific and actionable
- [ ] Dependencies correctly identified
- [ ] Waves assigned for parallel execution
- [ ] must_haves derived from phase goal
</quality_gate>
```

Spawn the planner:

```
Task(
  prompt=planner_prompt,
  subagent_type="planner",
  model="{planner_model}",
  description="Plan Phase {phase_number}"
)
```

## Step 6: Handle Planner Return

Parse the planner's return message:

- **`## PLANNING COMPLETE`:**
  Extract the plan content from the planner's response. Parse out individual plans (each is a separate fenced block with a plan number header).

  If plans found in response:
  - Display plan count.
  - Store plans in memory as `plans_content` array.
  - If `--skip-verify` flag is set OR `plan_checker_enabled` is false: skip to Step 9.
  - Otherwise: continue to Step 7 (verification).

  If no plans in response:
  - Error: "Planner reported complete but returned no plan content."
  - Offer: retry or abort.

- **`## CHECKPOINT REACHED`:**
  Present checkpoint to user, get response, spawn continuation agent with checkpoint context. If planner needs a decision, relay it to the user.

- **`## PLANNING INCONCLUSIVE`:**
  Display what was attempted. Offer:
  ```
  Planning inconclusive after {N} attempts.

  1. Provide more context and retry
  2. Try with different approach
  3. Abort
  ```
  Handle user choice accordingly.

## Step 7: Spawn Plan Checker

Initialize iteration tracking: `iteration_count = 1`.

Display:
```
Verifying plans...
```

Construct the checker prompt. Pass the in-memory `plans_content` directly:

```markdown
<verification_context>
**Phase:** {phase_number}
**Phase Goal:** {goal from ROADMAP}

<plans_to_verify>
{plans_content -- the plan(s) returned by the planner in step 5}
</plans_to_verify>

<context_sources>
- GitHub Issue #{phase_issue_number} context comment (USER DECISIONS)
- GitHub Issue #{phase_issue_number} research comment (Technical Research)
- {roadmap_path} (Roadmap)
- {requirements_path} (Requirements)
</context_sources>

**Phase requirement IDs (MUST ALL be covered):** {phase_req_ids}

**Project instructions:** Read ./CLAUDE.md if exists -- verify plans honor project guidelines
**Project skills:** Check .skills/ directory (if exists) -- verify plans account for project skill rules
</verification_context>

<expected_output>
- ## VERIFICATION PASSED -- all checks pass
- ## ISSUES FOUND -- structured issue list
</expected_output>
```

Spawn the checker:

```
Task(
  prompt="## Task: Verify plans achieve phase goal\n\n## Suggested Skills: verification-gates\n\n" + checker_prompt,
  subagent_type="planner",
  model="{checker_model}",
  description="Verify Phase {phase_number} plans"
)
```

## Step 8: Handle Checker Return and Revision Loop

- **`## VERIFICATION PASSED`:**
  Display confirmation:
  ```
  Plan verification passed.
  ```
  Continue to Step 9.

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

  <context_sources>
  - GitHub Issue #{phase_issue_number} context comment (USER DECISIONS)
  </context_sources>

  **Checker issues:** {structured_issues_from_checker}
  </revision_context>

  <instructions>
  Make targeted updates to address checker issues.
  Do NOT replan from scratch unless issues are fundamental.
  Return the full revised plan content (same format as original -- one fenced block per plan).
  </instructions>
  ```

  Spawn planner for revision:

  ```
  Task(
    prompt=revision_prompt,
    subagent_type="planner",
    model="{planner_model}",
    description="Revise Phase {phase_number} plans"
  )
  ```

  After planner returns: increment `iteration_count`, re-spawn checker (go back to Step 7).

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

  - If "Force proceed": Continue to Step 9.
  - If "Provide guidance": Get user input, re-spawn planner with user guidance, reset iteration_count, go to Step 7.
  - If "Abort": Exit workflow.

## Step 9: Post Plans to GitHub

After verification passes (or is skipped), post each plan as a separate comment on the phase GitHub Issue.

For each plan in `plans_content`:

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
<!-- maxsim:type=plan -->
{plan_content}
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-plan-comment --phase-issue-number $PHASE_ISSUE_NUMBER --plan-number "{plan_number}" --plan-content-file "$TMPFILE"
```

If posting any plan comment fails:
- Report which plans failed to post.
- Offer retry for failed plans.
- Do not proceed to task creation until all plans are successfully posted.

Display:
```
Plans posted to GitHub Issue #{phase_issue_number}: {plan_count} plan(s).
```

## Step 10: Create Task Sub-Issues

Parse tasks from the posted plans. For each `<task>` element in the plan XML, extract:
- `id` (e.g. "1.1", "1.2")
- `title`
- `description` / body content

Run `github batch-create-tasks` with the full tasks array and the phase issue number:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github batch-create-tasks --phase-number "$PHASE_NUMBER" --parent-issue-number $PHASE_ISSUE_NUMBER --tasks '[{"task_id":"1.1","title":"Task title","body":"Task body"}, ...]'
```

Each task becomes a GitHub sub-issue linked to the phase issue.

**If batch creation fails (partial or total):**
- Report which task IDs failed to create.
- Offer: retry failed tasks, skip and continue, or abort.
- Do not proceed to board transition until task creation succeeds or user accepts partial failure.

Display:
```
Task sub-issues created: {task_count} tasks linked to Issue #{phase_issue_number}.
```

## Step 11: Move Phase to In Progress

After all plans are posted and task sub-issues are created, move the phase issue to "In Progress" on the project board:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number $PHASE_ISSUE_NUMBER --status "In Progress"
```

Display:
```
Phase #{phase_issue_number} moved to "In Progress" on the board.
```

## Step 12: Return to Orchestrator

After plans are posted, task sub-issues created, and the phase moved to "In Progress", return control to the plan.md orchestrator. Do NOT show gate confirmation or next steps -- the orchestrator handles the final gate.

Display a brief completion message:
```
Planning complete. {plan_count} plan(s) posted to GitHub Issue #{phase_issue_number}. {task_count} task sub-issues created.
```

</process>

<success_criteria>
- Planner and checker models resolved from config
- Existing plans detected from GitHub Issue comments and handled (add/view/replan options)
- Planner agent spawned with context from GitHub Issue comments (context + research) and local files (state, roadmap, requirements)
- Plan content returned from planner as in-memory document (no local PLAN.md files written)
- Checker verification loop runs (max 3 iterations) unless --skip-verify
- Revision loop passes in-memory plan content to planner for targeted fixes
- Plans posted to GitHub Issue #{phase_issue_number} as comments with <!-- maxsim:type=plan --> markers
- Task sub-issues created via `github batch-create-tasks` linked to phase issue
- Phase issue moved to "In Progress" via `github move-issue`
- Failed task creation surfaced with retry option (WIRE-07)
- Control returned to orchestrator without showing gate or next steps
</success_criteria>
