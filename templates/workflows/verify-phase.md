<purpose>
Verify that a completed phase achieved its GOAL — not just that tasks were marked done. Spawns parallel review agents (security, quality, efficiency), aggregates results into evidence blocks, posts verification results as a GitHub Issue comment, and returns PASS/FAIL to the orchestrator.

Task completion does not equal goal achievement. This workflow checks the codebase against observable, testable criteria.
</purpose>

<core_principle>
Verify goal achievement, not task completion. A task "create chat component" can be marked done when the component is a placeholder. The task is done — the goal "working chat interface" is not.

Evidence-first: every PASS or FAIL verdict must cite specific file paths, line numbers, or command output.
</core_principle>

<process>

## Step 1 — Load Phase Context

```bash
INIT=$(node ~/.claude/maxsim/bin/maxsim-tools.cjs init phase-op "${PHASE_ARG}")
```

Extract: `phase_dir`, `phase_number`, `phase_name`, `has_plans`, `plan_count`.

Get the phase issue number from GitHub:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github all-progress
```
Find entry where `phase_number` matches. Extract `issue_number` — all verification results are posted here as comments.

Load phase goal and requirements:
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs roadmap get-phase "${PHASE_NUMBER}"
```

Extract `success_criteria` array and `goal` from ROADMAP.md. These are the contract.

## Step 2 — Establish Must-Haves

**Priority order:**

1. **Success Criteria from ROADMAP.md** — if `success_criteria` array is non-empty, use it directly. Each criterion is an observable, testable truth. These override plan-level must_haves.

2. **Must-haves from plan frontmatter** — if no ROADMAP success criteria, extract from each plan comment on the phase issue:
   ```bash
   node ~/.claude/maxsim/bin/maxsim-tools.cjs github get-issue \
     --issue-number $PHASE_ISSUE_NUMBER --include-comments
   ```
   For each plan comment, parse frontmatter `must_haves` field: `{ truths, artifacts, key_links }`.

3. **Derive from phase goal (fallback)** — if neither source has must-haves, derive:
   - 3–7 observable truths (each testable without human interaction)
   - Concrete artifact file paths per truth
   - Critical wiring points where stubs commonly hide

Document the must-haves before running any checks.

## Step 3 — Run Automated Checks

### 3a — Detect and run test suite

```bash
# Detect test runner
if [ -f package.json ]; then
  TEST_SCRIPT=$(node -e "const p=require('./package.json'); console.log(p.scripts?.test || '')")
  [ -n "$TEST_SCRIPT" ] && npm test 2>&1
elif [ -f pytest.ini ] || [ -f pyproject.toml ]; then
  python -m pytest 2>&1
elif [ -f Cargo.toml ]; then
  cargo test 2>&1
fi
```

Record: PASS / FAIL + output excerpt (last 30 lines if failure).

### 3b — Detect and run build

```bash
if [ -f package.json ]; then
  BUILD_SCRIPT=$(node -e "const p=require('./package.json'); console.log(p.scripts?.build || '')")
  [ -n "$BUILD_SCRIPT" ] && npm run build 2>&1
elif [ -f Cargo.toml ]; then
  cargo build 2>&1
fi
```

Record: PASS / FAIL + error output.

### 3c — Detect and run linter

```bash
if [ -f biome.json ]; then
  npx biome check . 2>&1 | tail -20
elif [ -f .eslintrc* ] || [ -f eslint.config* ]; then
  npx eslint . 2>&1 | tail -20
elif [ -f .ruff.toml ] || grep -q ruff pyproject.toml 2>/dev/null; then
  ruff check . 2>&1 | tail -20
fi
```

Record: PASS / FAIL + lint violations count.

### 3d — Verify artifacts

For each artifact in must-haves:

| Level | Check | Method |
|-------|-------|--------|
| 1 — Exists | File present on disk | `[ -f {path} ]` |
| 2 — Substantive | File has real content | Line count > threshold, no placeholder patterns |
| 3 — Wired | File is imported and used | `grep -r "import.*{name}" src/` AND used outside import |

Status matrix:
| Exists | Substantive | Wired | Status |
|--------|-------------|-------|--------|
| yes | yes | yes | VERIFIED |
| yes | yes | no | ORPHANED |
| yes | no | — | STUB |
| no | — | — | MISSING |

