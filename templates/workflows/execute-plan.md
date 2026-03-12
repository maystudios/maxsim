<purpose>
Execute a phase plan (loaded from GitHub issue comment or local PLAN.md) and post the outcome summary as a GitHub comment. Per-task board transitions keep the project board current throughout execution.
</purpose>

<required_reading>
Read STATE.md before any operation to load project context.
Read config.json for planning behavior settings.

@~/.claude/maxsim/references/git-integration.md
</required_reading>

MAXSIM provides CLI commands (`github create-phase`, `github list-phases`, etc.) for structured operations.

<process>

<step name="init_context" priority="first">
Load execution context (paths only to minimize orchestrator context):

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init execute-phase "${PHASE}")
```

Extract from init JSON: `executor_model`, `commit_docs`, `phase_dir`, `phase_number`, `plans`, `summaries`, `incomplete_plans`, `state_path`, `config_path`, `phase_issue_number`, `task_mappings`.

If `.planning/` missing: error.
</step>

<step name="load_plan_from_github">

## Plan Loading -- GitHub First

When the orchestrator passes `github_context` (phase_issue_number and plan_comment_body), use it directly:

1. The plan content is in `plan_comment_body` passed from the orchestrator. Parse it in memory -- do NOT read a local PLAN.md file.
2. Extract frontmatter fields: `wave`, `autonomous`, `objective`, `requirements`, `task_mappings`, `gap_closure`.
3. Extract the task list and verification criteria from the comment body.

**External edit detection (WIRE-06):** Before beginning execution, check if the plan comment was modified since the orchestrator read it:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github detect-external-edits --phase-number "$PHASE_NUMBER"
```

If external edits detected: warn user and offer to re-read the plan before proceeding.

**If no GitHub context is available:**

GitHub Issues is the source of truth for plans. If no `phase_issue_number` or `plan_comment_body` was passed, report the error and exit:

```
Plan content must be provided via GitHub Issue comment. Ensure GitHub integration is configured.
```
</step>

<step name="record_start_time">
```bash
PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_START_EPOCH=$(date +%s)
```
</step>

<step name="parse_segments">

Identify checkpoint type from plan content:

```bash
# If plan loaded from GitHub comment, scan comment body for checkpoint markers
# If plan loaded from local file:
grep -n "type=\"checkpoint" .planning/phases/XX-name/{phase}-{plan}-PLAN.md
```

**Routing by checkpoint type:**

| Checkpoints | Pattern | Execution |
|-------------|---------|-----------|
| None | A (autonomous) | Single subagent: full plan + post SUMMARY comment + commit |
| Verify-only | B (segmented) | Segments between checkpoints. After none/human-verify → SUBAGENT. After decision/human-action → MAIN |
| Decision | C (main) | Execute entirely in main context |

**Pattern A:** init_agent_tracking → spawn Task(subagent_type="executor", model=executor_model) with prompt: execute plan (content from GitHub comment or local path), autonomous, all tasks + post SUMMARY comment + commit, follow deviation/auth rules, move task sub-issues on board as each task starts/completes, report: plan name, tasks, summary comment URL, commit hash → track agent_id → wait → update tracking → report.

**Pattern B:** Execute segment-by-segment. Autonomous segments: spawn subagent for assigned tasks only (no SUMMARY/commit). Checkpoints: main context. After all segments: aggregate, post SUMMARY as GitHub comment, commit. See segment_execution.

**Pattern C:** Execute in main using standard flow (step name="execute").

Fresh context per subagent preserves peak quality. Main context stays lean.
</step>

<step name="init_agent_tracking">
```bash
if [ ! -f .planning/agent-history.json ]; then
  echo '{"version":"1.0","max_entries":50,"entries":[]}' > .planning/agent-history.json
fi
rm -f .planning/current-agent-id.txt
if [ -f .planning/current-agent-id.txt ]; then
  INTERRUPTED_ID=$(cat .planning/current-agent-id.txt)
  echo "Found interrupted agent: $INTERRUPTED_ID"
fi
```

If interrupted: ask user to resume (Task `resume` parameter) or start fresh.

**Tracking protocol:** On spawn: write agent_id to `current-agent-id.txt`, append to agent-history.json: `{"agent_id":"[id]","task_description":"[desc]","phase":"[phase]","plan":"[plan]","segment":[num|null],"timestamp":"[ISO]","status":"spawned","completion_timestamp":null}`. On completion: status → "completed", set completion_timestamp, delete current-agent-id.txt. Prune: if entries > max_entries, remove oldest "completed" (never "spawned").

Run for Pattern A/B before spawning. Pattern C: skip.
</step>

<step name="segment_execution">
Pattern B only (verify-only checkpoints). Skip for A/C.

1. Parse segment map: checkpoint locations and types
2. Per segment:
   - Subagent route: spawn executor for assigned tasks only. Prompt: task range, plan content (from GitHub comment or local path), read full plan for context, execute assigned tasks, track deviations, move task sub-issues to "In Progress" when started and "Done" when completed, NO SUMMARY/commit. Track via agent protocol.
   - Main route: execute tasks using standard flow (step name="execute")
