<purpose>
Thin orchestrator for the /maxsim:plan state machine. Detects the current stage of a phase
(Discussion, Research, Planning) from GitHub Issue comments using HTML markers, delegates to
stage sub-workflows, shows gate confirmations between stages, and handles re-entry on already-planned phases.

GitHub Issues is the sole source of truth. No local PLAN.md, CONTEXT.md, or RESEARCH.md files
are read or written by this orchestrator. All state is stored as GitHub Issue comments identified
by HTML markers: <!-- maxsim:type=context -->, <!-- maxsim:type=research -->, <!-- maxsim:type=plan -->.

This file is the ORCHESTRATOR ONLY. Stage-specific logic lives in:
- @.claude/maxsim/workflows/plan-discuss.md  (Discussion stage)
- @.claude/maxsim/workflows/plan-research.md (Research stage)
- @.claude/maxsim/workflows/plan-create.md   (Planning stage)
</purpose>

<critical_rules>
- Tool name is `Agent` (NOT `Task`)
- Agent spawning uses: Agent(prompt, model, isolation, run_in_background)
- GitHub Issues is the SOLE source of truth -- no local plan/context/research files
- Plans are posted as GitHub Issue comments with <!-- maxsim:type=plan -->
- Context is posted as: <!-- maxsim:type=context -->
- Research is posted as: <!-- maxsim:type=research -->
- Use `node .claude/maxsim/bin/maxsim-tools.cjs` for all CLI operations
</critical_rules>

<process>

## 1. Parse Arguments

Extract from $ARGUMENTS:
- Phase number (integer or decimal like `2.1`) -- **required**
- Flags: `--force-research`, `--skip-verify`

**If no phase number provided:** Error and exit:
```
Usage: /maxsim:plan <phase-number> [--force-research] [--skip-verify]

Use /maxsim:progress to see available phases.
```

## 2. Initialize Phase Context

Load phase state in one call:

```bash
INIT=$(node .claude/maxsim/bin/maxsim-tools.cjs init plan-phase "$PHASE")
```

Parse JSON for: `phase_found`, `phase_dir`, `phase_number`, `phase_name`, `phase_slug`,
`padded_phase`, `commit_docs`, `researcher_model`, `planner_model`, `checker_model`,
`research_enabled`, `plan_checker_enabled`, `phase_req_ids`, `phase_issue_number`.

**If `phase_found` is false:**
```
Phase [X] not found in roadmap.

Use /maxsim:progress to see available phases.
```
Exit workflow.

## 3. Enter Plan Mode and Resolve Models

Call `EnterPlanMode` before any research or planning steps.

```bash
RESEARCHER_MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model researcher --raw)
PLANNER_MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model planner --raw)
CHECKER_MODEL=$(node .claude/maxsim/bin/maxsim-tools.cjs resolve-model verifier --raw)
```

## 4. Stage Detection (GitHub-First)

Detect planning stage by querying the phase GitHub Issue.

**Step 4a -- Ensure phase issue exists:**

If no `phase_issue_number` in init context (phase not yet on GitHub):
```bash
CREATE_RESULT=$(node .claude/maxsim/bin/maxsim-tools.cjs github create-phase \
  --phase-number "$PHASE_NUMBER" \
  --phase-name "$PHASE_NAME" \
  --goal "$GOAL" \
  --requirements "$REQUIREMENTS" \
  --success-criteria "$SUCCESS_CRITERIA")
PHASE_ISSUE_NUMBER=$(echo "$CREATE_RESULT" | jq -r '.issue_number')
```

**Step 4b -- Read issue with comments:**
```bash
ISSUE_DATA=$(node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER \
  --include-comments)
```

**Step 4c -- Detect markers in comments:**
- Has comment containing `<!-- maxsim:type=plan -->`?     → `HAS_PLAN=true`
- Has comment containing `<!-- maxsim:type=research -->`? → `HAS_RESEARCH=true`
- Has comment containing `<!-- maxsim:type=context -->`?  → `HAS_CONTEXT=true`

**Step 4d -- Determine stage:**

| GitHub State | Stage | Next Action |
|---|---|---|
| Has `type=plan` | Already planned | Go to **Re-entry flow** (Step 5) |
| Has `type=research`, no `type=plan` | Planning | Start at **Planning stage** (Step 8) |
| Has `type=context`, no `type=research` | Research | Start at **Research stage** (Step 7) |
| No marker comments | Discussion | Start at **Discussion stage** (Step 6) |

Display detected stage:
```
Phase {phase_number}: {phase_name}
GitHub Issue: #{phase_issue_number}
Current stage: {Discussion | Research | Planning | Already planned}
```

## 5. Re-entry Flow (Already Planned)

When a `type=plan` comment exists on the phase issue, the phase has been planned.

Display:
```
## Phase {phase_number} Already Planned

**Plans:** posted as comment(s) on GitHub Issue #{phase_issue_number}
**Phase Issue:** https://github.com/{owner}/{repo}/issues/{phase_issue_number}

**Options:**
1. View existing plans
2. Re-plan from scratch (removes plan comments, restarts from Discussion)
3. Execute phase -- run /maxsim:execute {phase_number}
4. Done (exit)
```

Wait for user choice via natural conversation.

- **View:** Display contents of each `type=plan` comment from the issue, then re-show options.
- **Re-plan:** Delete existing plan/context/research comments from the phase issue (use
  `node .claude/maxsim/bin/maxsim-tools.cjs github delete-comments --issue-number $PHASE_ISSUE_NUMBER --type plan,context,research`),
  reset to Discussion stage (Step 6).