Scan for anti-patterns in modified files:
```bash
grep -n -E "TODO|FIXME|XXX|HACK" {modified_files} 2>/dev/null
grep -n -iE "placeholder|coming soon|will be here" {modified_files} 2>/dev/null
grep -n -E "return null|return \{\}|return \[\]" {modified_files} 2>/dev/null
```

Categorize: Blocker (prevents goal achievement) or Warning (incomplete but not blocking).

### 3e — Verify key links (wiring)

For each key link in must-haves:

| Pattern | Check |
|---------|-------|
| Component → API | fetch/axios call to API path, response used |
| API → Database | Prisma/DB query on model, result returned |
| Form → Handler | onSubmit with real implementation (not console.log) |
| State → Render | useState variable appears in JSX |

```bash
# Example: component imports and uses API endpoint
grep -r "fetch.*{api_path}\|axios.*{api_path}" src/ --include="*.ts" --include="*.tsx"
```

Record: WIRED / PARTIAL / NOT_WIRED with evidence.

## Step 4 — Spawn Parallel Review Agents

Spawn three review agents simultaneously in a SINGLE message block (foreground, no worktree needed):

```
Agent(
  subagent_type="verifier",
  model="{verifier_model}",
  prompt="
    Security review for phase {phase_number}: {phase_name}.

    Read the files modified in this phase (from summary comments on issue #{phase_issue_number}).
    Check for:
    - Unsanitized user input (injection risks)
    - Exposed secrets or credentials
    - Missing authentication/authorization checks
    - Insecure data handling or transmission
    - Dependency vulnerabilities (if package.json changed)

    Evidence format:
    CLAIM: {what was checked}
    EVIDENCE: {file:line or command run}
    OUTPUT: {actual result}
    VERDICT: PASS | FAIL — {reason}

    Return: SECURITY REVIEW: PASS or SECURITY REVIEW: FAIL — {issues list}
  "
)

Agent(
  subagent_type="verifier",
  model="{verifier_model}",
  prompt="
    Code quality review for phase {phase_number}: {phase_name}.

    Read the files modified in this phase (from summary comments on issue #{phase_issue_number}).
    Check for:
    - Bugs and logical errors
    - Unhandled edge cases and error paths
    - Missing or inadequate error handling
    - Dead code or unreachable branches
    - Overly complex logic that could be simplified

    Evidence format:
    CLAIM: {what was checked}
    EVIDENCE: {file:line or command run}
    OUTPUT: {actual result}
    VERDICT: PASS | FAIL — {reason}

    Return: QUALITY REVIEW: PASS or QUALITY REVIEW: FAIL — {issues list}
  "
)

Agent(
  subagent_type="verifier",
  model="{verifier_model}",
  prompt="
    Efficiency review for phase {phase_number}: {phase_name}.

    Read the files modified in this phase (from summary comments on issue #{phase_issue_number}).
    Check for:
    - Obvious N+1 query patterns
    - Unnecessary re-renders or recomputations
    - Missing memoization for expensive operations
    - Unbounded loops or recursion
    - Large bundle additions without justification

    Evidence format:
    CLAIM: {what was checked}
    EVIDENCE: {file:line or command run}
    OUTPUT: {actual result}
    VERDICT: PASS | FAIL — {reason}

    Return: EFFICIENCY REVIEW: PASS or EFFICIENCY REVIEW: FAIL — {issues list}
  "
)
```

Wait for all three review agents to complete before proceeding.

## Step 5 — Identify Human Verification Items

Some checks cannot be automated. Flag these for human review:

- Visual appearance and layout
- User flow completion (multi-step interactions)
- Real-time behavior (WebSocket, SSE, animations)
- External service integrations
- Performance feel under real conditions
- Accessibility

Format each item:
```
Test: {name}
Steps: {what to do}
Expected: {what should happen}
Why manual: {why automated checks cannot cover this}
```

## Step 6 — Determine Overall Status

**PASS** — All of the following:
- All must-have truths: VERIFIED
- All artifacts: not MISSING or STUB
- All key links: WIRED or ORPHANED (not NOT_WIRED)
- Tests: PASS
- Build: PASS
- Lint: PASS or warnings only (no errors)
- No Blocker anti-patterns
- Security review: PASS
- Quality review: PASS (no blockers)
- Efficiency review: PASS (no blockers)

**FAIL** — Any of:
- Any must-have truth: FAILED
- Any artifact: MISSING or STUB
- Any key link: NOT_WIRED
- Tests: FAIL
- Build: FAIL
- Any Blocker anti-pattern
- Security or Quality review: FAIL with blockers

