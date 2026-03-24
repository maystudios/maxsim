# Self-Improvement Research — Consolidated Findings

> **Research date:** 2026-03-24
> **Method:** 21 parallel research agents analyzing autoresearch repo, Superpowers docs, existing MaxsimCLI specs, and web sources
> **Purpose:** Redesign MaxsimCLI's Self-Improvement system (PROJECT.md §11)

---

## 1. Executive Summary

MaxsimCLI's self-improvement system should adopt autoresearch's **8-phase loop** as the core iteration engine and Superpowers' **anti-rationalization + two-stage review** as the quality enforcement layer. The current `maxsim-capture-learnings` hook is a good start but needs significant improvement.

**Key design decisions:**

1. **Adopt autoresearch's loop as an optional `/maxsim:improve` command** — not as the default execution mode, but as a dedicated optimization workflow
2. **Fix the capture-learnings hook** — track per-session commits (not all-time), extract patterns, enforce MEMORY.md 200-line limit
3. **Implement TSV logging** — use autoresearch's 7-column format for metric tracking
4. **Add a SessionStart hook** — read git log + MEMORY.md + TSV at session start for context injection
5. **Adopt Verify + Guard as standard** — already instruction-based, needs code enforcement via TaskCompleted hook
6. **Stuck detection** — 5 consecutive failures triggers 6-step escalation (already specified, not implemented)

---

## 2. Source Analysis

### 2.1 autoresearch (github.com/uditgoenka/autoresearch)

**What it is:** A Claude Code plugin (v1.8.2) that implements Karpathy's autonomous improvement loop for any domain with a measurable metric.

**Core loop (8 phases):**
1. Review state (git log + TSV + diff)
2. Ideate (exploit successes, avoid repeated failures)
3. Modify (ONE atomic change)
4. Commit (before verify — change is recorded regardless of outcome)
5. Verify (run metric command, extract number)
6. Guard (regression check — optional but recommended)
7. Decide (keep/revert/rework/crash-recover)
8. Log (append to TSV, check stuck condition)

**Key patterns:**
- `git revert` over `git reset --hard` — preserves failed experiments for learning
- All commits use `experiment(<scope>):` prefix
- TSV is gitignored — local only
- Progress summary every 10 iterations
- Noise handling: 3-5x median for volatile metrics, min-delta threshold
- Stuck detection: 5 consecutive discards → 6-step escalation

**9 commands:** `/autoresearch` (core loop), `:plan`, `:debug`, `:fix`, `:security`, `:ship`, `:scenario`, `:predict`, `:learn`

**Architecture:** Pure markdown/instruction-based. No hooks, no external processes. Plugin manifest + commands + skills with lazy-loaded references.

### 2.2 Superpowers (v4.3.1 by Jesse Vincent)

**What it is:** A plugin-based meta-prompting system for Claude Code with 13 skills focused on development quality.

**Key patterns for self-improvement:**
- **Anti-rationalization tables:** 10 forbidden phrases + pre-empted excuses in every skill
- **Two-stage review per task:** Spec Compliance Review → Code Quality Review (never trust the implementer!)
- **Evidence-based verification:** CLAIM/EVIDENCE/OUTPUT/VERDICT blocks — no "should work" allowed
- **Fresh subagent per task:** Zero context pollution between tasks
- **1% skill invocation rule:** If even 1% chance a skill applies, MUST invoke it
- **Iron Laws:** `<HARD-GATE>` tags for non-negotiable rules

**Architecture:** SessionStart hook injects `using-superpowers` skill. All other skills loaded on-demand. No persistent memory system — Git history + committed docs only.

**Critical difference from autoresearch:** Superpowers is quality-enforcement (making sure work is correct). autoresearch is optimization (making a metric improve). MaxsimCLI needs both.

### 2.3 Current MaxsimCLI Self-Improvement

**What works:**
- `maxsim-capture-learnings` Stop hook writes to MEMORY.md ✅
- Verify + Guard pattern as instructions in skills/workflows ✅
- 4-gate verification (Input → Pre-Action → Completion → Quality) ✅

**What's broken or missing:**
- Hook only records last 5 commits (all-time, not per-session) — misleading
- No TSV logging — no metric tracking
- No SessionStart hook — no context injection
- No stuck detection — no escalation
- No `/maxsim:improve` command — no dedicated optimization workflow
- MEMORY.md grows endlessly — no 200-line pruning
- `stop_reason` is ignored by the hook
- TSV path inconsistency (guide says root, PROJECT.md says agent-memory/)
- TSV format inconsistency (guide has 7 columns, reference has 5)