3. After ALL segments: aggregate files/deviations/decisions → post SUMMARY as GitHub comment (`github post-comment` with type=summary) → commit → self-check:
   - Verify key-files.created exist on disk with `[ -f ]`
   - Check `git log --oneline --all --grep="{phase}-{plan}"` returns ≥1 commit
   - Check for `## Self-Check: PASSED` or `## Self-Check: FAILED` and append to summary comment body

   **Known Claude Code bug (classifyHandoffIfNeeded):** If any segment agent reports "failed" with `classifyHandoffIfNeeded is not defined`, this is a Claude Code runtime bug — not a real failure. Run spot-checks; if they pass, treat as successful.
</step>

<step name="load_prompt">

The plan content IS the execution instructions. Follow exactly. If plan references CONTEXT.md: honor user's vision throughout.

The plan content is already in memory from the load_plan_from_github step (loaded from the GitHub Issue comment passed by the orchestrator).
</step>

<step name="pre_execution_gates">
Validate requirements before execution. These gates ensure spec-driven development.

**Gate G1: Requirement Existence** — All requirement IDs from the plan's frontmatter must exist in REQUIREMENTS.md.

```bash
# Extract requirement IDs from plan frontmatter (in memory if loaded from GitHub, or from file)
REQ_IDS=$(grep "^requirements:" "$PLAN_PATH" | sed 's/requirements:\s*\[//;s/\]//;s/,/ /g;s/"//g;s/'\''//g' | tr -s ' ')
if [ -n "$REQ_IDS" ]; then
  G1_RESULT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs verify requirement-existence $REQ_IDS)
  G1_VALID=$(echo "$G1_RESULT" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).valid))")
  if [ "$G1_VALID" != "true" ]; then
    G1_MISSING=$(echo "$G1_RESULT" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).missing.join(', ')))")
    echo "GATE G1 FAILED: Requirements not found in REQUIREMENTS.md: $G1_MISSING"
    echo "Fix: Add missing requirements to REQUIREMENTS.md or update plan frontmatter."
    # STOP execution — this is a hard gate
  fi
fi
```

**Gate G2: Requirement Status** — Requirement IDs must not already be marked Complete.

```bash
if [ -n "$REQ_IDS" ]; then
  G2_RESULT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs verify requirement-status $REQ_IDS)
  G2_VALID=$(echo "$G2_RESULT" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).valid))")
  if [ "$G2_VALID" != "true" ]; then
    G2_COMPLETE=$(echo "$G2_RESULT" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).already_complete.join(', ')))")
    echo "GATE G2 WARNING: Requirements already marked complete: $G2_COMPLETE"
    echo "This plan may be re-implementing completed work. Proceeding with warning."
    # WARNING only — log but continue (re-execution scenarios are valid)
  fi
fi
```
</step>

<step name="previous_phase_check">
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs phases list --type summaries --raw
# Extract the second-to-last summary from the JSON result
```
If previous phase has unresolved issues (check summary comments on phase issue for "Issues Encountered" / "Next Phase Readiness" blockers): AskUserQuestion(header="Previous Issues", options: "Proceed anyway" | "Address first" | "Review previous").
</step>

<step name="execute">
Deviations are normal — handle via rules below.

1. Read @context files from prompt
2. Per task:

   **Before starting each task (WIRE-04 board transition):**
   - Look up the task's sub-issue number from `task_mappings` in the GitHub context.
   - Move the task sub-issue to "In Progress":
     ```bash
     node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number $TASK_SUB_ISSUE_NUMBER --status "In Progress"
     ```

   - `type="auto"`: if `tdd="true"` → TDD execution. Implement with deviation rules + auth gates. Verify done criteria. Commit (see task_commit). Track hash for Summary.
   - `type="checkpoint:*"`: STOP → checkpoint_protocol → wait for user → continue only after confirmation.

   **After each task completes successfully (WIRE-04 board transition):**
   - Post task completion details on the task sub-issue:
     ```bash
     node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-completion --issue-number $TASK_SUB_ISSUE_NUMBER --commit-sha "$TASK_COMMIT" --files-changed "file1.ts,file2.ts"
     ```
   - Close the task sub-issue and move to "Done":
     ```bash
     node ~/.claude/maxsim/bin/maxsim-tools.cjs github close-issue $TASK_SUB_ISSUE_NUMBER
     node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number $TASK_SUB_ISSUE_NUMBER --status "Done"
     ```

3. Run `<verification>` checks
4. Confirm `<success_criteria>` met
5. Document deviations in Summary
</step>

<authentication_gates>

## Authentication Gates

Auth errors during execution are NOT failures — they're expected interaction points.

**Indicators:** "Not authenticated", "Unauthorized", 401/403, "Please run {tool} login", "Set {ENV_VAR}"

**Protocol:**
1. Recognize auth gate (not a bug)
2. STOP task execution
3. Create dynamic checkpoint:human-action with exact auth steps
4. Wait for user to authenticate
5. Verify credentials work
6. Retry original task
7. Continue normally

**Example:** `vercel --yes` → "Not authenticated" → checkpoint asking user to `vercel login` → verify with `vercel whoami` → retry deploy → continue

**In Summary:** Document as normal flow under "## Authentication Gates", not as deviations.

</authentication_gates>

<deviation_rules>

## Deviation Rules

You WILL discover unplanned work. Apply automatically, track all for Summary.

| Rule | Trigger | Action | Permission |
|------|---------|--------|------------|
| **1: Bug** | Broken behavior, errors, wrong queries, type errors, security vulns, race conditions, leaks | Fix → test → verify → track `[Rule 1 - Bug]` | Auto |
| **2: Missing Critical** | Missing essentials: error handling, validation, auth, CSRF/CORS, rate limiting, indexes, logging | Add → test → verify → track `[Rule 2 - Missing Critical]` | Auto |
| **3: Blocking** | Prevents completion: missing deps, wrong types, broken imports, missing env/config/files, circular deps | Fix blocker → verify proceeds → track `[Rule 3 - Blocking]` | Auto |
| **4: Architectural** | Structural change: new DB table, schema change, new service, switching libs, breaking API, new infra | STOP → present decision (below) → track `[Rule 4 - Architectural]` | Ask user |

**Rule 4 format:**
```
⚠️ Architectural Decision Needed