**HUMAN_NEEDED** — All automated checks PASS but human verification items remain unreviewed.

Score: `{verified_truths}/{total_truths} must-haves verified`

## Step 7 — Post Verification Result to GitHub

Build the verification content in memory and post as a comment. This is the canonical record — no local VERIFICATION.md is written.

```bash
VERIFY_FILE=$(mktemp)
cat > "$VERIFY_FILE" << 'VERIFY_EOF'
---
phase: {phase_number}
plan: all
status: passed | fail | human_needed
score: {verified}/{total}
timestamp: {ISO timestamp}
checks:
  tests: pass | fail | skipped
  build: pass | fail | skipped
  lint: pass | fail | skipped
  security_review: pass | fail
  quality_review: pass | fail
  efficiency_review: pass | fail
---

## Verification: Phase {phase_number} — {phase_name}

**Status:** {PASS | FAIL | HUMAN NEEDED}
**Score:** {verified}/{total} must-haves verified
**Timestamp:** {ISO timestamp}

## Must-Have Verification

| Truth | Status | Evidence |
|-------|--------|----------|
| {truth} | VERIFIED / FAILED / UNCERTAIN | {file:line or command output} |

## Artifact Status

| Artifact | Exists | Substantive | Wired | Status |
|----------|--------|-------------|-------|--------|
| {path} | yes/no | yes/no | yes/no | VERIFIED/STUB/MISSING/ORPHANED |

## Key Links

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| {component} | {api} | fetch | WIRED | {grep output} |

## Automated Checks

| Check | Status | Notes |
|-------|--------|-------|
| Tests | {PASS/FAIL/SKIPPED} | {runner used, error if fail} |
| Build | {PASS/FAIL/SKIPPED} | {error if fail} |
| Lint | {PASS/FAIL/SKIPPED} | {violation count} |
| Security | {PASS/FAIL} | {issues if fail} |
| Quality | {PASS/FAIL} | {blockers if fail} |
| Efficiency | {PASS/FAIL} | {blockers if fail} |

## Anti-Patterns Found

{Blocker anti-patterns with file:line}
{Warning anti-patterns with file:line}
{"None." if clean}

## Human Verification Items

{numbered list of items requiring human testing}
{"None." if fully automated}

## Gaps (if status = fail)

{numbered list of gaps with fix recommendations}

<!-- maxsim:type=verification -->
VERIFY_EOF

node ~/.claude/maxsim/bin/maxsim-tools.cjs github post-comment \
  --issue-number {PHASE_ISSUE_NUMBER} \
  --body-file "$VERIFY_FILE" \
  --type verification
```

## Step 8 — Update Board and Return

**If PASS:**
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $PHASE_ISSUE_NUMBER --status "Done"
node ~/.claude/maxsim/bin/maxsim-tools.cjs github close-issue \
  --issue-number $PHASE_ISSUE_NUMBER
```

**If FAIL:**
```bash
node ~/.claude/maxsim/bin/maxsim-tools.cjs github move-issue \
  --issue-number $PHASE_ISSUE_NUMBER --status "In Progress"
```

**If HUMAN_NEEDED:** Leave issue in current column. The verification comment documents what needs testing.

Return to orchestrator:
- Status: `passed` | `gaps_found` | `human_needed`
- Score: N/M must-haves verified
- GitHub issue number and comment URL
- If gaps_found: gap list and recommended fix plan names
- If human_needed: items requiring human testing

</process>

<success_criteria>
- [ ] Phase issue number retrieved from GitHub via all-progress
- [ ] Must-haves established from ROADMAP success_criteria, plan frontmatter, or derived from goal
- [ ] All must-have truths verified with status and evidence
- [ ] All artifacts checked at three levels (exists, substantive, wired)
- [ ] All key links verified with grep evidence
- [ ] Tests, build, and lint detected and executed
- [ ] Anti-patterns scanned and categorized as Blocker or Warning
- [ ] Three review agents (security, quality, efficiency) spawned in a SINGLE message block using Agent tool
- [ ] All review agent results aggregated before determining overall status
- [ ] Human verification items identified
- [ ] Overall status determined (PASS / FAIL / HUMAN_NEEDED)
- [ ] Verification result posted as GitHub comment: <!-- maxsim:type=verification -->
- [ ] No local VERIFICATION.md written
- [ ] Board transition executed: Done + closed on pass, In Progress on fail
- [ ] Results returned to orchestrator with status, score, and gap details
</success_criteria>
