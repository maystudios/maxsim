<sanity_check>
Before executing any step in this workflow, verify:
1. The current directory contains a `.planning/` folder — if not, stop and tell the user to run `/maxsim:init` first.
2. `.planning/ROADMAP.md` exists — if not, stop and tell the user to initialize the project.
</sanity_check>

<purpose>
Verify phase goal achievement through goal-backward analysis. Check that the codebase delivers what the phase promised, not just that tasks completed. Posts verification results as GitHub comments on the phase issue (no local VERIFICATION.md or UAT.md files are written).

Executed by a verification subagent spawned from execute-phase.md.
</purpose>

<core_principle>
**Task completion ≠ Goal achievement**

A task "create chat component" can be marked complete when the component is a placeholder. The task was done — but the goal "working chat interface" was not achieved.

Goal-backward verification:
1. What must be TRUE for the goal to be achieved?
2. What must EXIST for those truths to hold?
3. What must be WIRED for those artifacts to function?

Then verify each level against the actual codebase.
</core_principle>

<required_reading>
@~/.claude/maxsim/references/verification-patterns.md
@~/.claude/maxsim/templates/verification-report.md
</required_reading>

<process>

<step name="load_context" priority="first">
Load phase operation context:

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init phase-op "${PHASE_ARG}")
```

Extract from init JSON: `phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`.

Then load phase details:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap get-phase "${phase_number}"
grep -E "^| ${phase_number}" .planning/REQUIREMENTS.md 2>/dev/null
```

**Get the phase issue number from GitHub (live):**

Run `github all-progress` and find the entry where `phase_number` matches. Extract `issue_number` — this is used for posting all verification results as GitHub comments.

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github all-progress
```

Extract **phase goal** from ROADMAP.md (the outcome to verify, not tasks) and **requirements** from REQUIREMENTS.md if it exists.
</step>

<step name="establish_must_haves">
**Option A: Must-haves in PLAN frontmatter**

Use maxsim-tools to extract must_haves from each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  MUST_HAVES=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs frontmatter get "$plan" --field must_haves)
  echo "=== $plan ===" && echo "$MUST_HAVES"
done
```

Returns JSON: `{ truths: [...], artifacts: [...], key_links: [...] }`

Aggregate all must_haves across plans for phase-level verification.

**Option B: Use Success Criteria from ROADMAP.md**

If no must_haves in frontmatter (MUST_HAVES returns error or empty), check for Success Criteria:

```bash
PHASE_DATA=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap get-phase "${phase_number}" --raw)
```

Parse the `success_criteria` array from the JSON output. If non-empty:
1. Use each Success Criterion directly as a **truth** (they are already written as observable, testable behaviors)
2. Derive **artifacts** (concrete file paths for each truth)
3. Derive **key links** (critical wiring where stubs hide)
4. Document the must-haves before proceeding

Success Criteria from ROADMAP.md are the contract — they override PLAN-level must_haves when both exist.

**Option C: Derive from phase goal (fallback)**

If no must_haves in frontmatter AND no Success Criteria in ROADMAP:
1. State the goal from ROADMAP.md
2. Derive **truths** (3-7 observable behaviors, each testable)
3. Derive **artifacts** (concrete file paths for each truth)
4. Derive **key links** (critical wiring where stubs hide)
5. Document derived must-haves before proceeding
</step>

<step name="verify_truths">
For each observable truth, determine if the codebase enables it.

**Status:** ✓ VERIFIED (all supporting artifacts pass) | ✗ FAILED (artifact missing/stub/unwired) | ? UNCERTAIN (needs human)

For each truth: identify supporting artifacts → check artifact status → check wiring → determine truth status.

**Example:** Truth "User can see existing messages" depends on Chat.tsx (renders), /api/chat GET (provides), Message model (schema). If Chat.tsx is a stub or API returns hardcoded [] → FAILED. If all exist, are substantive, and connected → VERIFIED.
</step>

<step name="verify_artifacts">
Use maxsim-tools for artifact verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  ARTIFACT_RESULT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs verify artifacts "$plan")
  echo "=== $plan ===" && echo "$ARTIFACT_RESULT"