Current task: [task name]
Discovery: [what prompted this]
Proposed change: [modification]
Why needed: [rationale]
Impact: [what this affects]
Alternatives: [other approaches]

Proceed with proposed change? (yes / different approach / defer)
```

**Priority:** Rule 4 (STOP) > Rules 1-3 (auto) > unsure → Rule 4
**Edge cases:** missing validation → R2 | null crash → R1 | new table → R4 | new column → R1/2
**Heuristic:** Affects correctness/security/completion? → R1-3. Maybe? → R4.

</deviation_rules>

<deviation_documentation>

## Documenting Deviations

Summary MUST include deviations section. None? → `## Deviations from Plan\n\nNone - plan executed exactly as written.`

Per deviation: **[Rule N - Category] Title** — Found during: Task X | Issue | Fix | Files modified | Verification | Commit hash

End with: **Total deviations:** N auto-fixed (breakdown). **Impact:** assessment.

</deviation_documentation>

<tdd_plan_execution>
## TDD Execution

For `type: tdd` plans — RED-GREEN-REFACTOR:

1. **Infrastructure** (first TDD plan only): detect project, install framework, config, verify empty suite
2. **RED:** Read `<behavior>` → failing test(s) → run (MUST fail) → commit: `test({phase}-{plan}): add failing test for [feature]`
3. **GREEN:** Read `<implementation>` → minimal code → run (MUST pass) → commit: `feat({phase}-{plan}): implement [feature]`
4. **REFACTOR:** Clean up → tests MUST pass → commit: `refactor({phase}-{plan}): clean up [feature]`

Errors: RED doesn't fail → investigate test/existing feature. GREEN doesn't pass → debug, iterate. REFACTOR breaks → undo.

See `~/.claude/maxsim/references/tdd.md` for structure.
</tdd_plan_execution>

<task_commit>
## Task Commit Protocol

After each task (verification passed, done criteria met), commit immediately.

**1. Check:** `git status --short`

**2. Stage individually** (NEVER `git add .` or `git add -A`):
```bash
git add src/api/auth.ts
git add src/types/user.ts
```

**3. Commit type:**

| Type | When | Example |
|------|------|---------|
| `feat` | New functionality | feat(08-02): create user registration endpoint |
| `fix` | Bug fix | fix(08-02): correct email validation regex |
| `test` | Test-only (TDD RED) | test(08-02): add failing test for password hashing |
| `refactor` | No behavior change (TDD REFACTOR) | refactor(08-02): extract validation to helper |
| `perf` | Performance | perf(08-02): add database index |
| `docs` | Documentation | docs(08-02): add API docs |
| `style` | Formatting | style(08-02): format auth module |
| `chore` | Config/deps | chore(08-02): add bcrypt dependency |

**4. Format:** `{type}({phase}-{plan}): {description}` with bullet points for key changes.

**5. Record hash:**
```bash
TASK_COMMIT=$(git rev-parse --short HEAD)
TASK_COMMITS+=("Task ${TASK_NUM}: ${TASK_COMMIT}")
```

</task_commit>

<step name="checkpoint_protocol">
On `type="checkpoint:*"`: automate everything possible first. Checkpoints are for verification/decisions only.

Display: `CHECKPOINT: [Type]` box → Progress {X}/{Y} → Task name → type-specific content → `YOUR ACTION: [signal]`

| Type | Content | Resume signal |
|------|---------|---------------|
| human-verify (90%) | What was built + verification steps (commands/URLs) | "approved" or describe issues |
| decision (9%) | Decision needed + context + options with pros/cons | "Select: option-id" |
| human-action (1%) | What was automated + ONE manual step + verification plan | "done" |

After response: verify if specified. Pass → continue. Fail → inform, wait. WAIT for user — do NOT hallucinate completion.

See ~/.claude/maxsim/references/checkpoints.md for details.
</step>

<step name="checkpoint_return_for_orchestrator">
When spawned via Task and hitting checkpoint: return structured state (cannot interact with user directly).

**Required return:** 1) Completed Tasks table (hashes + files) 2) Current Task (what's blocking) 3) Checkpoint Details (user-facing content) 4) Awaiting (what's needed from user)

Orchestrator parses → presents to user → spawns fresh continuation with your completed tasks state. You will NOT be resumed. In main context: use checkpoint_protocol above.
</step>

<step name="verification_failure_gate">
If verification fails: STOP. Present: "Verification failed for Task [X]: [name]. Expected: [criteria]. Actual: [result]." Options: Retry | Skip (mark incomplete) | Stop (investigate). If skipped → SUMMARY "Issues Encountered".

**On review failure (WIRE-07):** If the task sub-issue was already moved to "Done", reopen and move back:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github reopen-issue $TASK_SUB_ISSUE_NUMBER
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number $TASK_SUB_ISSUE_NUMBER --status "In Progress"
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Review Failure