- **Execute:** Display `/maxsim:execute {phase_number}` and exit.
- **Done:** Exit workflow.

## 6. Discussion Stage

Delegate to the discussion sub-workflow for full discussion logic:

@.claude/maxsim/workflows/plan-discuss.md

Pass context: `phase_number`, `phase_name`, `phase_dir`, `padded_phase`, `phase_slug`,
`commit_docs`, `phase_issue_number`.

**After discussion completes (context posted as GitHub comment):**

Re-query the phase issue to verify the `type=context` comment now exists:
```bash
node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments
```

Show gate:
```
## Gate: Discussion Complete

**Captured:** {N} decisions across {M} areas
**Locked decisions:**
{bullet list of key decisions from context comment}

**Claude's discretion:** {list of areas where Claude decides}
**GitHub Issue:** #{phase_issue_number} (context posted as comment)

Continue to research? [Yes / Review context / Re-discuss area]
```

Wait for user response via natural conversation.

- **Yes:** Advance to Research stage (Step 7).
- **Review context:** Display context comment contents, then re-show gate.
- **Re-discuss area:** Loop back to discussion sub-workflow with the area to re-discuss.

## 7. Research Stage

Delegate to the research sub-workflow:

@.claude/maxsim/workflows/plan-research.md

Pass context: `phase_number`, `phase_name`, `phase_dir`, `padded_phase`, `phase_slug`,
`commit_docs`, `researcher_model`, `research_enabled`, `has_research`,
`phase_req_ids`, `phase_issue_number`.
Also pass the `--force-research` flag if present in $ARGUMENTS.

**After research completes (research posted as GitHub comment or already exists):**

Re-query the phase issue to verify the `type=research` comment now exists:
```bash
node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments
```

Show gate:
```
## Gate: Research Complete

**Key findings:** {3-5 bullet summary from research comment}
**Confidence:** {HIGH/MEDIUM/LOW from research content}
**GitHub Issue:** #{phase_issue_number} (research posted as comment)

Continue to planning? [Yes / Review research / Re-research]
```

Wait for user response via natural conversation.

- **Yes:** Advance to Planning stage (Step 8).
- **Review research:** Display research comment contents, then re-show gate.
- **Re-research:** Loop back to research sub-workflow with `--force-research`.

## 8. Planning Stage

Delegate to the planning sub-workflow:

@.claude/maxsim/workflows/plan-create.md

Pass context: `phase_number`, `phase_name`, `phase_dir`, `padded_phase`, `phase_slug`,
`commit_docs`, `planner_model`, `checker_model`, `plan_checker_enabled`,
`phase_req_ids`, `phase_issue_number`.
Also pass the `--skip-verify` flag if present in $ARGUMENTS.

**After planning completes (plans posted as GitHub comments and task sub-issues created):**

Re-query the phase issue to verify `type=plan` comments exist:
```bash
node .claude/maxsim/bin/maxsim-tools.cjs github get-issue \
  --issue-number $PHASE_ISSUE_NUMBER --include-comments
```

Show final gate:
```
## Gate: Planning Complete

**Plans:** {plan_count} plan(s) in {wave_count} wave(s)
**Wave structure:**
| Wave | Plans | What it builds |
|------|-------|----------------|
{wave summary from plan comment frontmatter}

**GitHub Issue:** #{phase_issue_number} (plans posted as comments)
**Task sub-issues:** {task_count} tasks created as linked sub-issues
**Board status:** Phase moved to "In Progress"

Ready to execute? Run `/maxsim:execute {phase_number}`
```

This is the final gate -- no further confirmation needed. The user's next action is to run
`/maxsim:execute`.

## 9. Checkpoint Before /clear

At any point during the workflow, if context is getting full (conversation is long, many tool
calls made), recommend checkpointing before `/clear`.

**Checkpoint protocol:**
1. Post a checkpoint comment to the phase's GitHub Issue:
```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
<!-- maxsim:type=checkpoint -->
## MAXSIM Checkpoint

**Command:** /maxsim:plan
**Stage:** {current_stage} ({stage_num}/3)
**Completed:**
{list of completed stages with summaries}
**Resume from:** {next_stage}
**Timestamp:** {ISO timestamp}
BODY_EOF
node .claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type checkpoint
```

2. Display checkpoint recommendation:
```
Context is filling up. Recommended: save progress and /clear.

Your progress has been checkpointed on GitHub Issue #{phase_issue_number}.
Re-run `/maxsim:plan {phase_number}` after /clear -- it will detect completed stages
from GitHub and resume from {next_stage}.
```

Stage detection in Step 4 handles resume automatically -- completed stages produce marker
comments that are detected on re-entry.

</process>

<success_criteria>
- [ ] Phase validated against roadmap
- [ ] Phase GitHub Issue created if it does not exist
- [ ] Current stage correctly detected from GitHub Issue comments (not local files)
- [ ] Re-entry flow works for already-planned phases (reads plan comments from GitHub)
- [ ] Discussion stage delegates to plan-discuss.md sub-workflow
- [ ] Research stage delegates to plan-research.md sub-workflow
- [ ] Planning stage delegates to plan-create.md sub-workflow
- [ ] Gate confirmation shown after each stage transition
- [ ] User confirms before advancing to next stage
- [ ] Checkpoint-before-clear posts to GitHub Issue and resumes via GitHub marker detection
- [ ] No stage-specific logic inline -- all delegated to sub-workflows
- [ ] Agent tool used (not Task) for all agent spawning
</success_criteria>