---

## 3. Recommended Architecture

### 3.1 Three Layers of Self-Improvement

| Layer | Mechanism | Frequency | Source |
|-------|-----------|-----------|--------|
| **Session Memory** | MEMORY.md via Stop hook | Every session | Superpowers philosophy |
| **Metric Tracking** | autoresearch-results.tsv | Every task/phase | autoresearch |
| **Optimization Loop** | `/maxsim:improve` command | On-demand | autoresearch core loop |

### 3.2 Session Memory (Fix the Hook)

The `maxsim-capture-learnings` hook needs these improvements:

```
Current: Records last 5 commits (all-time), no pattern extraction
Target:  Records THIS session's commits only, extracts patterns, prunes MEMORY.md
```

**Implementation:**
1. Record `session_start_commit` at SessionStart (save the HEAD sha)
2. At Stop, diff `git log {session_start_commit}..HEAD --oneline` to get only THIS session's commits
3. Extract patterns: count of changes by type (feat/fix/refactor), files most modified
4. Prune MEMORY.md to stay under 180 lines (leave 20-line buffer before 200-line hard limit)
5. Use `stop_reason` to differentiate clean exits from crashes
6. Write structured entry with: date, session_id, commit_count, commit_list, patterns, stop_reason

### 3.3 Metric Tracking (TSV)

**Single authoritative format** (adopted from autoresearch):

```tsv
# metric_direction: lower_is_better
iteration	commit	metric	delta	guard	status	description
```

**Single authoritative path:** `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv` (gitignored)

**When it's written:**
- After each task execution in `/maxsim:execute` — metric = test pass rate or build success
- After each iteration in `/maxsim:improve` — metric = user-defined
- After each phase verification — metric = verification gate results

### 3.4 SessionStart Hook (New)

A new `maxsim-session-start` hook that fires on `SessionStart`:

```
1. Read git log --oneline -20
2. Read MEMORY.md (first 200 lines)
3. Read last 10 TSV entries (if file exists)
4. Output as additional_context for Claude
```

This gives every session instant context about recent work, learned patterns, and metric trends.

### 3.5 Verify + Guard (Code Enforcement)

Already instruction-based. Add code enforcement via the `TaskCompleted` hook:

```bash
#!/bin/bash
# maxsim-task-completed hook
npm test 2>&1
if [ $? -ne 0 ]; then
  echo "Tests not passing. Cannot complete task." >&2
  exit 2  # blocks completion, feeds back to agent
fi
exit 0
```

For phase-level, the `TeammateIdle` hook enforces the Guard:

```bash
#!/bin/bash
# maxsim-teammate-idle hook
npm run build 2>&1
if [ $? -ne 0 ]; then
  echo "Build broken. Fix before going idle." >&2
  exit 2
fi
exit 0
```

### 3.6 Stuck Detection

Implement in the orchestrator workflow:

```
After each task completion:
  Read last 5 TSV entries
  If 5 consecutive discards/crashes:
    1. Re-read ALL in-scope files (full context reload)
    2. Re-read original goal/phase description
    3. Review entire TSV log for patterns
    4. Try combining 2-3 successful past changes
    5. Try the OPPOSITE approach
    6. Try a radical architectural change
    7. If still stuck → create diagnostic GitHub Issue + escalate to user
```

### 3.7 `/maxsim:improve` Command (New, Optional)

A dedicated optimization command that runs the autoresearch loop:

```
/maxsim:improve
Goal: Reduce TypeScript errors to zero
Scope: src/**/*.ts
Verify: npx tsc --noEmit 2>&1 | grep error | wc -l
Guard: npx vitest run
Iterations: 20
```

This is NOT part of the standard `/maxsim:execute` flow. It's a separate, optional tool for when the user wants autonomous metric optimization.

---

## 4. What to Adopt from Each Source

### From autoresearch:
| Pattern | Adopt? | How |
|---------|--------|-----|
| 8-phase loop | Yes | As `/maxsim:improve` command |
| TSV logging (7-column format) | Yes | Standard format for all metric tracking |
| git revert over git reset | Yes | Already in verification skill |
| Stuck detection (5 fails → escalation) | Yes | In orchestrator workflow |
| Noise handling (median, min-delta) | Yes | For volatile metrics |
| Plan wizard | Partially | Integrate into `/maxsim:improve` setup |
| experiment() commit prefix | Yes | For autoresearch iterations |
| Progress summary every 10 iterations | Yes | In loop output |