Verification failed for this task. Moving back to In Progress.

**Reason:** {failure details}
**Action needed:** {what needs to be fixed}
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $TASK_SUB_ISSUE_NUMBER --body-file "$TMPFILE"
```
</step>

<step name="record_completion_time">
```bash
PLAN_END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
PLAN_END_EPOCH=$(date +%s)

DURATION_SEC=$(( PLAN_END_EPOCH - PLAN_START_EPOCH ))
DURATION_MIN=$(( DURATION_SEC / 60 ))

if [[ $DURATION_MIN -ge 60 ]]; then
  HRS=$(( DURATION_MIN / 60 ))
  MIN=$(( DURATION_MIN % 60 ))
  DURATION="${HRS}h ${MIN}m"
else
  DURATION="${DURATION_MIN} min"
fi
```
</step>

<step name="generate_user_setup">
If plan frontmatter contains a `user_setup` field: create `{phase}-USER-SETUP.md` using template `~/.claude/maxsim/templates/user-setup.md`. Per service: env vars table, account setup checklist, dashboard config, local dev notes, verification commands. Status "Incomplete". Set `USER_SETUP_CREATED=true`. If empty/missing: skip.

Also post a reminder comment on the phase issue:
```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## User Setup Required

This plan created a USER-SETUP.md with manual steps needed before proceeding.

**File:** {phase}-USER-SETUP.md
**Services:** {list of services requiring setup}
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE"
```
</step>

<step name="create_summary">

## Post Summary as GitHub Comment (WIRE-02)

Do NOT write a local SUMMARY.md file to `.planning/phases/`. Instead, build the summary content in memory and post it as a GitHub comment.

Build summary content using the same structure as `~/.claude/maxsim/templates/summary.md`:

**Content to include:**
- `<!-- maxsim:type=summary -->` HTML marker at the top (required for detection)
- Frontmatter: phase, plan, subsystem, tags | requires/provides/affects | tech-stack.added/patterns | key-files.created/modified | key-decisions | requirements-completed (MUST copy `requirements` array from plan frontmatter verbatim) | duration ($DURATION), completed ($PLAN_END_TIME date)
- Title: `# Phase [X] Plan [Y]: [Name] Summary`
- One-liner SUBSTANTIVE: "JWT auth with refresh rotation using jose library" not "Authentication implemented"
- Duration, start/end times, task count, file count
- Next: more plans → "Ready for {next-plan}" | last → "Phase complete, ready for transition"
- Deviations section (required, even if "None")
- Review Cycle section (added after review cycle completes)
- Self-Check result

Post to the phase issue:
```bash
TMPFILE=$(mktemp)
echo "$SUMMARY_CONTENT" > "$TMPFILE"
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type summary
```

Record the comment URL/ID as `SUMMARY_COMMENT_ID` for future reference.

GitHub Issues is the source of truth -- summaries are always posted as GitHub comments.
</step>

<step name="review_cycle">
## Execute-Review-Simplify-Review Cycle

After implementation is complete and summary is drafted (not yet posted), run the full review cycle before posting. All four stages must pass before the plan is considered done.

### Retry Counter Initialization

```
SPEC_ATTEMPTS=0
CODE_ATTEMPTS=0
SIMPLIFY_ATTEMPTS=0
FINAL_ATTEMPTS=0
MAX_REVIEW_ATTEMPTS=3
REVIEW_ESCALATIONS=0
REVIEW_ESCALATION_DETAILS=""
REVIEW_CYCLE_START=$(date +%s)
```

---

### Stage 1: Spec Review — Verify implementation matches plan spec.

```
SPEC_STAGE_START=$(date +%s)
SPEC_RESULT="PENDING"
```

**Retry loop (max MAX_REVIEW_ATTEMPTS):**

1. Increment `SPEC_ATTEMPTS`
2. Spawn verifier:

```
Task(
  subagent_type="verifier",
  prompt="
    ## Task: Review for spec compliance

    ## Suggested Skills: verification-gates, evidence-collection

    <objective>
    Review plan {phase}-{plan} for spec compliance.
    </objective>

    <plan_spec>
    Plan content: {plan_content_in_memory or plan file path: {phase_dir}/{phase}-{plan}-PLAN.md}
    Summary content: {summary_content_in_memory}
    </plan_spec>

    <task_specs>
    {For each task in the plan: task number, name, done criteria, files modified}
    </task_specs>

    <files_modified>
    {List all files created/modified during execution from summary key-files}
    </files_modified>

    <instructions>
    1. Read the plan content and extract every task requirement
    2. For each requirement, verify the implementation exists and matches the spec
    3. Check that nothing was added beyond scope
    4. Report: PASS (all requirements met) or FAIL (list unmet requirements)
    </instructions>
  "
)
```

3. **If PASS:** Set `SPEC_RESULT="PASS"`, record `SPEC_STAGE_END=$(date +%s)`, proceed to Stage 2.

4. **If FAIL and SPEC_ATTEMPTS < MAX_REVIEW_ATTEMPTS:** Fix the unmet requirements identified by the verifier, re-stage and commit fixes (`fix({phase}-{plan}): address spec review findings`), update summary content in memory, then loop back to step 1.

5. **If FAIL and SPEC_ATTEMPTS >= MAX_REVIEW_ATTEMPTS:** Escalate to user:

```markdown
## Review Escalation: Spec Review Failed After 3 Attempts

**Stage:** Spec Review
**Attempts:** 3/3
**Last failure reason:** {failure details from verifier}

The spec review has failed 3 times. This may indicate a fundamental mismatch between the plan spec and the implementation.

**Options:**
1. Fix manually and type "retry" to re-run spec review (resets attempt counter)
2. Type "override" to skip spec review (will be flagged in summary)
3. Type "abort" to stop execution
```

Wait for user response:
- **"retry":** Reset `SPEC_ATTEMPTS=0`, loop back to step 1.
- **"override":** Set `SPEC_RESULT="OVERRIDDEN"`, increment `REVIEW_ESCALATIONS`, record `SPEC_STAGE_END=$(date +%s)`, proceed to Stage 2.
- **"abort":** Stop execution, post partial summary with review status.

---

### Stage 2: Code Review — Check code quality, security, error handling.

```
CODE_STAGE_START=$(date +%s)
CODE_RESULT="PENDING"
```

**Retry loop (max MAX_REVIEW_ATTEMPTS):**

1. Increment `CODE_ATTEMPTS`
2. Spawn verifier:

```
Task(
  subagent_type="verifier",
  prompt="
    ## Task: Review code quality

    ## Suggested Skills: code-review

    <objective>
    Review plan {phase}-{plan} code quality. Spec compliance already verified.
    </objective>

    <files_modified>
    {List all files created/modified during execution from summary key-files}
    </files_modified>

    <instructions>
    1. Read CLAUDE.md for project conventions
    2. Review every modified file for: correctness, conventions, error handling, security, maintainability
    3. Categorize findings: BLOCKER (must fix), HIGH (should fix), MEDIUM (file for follow-up)
    4. Report: APPROVED (no blockers/high) or BLOCKED (list blocking issues)
    </instructions>
  "
)
```

3. **If APPROVED:** Set `CODE_RESULT="APPROVED"`, record `CODE_STAGE_END=$(date +%s)`, proceed to Stage 3.

4. **If BLOCKED and CODE_ATTEMPTS < MAX_REVIEW_ATTEMPTS:** Fix all blocker and high-severity issues, re-stage and commit fixes (`fix({phase}-{plan}): address code review findings`), then loop back to step 1.

5. **If BLOCKED and CODE_ATTEMPTS >= MAX_REVIEW_ATTEMPTS:** Escalate to user:

```markdown
## Review Escalation: Code Review Failed After 3 Attempts

**Stage:** Code Review
**Attempts:** 3/3
**Last failure reason:** {blocking issues from verifier}

The code review has been blocked 3 times. Remaining issues may require architectural changes or user guidance.

**Options:**
1. Fix manually and type "retry" to re-run code review (resets attempt counter)
2. Type "override" to skip code review (will be flagged in summary)
3. Type "abort" to stop execution
```

Wait for user response:
- **"retry":** Reset `CODE_ATTEMPTS=0`, loop back to step 1.
- **"override":** Set `CODE_RESULT="OVERRIDDEN"`, increment `REVIEW_ESCALATIONS`, record `CODE_STAGE_END=$(date +%s)`, proceed to Stage 3.
- **"abort":** Stop execution, post partial summary with review status.

**On review failure -- reopen affected task sub-issues (WIRE-07):**

If the code review identifies failures tied to specific tasks, and those task sub-issues were already closed:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github reopen-issue $TASK_SUB_ISSUE_NUMBER
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --issue-number $TASK_SUB_ISSUE_NUMBER --status "In Progress"
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
## Code Review Failure

This task's code review was blocked. Moving back to In Progress.