done
```

Parse JSON result: `{ all_passed, passed, total, artifacts: [{path, exists, issues, passed}] }`

**Artifact status from result:**
- `exists=false` → MISSING
- `issues` not empty → STUB (check issues for "Only N lines" or "Missing pattern")
- `passed=true` → VERIFIED (Levels 1-2 pass)

**Level 3 — Wired (manual check for artifacts that pass Levels 1-2):**
```bash
grep -r "import.*$artifact_name" src/ --include="*.ts" --include="*.tsx"  # IMPORTED
grep -r "$artifact_name" src/ --include="*.ts" --include="*.tsx" | grep -v "import"  # USED
```
WIRED = imported AND used. ORPHANED = exists but not imported/used.

| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| ✓ | ✓ | ✓ | ✓ VERIFIED |
| ✓ | ✓ | ✗ | ⚠️ ORPHANED |
| ✓ | ✗ | - | ✗ STUB |
| ✗ | - | - | ✗ MISSING |
</step>

<step name="verify_wiring">
Use maxsim-tools for key link verification against must_haves in each PLAN:

```bash
for plan in "$PHASE_DIR"/*-PLAN.md; do
  LINKS_RESULT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs verify key-links "$plan")
  echo "=== $plan ===" && echo "$LINKS_RESULT"
done
```

Parse JSON result: `{ all_verified, verified, total, links: [{from, to, via, verified, detail}] }`

**Link status from result:**
- `verified=true` → WIRED
- `verified=false` with "not found" → NOT_WIRED
- `verified=false` with "Pattern not found" → PARTIAL

**Fallback patterns (if key_links not in must_haves):**

| Pattern | Check | Status |
|---------|-------|--------|
| Component → API | fetch/axios call to API path, response used (await/.then/setState) | WIRED / PARTIAL (call but unused response) / NOT_WIRED |
| API → Database | Prisma/DB query on model, result returned via res.json() | WIRED / PARTIAL (query but not returned) / NOT_WIRED |
| Form → Handler | onSubmit with real implementation (fetch/axios/mutate/dispatch), not console.log/empty | WIRED / STUB (log-only/empty) / NOT_WIRED |
| State → Render | useState variable appears in JSX (`{stateVar}` or `{stateVar.property}`) | WIRED / NOT_WIRED |

Record status and evidence for each key link.
</step>

<step name="verify_requirements">
If REQUIREMENTS.md exists:
```bash
grep -E "Phase ${PHASE_NUM}" .planning/REQUIREMENTS.md 2>/dev/null
```

For each requirement: parse description → identify supporting truths/artifacts → status: ✓ SATISFIED / ✗ BLOCKED / ? NEEDS HUMAN.
</step>

<step name="scan_antipatterns">
Extract files modified in this phase from local plan files, scan each:

| Pattern | Search | Severity |
|---------|--------|----------|
| TODO/FIXME/XXX/HACK | `grep -n -E "TODO\|FIXME\|XXX\|HACK"` | ⚠️ Warning |
| Placeholder content | `grep -n -iE "placeholder\|coming soon\|will be here"` | 🛑 Blocker |
| Empty returns | `grep -n -E "return null\|return \{\}\|return \[\]\|=> \{\}"` | ⚠️ Warning |
| Log-only functions | Functions containing only console.log | ⚠️ Warning |

Categorize: 🛑 Blocker (prevents goal) | ⚠️ Warning (incomplete) | ℹ️ Info (notable).
</step>

<step name="identify_human_verification">
**Always needs human:** Visual appearance, user flow completion, real-time behavior (WebSocket/SSE), external service integration, performance feel, error message clarity.

**Needs human if uncertain:** Complex wiring grep can't trace, dynamic state-dependent behavior, edge cases.

Format each as: Test Name → What to do → Expected result → Why can't verify programmatically.
</step>

<step name="determine_status">
**passed:** All truths VERIFIED, all artifacts pass levels 1-3, all key links WIRED, no blocker anti-patterns.

**gaps_found:** Any truth FAILED, artifact MISSING/STUB, key link NOT_WIRED, or blocker found.

**human_needed:** All automated checks pass but human verification items remain.

**Score:** `verified_truths / total_truths`
</step>

<step name="generate_fix_plans">
If gaps_found:

1. **Cluster related gaps:** API stub + component unwired → "Wire frontend to backend". Multiple missing → "Complete core implementation". Wiring only → "Connect existing components".

2. **Generate plan per cluster:** Objective, 2-3 tasks (files/action/verify each), re-verify step. Keep focused: single concern per plan.

3. **Order by dependency:** Fix missing → fix stubs → fix wiring → verify.
</step>

<step name="post_verification_to_github">
**Post verification results as a GitHub comment (primary output — no local file written).**

Build the verification content in memory using the same structured format as the verification report template. Then run `github post-comment` with `type: 'verification'` on the phase issue.

Write the body content to a tmpfile first, then post:

```bash
# Write body to tmpfile (JSON with status, score, phase, timestamp, truths_checked, artifacts_verified, etc.)
BODY_FILE=$(mktemp)
cat > "$BODY_FILE" << 'VERIFICATION_EOF'
{
  "status": "passed | gaps_found | human_needed",
  "score": "{verified}/{total}",
  "phase": "{phase_number} — {phase_name}",
  "timestamp": "{ISO timestamp}",
  "truths_checked": [
    { "truth": "...", "status": "VERIFIED | FAILED | UNCERTAIN", "evidence": "..." }
  ],
  "artifacts_verified": [
    { "path": "...", "exists": true, "substantive": true, "wired": true, "status": "VERIFIED | STUB | MISSING | ORPHANED" }
  ],
  "key_links_validated": [
    { "from": "...", "to": "...", "via": "...", "status": "WIRED | PARTIAL | NOT_WIRED" }
  ],
  "antipatterns": [
    { "file": "...", "line": 0, "pattern": "...", "severity": "Blocker | Warning | Info" }
  ],
  "human_verification_items": [
    { "name": "...", "steps": "...", "expected": "...", "reason": "..." }
  ],
  "gaps": [
    { "description": "...", "fix_plan": "..." }
  ],
  "fix_plans": [
    { "name": "...", "objective": "...", "tasks": ["..."] }
  ]
}
VERIFICATION_EOF

node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number {PHASE_ISSUE_NUMBER} --body-file "$BODY_FILE" --type verification
```

The comment is the canonical record of this verification run.
</step>

<step name="run_uat">
**User Acceptance Testing (UAT):**

Present the human verification items to the user and walk through each one. After the user completes UAT:

Build the UAT results in memory, then post as a GitHub comment by running `github post-comment` with `type: 'uat'` on the phase issue:

```bash
# Write UAT body to tmpfile
UAT_FILE=$(mktemp)
cat > "$UAT_FILE" << 'UAT_EOF'
{
  "status": "passed | gaps_found",
  "phase": "{phase_number} — {phase_name}",
  "timestamp": "{ISO timestamp}",
  "items": [
    { "name": "...", "result": "pass | fail", "notes": "..." }
  ],
  "gaps": [
    { "description": "...", "severity": "Blocker | Warning" }
  ]
}
UAT_EOF

node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment --issue-number {PHASE_ISSUE_NUMBER} --body-file "$UAT_FILE" --type uat
```

Do NOT write a UAT.md file to `.planning/phases/`.
</step>

<step name="board_transition">
**Update GitHub board based on verification outcome.**

**If verification passes AND PR is merged:**
1. Run `github move-issue` to move the phase issue to the "Done" column on the board
2. Run `github close-issue` to close the phase issue
3. Report to orchestrator: phase complete, issue closed

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --project-number P --item-id ID --status "Done"
node ~/.claude/maxsim/bin/maxsim-tools.cjs github close-issue N
```

**If verification passes but PR not yet merged:**
1. Keep the phase issue in "In Review" on the board
2. Note: board will be updated when PR merges

**If verification fails (gaps_found):**
1. Check current board column for the phase issue
2. If in "In Review": run `github move-issue` to move back to "In Progress"
3. Post failure details as a verification comment (already done in post_verification_to_github step)
4. Note which gaps need fixing before re-verification

```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue --project-number P --item-id ID --status "In Progress"
```

**If human_needed:**
1. Keep the phase issue in its current column (do not move)
2. The UAT comment posted above documents what needs human testing
</step>

<step name="return_to_orchestrator">
Return status (`passed` | `gaps_found` | `human_needed`), score (N/M must-haves), GitHub issue number and comment URL.

If gaps_found: list gaps + recommended fix plan names. Phase issue has been moved back to "In Progress" on the board.
If human_needed: list items requiring human testing. UAT comment posted to GitHub issue.
If passed: phase issue moved to "Done" and closed on GitHub.

Orchestrator routes: `passed` → update_roadmap | `gaps_found` → create/execute fixes, re-verify | `human_needed` → present to user.
</step>

</process>

<success_criteria>
- [ ] Phase issue number retrieved from live GitHub via `github all-progress`
- [ ] Must-haves established (from frontmatter or derived)
- [ ] All truths verified with status and evidence
- [ ] All artifacts checked at all three levels
- [ ] All key links verified
- [ ] Requirements coverage assessed (if applicable)
- [ ] Anti-patterns scanned and categorized
- [ ] Human verification items identified
- [ ] Overall status determined
- [ ] Fix plans generated (if gaps_found)
- [ ] Verification results posted as GitHub comment via `github post-comment` (type: 'verification') — NO local VERIFICATION.md written
- [ ] UAT results posted as GitHub comment via `github post-comment` (type: 'uat') — NO local UAT.md written
- [ ] Board transition executed: `github move-issue` + `github close-issue` on pass; `github move-issue` back to In Progress on fail
- [ ] Results returned to orchestrator
</success_criteria>
</output>