### From Superpowers:
| Pattern | Adopt? | How |
|---------|--------|-----|
| Anti-rationalization tables | Yes | Already in verification skill |
| Two-stage review (Spec + Quality) | Yes | As opt-in during execute |
| Evidence blocks (CLAIM/EVIDENCE/OUTPUT/VERDICT) | Yes | Already in verification skill |
| Fresh subagent per task | Yes | Already in executor workflow |
| 1% skill invocation rule | No | Too aggressive for MaxsimCLI's use case |
| Iron Laws / HARD-GATE tags | Yes | For critical verification rules |
| SessionStart skill injection | Partially | Use SessionStart hook for context, not full skill injection |

### NOT adopting:
| Pattern | Why Not |
|---------|---------|
| autoresearch's 9 subcommands | Too many — MaxsimCLI has its own command set |
| Superpowers' zero-memory philosophy | MaxsimCLI needs persistent project memory (GitHub) |
| autoresearch's Plugin manifest system | MaxsimCLI uses its own install system |
| Karpathy's GPU-specific patterns | Not applicable to code quality metrics |

---

## 5. Inconsistencies to Resolve

| Issue | Resolution |
|-------|-----------|
| TSV path (root vs agent-memory/) | **Use `.claude/agent-memory/maxsim-learner/autoresearch-results.tsv`** — consistent with MEMORY.md location |
| TSV format (7 cols vs 5 cols) | **Use 7-column autoresearch format** — it's more detailed and proven |
| Retry count (3 vs 4 total attempts) | **Use 3 total attempts** (max 2 retries) — matches executor workflow |
| `/maxsim:improve` not in 9 commands | **Add as 10th command** OR implement as a workflow within `/maxsim:quick` |
| Capture-learnings hook too simple | **Rewrite** with per-session tracking, pattern extraction, pruning |
| self-improvement-guide.md discrepancies | **Rewrite §11** of PROJECT.md to match this research, then update the guide |

---

## 6. Implementation Priority

| Priority | Item | Effort |
|----------|------|--------|
| **P0** | Fix capture-learnings hook (per-session commits, pruning) | Small |
| **P0** | Add SessionStart hook (git log + MEMORY.md injection) | Small |
| **P1** | Implement TSV logging in execute workflow | Medium |
| **P1** | Add TaskCompleted hook for test-gate enforcement | Small |
| **P2** | Implement stuck detection in orchestrator | Medium |
| **P2** | Add `/maxsim:improve` command (autoresearch loop) | Large |
| **P3** | Noise handling for volatile metrics | Small |
| **P3** | Plan wizard for `/maxsim:improve` | Medium |

---

## 7. Updated PROJECT.md §11 Proposal

Replace the current `[NEEDS RESEARCH]` section with the architecture described in §3 above. Key changes:

1. Remove `[NEEDS RESEARCH]` tag
2. Describe three-layer architecture (Session Memory + Metric Tracking + Optimization Loop)
3. Document TSV format (7-column, single authoritative path)
4. Document SessionStart hook
5. Document improved capture-learnings hook
6. Document stuck detection
7. Reference `/maxsim:improve` as optional 10th command
8. Link to this research document and the autoresearch guide

---

## 8. References

| Source | URL/Path |
|--------|----------|
| autoresearch repo | `github.com/uditgoenka/autoresearch` (cloned to `/tmp/autoresearch/`) |
| autoresearch SKILL.md | `claude-plugin/skills/autoresearch/SKILL.md` |
| autoresearch loop protocol | `claude-plugin/skills/autoresearch/references/autonomous-loop-protocol.md` |
| autoresearch results logging | `claude-plugin/skills/autoresearch/references/results-logging.md` |
| autoresearch core principles | `claude-plugin/skills/autoresearch/references/core-principles.md` |
| Superpowers reference | `docs/superpowers-reference/` |
| Superpowers research | `docs/superpowers-research.md` |
| MaxsimCLI self-improvement guide | `docs/spec/self-improvement-guide.md` |
| MaxsimCLI memory system guide | `docs/spec/memory-system-guide.md` |
| MaxsimCLI verification skill | `templates/skills/verification/SKILL.md` |
| MaxsimCLI project-memory skill | `templates/skills/project-memory/SKILL.md` |
| MaxsimCLI capture-learnings hook | `packages/cli/src/hooks/maxsim-capture-learnings.ts` |
| MaxsimCLI self-improvement ref | `templates/references/self-improvement.md` |
| MaxsimCLI verification patterns | `templates/references/verification-patterns.md` |
| Claude Code hooks docs | `https://code.claude.com/docs/en/hooks` |
| Claude Code memory docs | Described in `docs/spec/memory-system-guide.md` |