**Blocking issues:**
{list of blocker/high issues from verifier}
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $TASK_SUB_ISSUE_NUMBER --body-file "$TMPFILE"
```

---

### Stage 3: Simplify — Config-gated, spawn 3 parallel reviewers.

**Config gate check:**
```bash
SIMPLIFY_ENABLED=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs config-get review.simplify_review 2>/dev/null || echo "true")
```

**If `SIMPLIFY_ENABLED` is "false":** Skip Stage 3 and Stage 4 entirely. Log: "Simplify stage skipped (disabled in config)". Set `SIMPLIFY_RESULT="SKIPPED"`, `FINAL_RESULT="N/A"`. Proceed to review cycle tracking.

**If `SIMPLIFY_ENABLED` is "true" (default):**

```
SIMPLIFY_STAGE_START=$(date +%s)
SIMPLIFY_RESULT="PENDING"
SIMPLIFY_ATTEMPTS=0
```

**Reviewer 1 -- Code Reuse:**

```
Task(
  subagent_type="verifier",
  prompt="
    ## Task: Review for code reuse opportunities

    ## Suggested Skills: code-review

    <objective>
    Review plan {phase}-{plan} for code reuse opportunities.
    </objective>

    <files_to_review>
    {List all files created/modified during execution from summary key-files}
    </files_to_review>

    <instructions>
    1. Scan all changed files for duplicated patterns
    2. Cross-reference against existing shared utilities and helpers
    3. Flag any logic that appears 3+ times without extraction
    4. Check if existing utilities could replace new code
    5. Output: list of reuse opportunities with file paths and line ranges
    6. Verdict: CLEAN (no issues) or ISSUES_FOUND (list)
    </instructions>
  "
)
```

**Reviewer 2 -- Code Quality:**

```
Task(
  subagent_type="verifier",
  prompt="
    ## Task: Review for code quality issues

    ## Suggested Skills: code-review

    <objective>
    Review plan {phase}-{plan} for code quality issues.
    </objective>

    <files_to_review>
    {List all files created/modified during execution from summary key-files}
    </files_to_review>

    <instructions>
    1. Check naming consistency with codebase conventions
    2. Verify error handling covers all external calls
    3. Look for dead code: unused imports, unreachable branches, commented-out code
    4. Check for unnecessary abstractions or premature generalizations
    5. Output: list of quality issues categorized by severity (BLOCKER/HIGH/MEDIUM)
    6. Verdict: CLEAN (no issues) or ISSUES_FOUND (list)
    </instructions>
  "
)
```

**Reviewer 3 -- Efficiency:**

```
Task(
  subagent_type="verifier",
  prompt="
    ## Task: Review for efficiency issues

    ## Suggested Skills: code-review

    <objective>
    Review plan {phase}-{plan} for efficiency issues.
    </objective>

    <files_to_review>
    {List all files created/modified during execution from summary key-files}
    </files_to_review>

    <instructions>
    1. Find over-engineered solutions (parametrization serving one case, generic interfaces with one implementor)
    2. Identify repeated computations that could be cached or hoisted
    3. Check for unnecessary allocations in hot paths
    4. Look for redundant data transformations
    5. Output: list of efficiency issues with suggested removals
    6. Verdict: CLEAN (no issues) or ISSUES_FOUND (list)
    </instructions>
  "
)
```

**Consolidation (after all 3 reviewers complete):**

After all three reviewers report:
- If ALL returned CLEAN: Set `SIMPLIFY_RESULT="CLEAN"`, record `SIMPLIFY_STAGE_END=$(date +%s)`, skip Stage 4. Set `FINAL_RESULT="N/A"`.
- If ANY returned ISSUES_FOUND:
  1. Increment `SIMPLIFY_ATTEMPTS`
  2. Merge findings into deduplicated list
  3. Spawn single executor to apply fixes:

```
Task(
  subagent_type="executor",
  prompt="
    <objective>
    Apply simplification fixes for plan {phase}-{plan} based on reviewer findings.
    </objective>

    <findings>
    {Merged deduplicated list of ISSUES_FOUND from all reviewers — BLOCKER and HIGH first, skip speculative optimizations}
    </findings>

    <files_to_review>
    {List all files created/modified during execution from summary key-files}
    </files_to_review>

    <instructions>
    1. Apply fixes for all actionable items (BLOCKER and HIGH severity first)
    2. Skip speculative optimizations that lack clear evidence
    3. Run tests to confirm fixes do not break anything
    4. Report: FIXED (issues found and resolved) or BLOCKED (cannot fix without architectural change)
    </instructions>
  "
)
```

4. **If FIXED:** Set `SIMPLIFY_RESULT="FIXED"`, record `SIMPLIFY_STAGE_END=$(date +%s)`, proceed to Stage 4.

5. **If BLOCKED and SIMPLIFY_ATTEMPTS < MAX_REVIEW_ATTEMPTS:** Re-run the 3 reviewers to find alternative fixes, then loop.

6. **If BLOCKED and SIMPLIFY_ATTEMPTS >= MAX_REVIEW_ATTEMPTS:** Escalate to user:

```markdown
## Review Escalation: Simplify Stage Blocked After 3 Attempts

**Stage:** Simplify
**Attempts:** 3/3
**Last failure reason:** {architectural issues from executor}

The simplify stage has been blocked 3 times. Remaining issues require architectural changes.

**Options:**
1. Fix manually and type "retry" to re-run simplify (resets attempt counter)
2. Type "override" to skip simplify (will be flagged in summary)
3. Type "abort" to stop execution
```

Wait for user response:
- **"retry":** Reset `SIMPLIFY_ATTEMPTS=0`, re-run 3 reviewers.
- **"override":** Set `SIMPLIFY_RESULT="OVERRIDDEN"`, increment `REVIEW_ESCALATIONS`, record `SIMPLIFY_STAGE_END=$(date +%s)`, skip Stage 4. Set `FINAL_RESULT="N/A"`.
- **"abort":** Stop execution, post partial summary with review status.

---

### Stage 4: Final Review — If simplify made changes, one more code review pass.

Run this stage ONLY if Stage 3 reported FIXED (i.e., simplify found and applied fixes). If Stage 3 was CLEAN, SKIPPED, or OVERRIDDEN: set `FINAL_RESULT="N/A"`, skip to review cycle tracking.

```
FINAL_STAGE_START=$(date +%s)
FINAL_RESULT="PENDING"
```

**Retry loop (max MAX_REVIEW_ATTEMPTS):**

1. Increment `FINAL_ATTEMPTS`
2. Spawn verifier:

```
Task(
  subagent_type="verifier",
  prompt="
    ## Task: Final review after simplification

    ## Suggested Skills: code-review

    <objective>
    Final review pass after simplification changes on plan {phase}-{plan}.
    Verify simplification fixes did not introduce regressions.
    </objective>

    <context>
    Previous code review: APPROVED
    Simplification: FIXED — changes were applied
    This is a focused re-review of simplification changes only.
    </context>

    <files_modified>
    {List files changed by simplification stage}
    </files_modified>

    <instructions>
    1. Review only the changes made during simplification
    2. Verify no regressions were introduced
    3. Check that simplification changes follow project conventions
    4. Report: APPROVED or BLOCKED (list issues)
    </instructions>
  "
)
```

3. **If APPROVED:** Set `FINAL_RESULT="APPROVED"`, record `FINAL_STAGE_END=$(date +%s)`, proceed to review cycle tracking.

4. **If BLOCKED and FINAL_ATTEMPTS < MAX_REVIEW_ATTEMPTS:** Fix issues, re-stage and commit fixes (`fix({phase}-{plan}): address final review findings`), then loop back to step 1.

5. **If BLOCKED and FINAL_ATTEMPTS >= MAX_REVIEW_ATTEMPTS:** Escalate to user:

```markdown
## Review Escalation: Final Review Blocked After 3 Attempts

**Stage:** Final Review
**Attempts:** 3/3
**Last failure reason:** {blocking issues from verifier}

The final review has been blocked 3 times after simplification changes.

**Options:**
1. Fix manually and type "retry" to re-run final review (resets attempt counter)
2. Type "override" to skip final review (will be flagged in summary)
3. Type "abort" to stop execution
```

Wait for user response:
- **"retry":** Reset `FINAL_ATTEMPTS=0`, loop back to step 1.
- **"override":** Set `FINAL_RESULT="OVERRIDDEN"`, increment `REVIEW_ESCALATIONS`, record `FINAL_STAGE_END=$(date +%s)`, proceed to review cycle tracking.
- **"abort":** Stop execution, post partial summary with review status.

---

### Review Cycle Tracking

```
REVIEW_CYCLE_END=$(date +%s)
REVIEW_CYCLE_TOTAL=$(( REVIEW_CYCLE_END - REVIEW_CYCLE_START ))
```

Calculate per-stage durations:
```
SPEC_DURATION=$(( SPEC_STAGE_END - SPEC_STAGE_START ))
CODE_DURATION=$(( CODE_STAGE_END - CODE_STAGE_START ))
# Only if simplify ran:
SIMPLIFY_DURATION=$(( SIMPLIFY_STAGE_END - SIMPLIFY_STAGE_START ))  # or "N/A" if skipped
# Only if final review ran:
FINAL_DURATION=$(( FINAL_STAGE_END - FINAL_STAGE_START ))  # or "N/A" if skipped
```

Add review cycle results to the summary content in memory (under a `## Review Cycle` section):
```markdown
## Review Cycle

| Stage | Result | Attempts | Duration | Findings |
|-------|--------|----------|----------|----------|
| Spec Review | {PASS|FAIL|OVERRIDDEN} | {SPEC_ATTEMPTS}/3 | {SPEC_DURATION}s | {summary or "All requirements met"} |
| Code Review | {APPROVED|BLOCKED|OVERRIDDEN} | {CODE_ATTEMPTS}/3 | {CODE_DURATION}s | {summary or "No blocking issues"} |
| Simplify | {CLEAN|FIXED|BLOCKED|SKIPPED|OVERRIDDEN} | {SIMPLIFY_ATTEMPTS}/3 | {SIMPLIFY_DURATION}s | {summary or "N/A"} |
| Final Review | {APPROVED|BLOCKED|SKIPPED|N/A|OVERRIDDEN} | {FINAL_ATTEMPTS}/3 | {FINAL_DURATION}s | {summary or "N/A"} |

**Total review time:** {REVIEW_CYCLE_TOTAL}s
**Escalations:** {REVIEW_ESCALATIONS} ({REVIEW_ESCALATION_DETAILS or "None"})
```

Now post the complete summary (with review cycle included) to GitHub:
```bash
TMPFILE=$(mktemp)
echo "$COMPLETE_SUMMARY_CONTENT" > "$TMPFILE"
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type summary
```

After posting, commit any review-cycle metadata:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs({phase}-{plan}): add review cycle results" --files .planning/STATE.md .planning/ROADMAP.md
```
</step>

<step name="evidence_gate">
**Gate G6: Evidence Completeness** — Summary must have evidence for each requirement.

After the review cycle and before finalizing, validate that the summary content contains requirement evidence for all requirements in the plan's frontmatter.

```bash
if [ -n "$REQ_IDS" ]; then
  # Write summary content to a temp file for verification
  echo "$SUMMARY_CONTENT" > /tmp/summary-check.md
  G6_RESULT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs verify evidence-completeness "/tmp/summary-check.md" $REQ_IDS)
  G6_VALID=$(echo "$G6_RESULT" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).valid))")
  if [ "$G6_VALID" != "true" ]; then
    G6_MISSING=$(echo "$G6_RESULT" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).missing_evidence.join(', ')))")
    echo "GATE G6: Missing requirement evidence for: $G6_MISSING"
    echo "Add Requirement Evidence rows to summary for these requirements before posting."
    # Present as warning with instruction to fix — executor should add evidence
  fi
fi
```
</step>

<step name="update_current_position">
Update STATE.md using maxsim-tools:

```bash
# Advance plan counter (handles last-plan edge case)
node ~/.claude/maxsim/bin/maxsim-tools.cjs state advance-plan

# Recalculate progress bar from disk state
node ~/.claude/maxsim/bin/maxsim-tools.cjs state update-progress

# Record execution metrics
node ~/.claude/maxsim/bin/maxsim-tools.cjs state record-metric \
  --phase "${PHASE}" --plan "${PLAN}" --duration "${DURATION}" \
  --tasks "${TASK_COUNT}" --files "${FILE_COUNT}"
```
</step>

<step name="extract_decisions_and_issues">
From summary content: Extract decisions and add to STATE.md:

```bash
# Add each decision from summary key-decisions
# Prefer file inputs for shell-safe text (preserves `$`, `*`, etc. exactly)
node ~/.claude/maxsim/bin/maxsim-tools.cjs state add-decision \
  --phase "${PHASE}" --summary-file "${DECISION_TEXT_FILE}" --rationale-file "${RATIONALE_FILE}"

# Add blockers if any found
node ~/.claude/maxsim/bin/maxsim-tools.cjs state add-blocker --text-file "${BLOCKER_TEXT_FILE}"
```
</step>

<step name="update_session_continuity">
Update session info using maxsim-tools:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs state record-session \
  --stopped-at "Completed ${PHASE}-${PLAN}-PLAN.md" \
  --resume-file "None"
```

Keep STATE.md under 150 lines.
</step>

<step name="issues_review_gate">
If summary "Issues Encountered" ≠ "None": yolo → log and continue. Interactive → present issues, wait for acknowledgment.
</step>

<step name="update_roadmap">
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap update-plan-progress "${PHASE}"
```
Counts completed task sub-issues (or PLAN vs SUMMARY files in fallback mode) on disk. Updates progress table row with correct count and status (`In Progress` or `Complete` with date).
</step>

<step name="update_requirements">
Mark completed requirements from the plan's frontmatter `requirements:` field:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs requirements mark-complete ${REQ_IDS}
```

Extract requirement IDs from the plan frontmatter (e.g., `requirements: [AUTH-01, AUTH-02]`). If no requirements field, skip.
</step>

<step name="git_commit_metadata">
Task code already committed per-task. Commit plan metadata:

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "docs({phase}-{plan}): complete [plan-name] plan" --files .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md
```

Note: No local SUMMARY.md is committed -- summary was posted to GitHub as a comment.
</step>

<step name="post_verification_to_github">

## Post Verification Results as GitHub Comment

If the plan includes verification criteria (from `<verification>` section of plan content):

Build verification results content in memory with `<!-- maxsim:type=verification -->` marker.

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
<!-- maxsim:type=verification -->
## Plan {plan_number} Verification

{verification_results}

**Status:** {passed|failed}
**Timestamp:** {ISO timestamp}
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type verification
```

If the plan includes UAT criteria (from `<uat>` section):

```bash
TMPFILE=$(mktemp)
cat > "$TMPFILE" << 'BODY_EOF'
<!-- maxsim:type=uat -->
## Plan {plan_number} UAT

{uat_criteria_and_results}

**Status:** {pending|passed|failed}
**Timestamp:** {ISO timestamp}
BODY_EOF
node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number $PHASE_ISSUE_NUMBER --body-file "$TMPFILE" --type uat
```

GitHub Issues is the source of truth -- verification and UAT results are always posted as GitHub comments.
</step>

<step name="update_codebase_map">
If .planning/codebase/ doesn't exist: skip.

```bash
FIRST_TASK=$(git log --oneline --grep="feat({phase}-{plan}):" --grep="fix({phase}-{plan}):" --grep="test({phase}-{plan}):" --reverse | head -1 | cut -d' ' -f1)
git diff --name-only ${FIRST_TASK}^..HEAD 2>/dev/null
```

Update only structural changes: new src/ dir → STRUCTURE.md | deps → STACK.md | file pattern → CONVENTIONS.md | API client → INTEGRATIONS.md | config → STACK.md | renamed → update paths. Skip code-only/bugfix/content changes.

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs commit "" --files .planning/codebase/*.md --amend
```
</step>

<step name="offer_next">
If `USER_SETUP_CREATED=true`: display `⚠️ USER SETUP REQUIRED` with path + env/config tasks at TOP.

Check completion by querying the phase issue's task sub-issues:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github list-sub-issues $PHASE_ISSUE_NUMBER
```

Count open vs closed sub-issues. Map closed count to plans complete.

| Condition | Route | Action |
|-----------|-------|--------|
| open task sub-issues remain | **A: More plans** | Find next incomplete plan (by open sub-issues or missing summary comment). Yolo: auto-continue. Interactive: show next plan, suggest `/maxsim:execute {phase}`. STOP here. |
| all sub-issues closed, current < highest phase | **B: Phase done** | Show completion, suggest `/maxsim:plan {Z+1}`. |
| all sub-issues closed, current = highest phase | **C: Milestone done** | Show banner, suggest `/maxsim:progress`. |

All routes: `/clear` first for fresh context.
</step>

</process>

<success_criteria>

- All tasks from plan completed
- All verifications pass
- USER-SETUP.md generated if user_setup in frontmatter
- Summary posted as GitHub comment with `<!-- maxsim:type=summary -->` marker (not written to local SUMMARY.md)
- Verification and UAT posted as GitHub comments with appropriate type markers
- Task sub-issues moved: In Progress when started, Done when completed (WIRE-04)
- On review failure: task sub-issues reopened and moved back to In Progress (WIRE-07)
- STATE.md updated (position, decisions, issues, session)
- ROADMAP.md updated
- If codebase map exists: map updated with execution changes (or skipped if no significant changes)
- If USER-SETUP.md created: prominently surfaced in completion output
</success_criteria>
