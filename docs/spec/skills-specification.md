# MaxsimCLI Skills Specification

**Version:** 6.0
**Date:** 2026-03-26
**Status:** Authoritative design spec for the 15-skill target state

This document defines the exact content structure for each of the 15 MaxsimCLI skills. Each entry covers: Anthropic-compliant name and description, section outline with key content, agent preload assignments, cross-skill references, and estimated line count.

---

## Conventions

All skills follow Anthropic's Claude Code skill conventions:

- **Name:** kebab-case, matches the folder name exactly
- **Description:** third-person, one or two sentences. Format: "What it does. Use when [trigger conditions]."
- **Body:** 500 lines maximum, Markdown
- **No `@` imports** in body content
- **user-invocable:** omit (defaults true) for user-facing skills; set `false` for agent-internal skills
- **Preloaded:** specified in the agent frontmatter `skills:` list — loads automatically at agent start
- **On-demand:** description matching triggers activation — not listed in `skills:`

---

## Skill Index

| # | Name | Type | Disposition |
|---|------|------|-------------|
| 1 | `tdd` | User-facing | Keep, minor fixes |
| 2 | `systematic-debugging` | User-facing | Keep, fix step-count label |
| 3 | `brainstorming` | User-facing | Keep as-is |
| 4 | `roadmap-writing` | User-facing | Keep, remove `.planning/` references |
| 5 | `handoff-contract` | Agent-internal | Keep as-is |
| 6 | `commit-conventions` | Agent-internal | Keep as-is |
| 7 | `maxsim-batch` | User-facing | Keep as-is |
| 8 | `code-review` | User-facing | Keep, add spec-compliance dimension |
| 9 | `verification` | User-facing | NEW — merge of 3 existing skills |
| 10 | `github-operations` | Agent-internal | NEW — merge of 2 existing skills |
| 11 | `research` | Agent-internal | NEW — merge of 2 existing skills |
| 12 | `project-memory` | User-facing | NEW skill |
| 13 | `using-maxsim` | User-facing | UPDATE for v6 commands |
| 14 | `maxsim-simplify` | User-facing | Keep as-is |
| 15 | `autoresearch` | User-facing | NEW skill |

---

## Skill 1: `tdd`

### Frontmatter

```yaml
---
name: tdd
description: >-
  Test-driven development with red-green-refactor cycle and atomic commits.
  Write failing test first, then minimal passing code, then refactor. Use when
  implementing business logic, API endpoints, data transformations, validation
  rules, or algorithms.
---
```

### Disposition

Keep with minor fix: the "Common Pitfalls" table is strong; the `See also` link must be updated from `verification-before-completion` to `verification` (the new merged skill name).

### Section Outline

1. **Opening principle** — one-line rule ("Write the test first. Watch it fail. Write minimal code to pass. Clean up.")
2. **When to Use TDD** — good-fit and poor-fit tables (keep exactly as-is)
3. **The Red-Green-Refactor Cycle** — 6 numbered steps:
   - RED: Write one failing test
   - VERIFY RED: Run the test, confirm assertion failure
   - GREEN: Write minimal passing code
   - VERIFY GREEN: Run all tests
   - REFACTOR: Clean up while tests stay green
   - REPEAT: Next failing test for next behavior
4. **Commit Pattern** — 2–3 atomic commits per cycle: `test({scope}):`, `feat({scope}):`, `refactor({scope}):`
5. **Context Budget** — note that TDD uses ~40% more context than direct implementation
6. **Common Pitfalls** — 4-row table of excuses vs. why they fail
7. **Stop rule** — one paragraph of forbidden behaviors
8. **See also** — `verification` (updated from `verification-before-completion`)

### Agent Preload Assignment

Not preloaded by any agent. User-invocable on-demand. Executor agent lists it in `available_skills` with trigger "when implementing business logic or requiring test-first approach".

### Key Behavioral Rules

- Must fail with an assertion, not a syntax error, before moving to GREEN
- GREEN writes the SIMPLEST passing code — no anticipatory features
- Refactor only while tests are green — never add behavior during refactor
- One TDD cycle = one failing test, one feature, one optional refactor

### Estimated Line Count

~78 lines (current is 78, no structural changes needed beyond the `See also` update)

---

## Skill 2: `systematic-debugging`

### Frontmatter

```yaml
---
name: systematic-debugging
description: >-
  Systematic debugging via reproduce-hypothesize-isolate-verify-fix-confirm
  cycle. Requires evidence at each step. Use when investigating bugs, test
  failures, unexpected behavior, or runtime errors.
---
```

### Disposition

Keep with one fix: the section heading "The 5-Step Process" is wrong — the skill already defines 6 steps (REPRODUCE, HYPOTHESIZE, ISOLATE, VERIFY, FIX, CONFIRM). Change the heading to "The 6-Step Process". Update `See also` from `verification-before-completion` to `verification`.

### Section Outline

1. **Opening principle** — "Find the root cause first. Random fixes waste time and create new bugs."
2. **Hard constraint** — "No fix attempts without understanding root cause."
3. **The 6-Step Process** (fix: was "5-Step") — numbered sections:
   - REPRODUCE: Confirm the problem, capture exact output
   - HYPOTHESIZE: Read full error, check recent changes, state hypothesis clearly
   - ISOLATE: Smallest reproduction, per-boundary logging, compare against working examples
   - VERIFY: Smallest change to test hypothesis, one variable at a time
   - FIX: Write failing test first, address root cause only
   - CONFIRM: Original failing test passes, full suite passes, original error gone
4. **Hypothesis Testing Protocol** — 4-step form/design/run/evaluate loop
5. **Escalation** — after 3+ failed attempts, document and escalate
6. **Common Pitfalls** — 4-row table of excuses vs. reality
7. **Stop rule** — forbidden behaviors paragraph
8. **See also** — `verification`

### Agent Preload Assignment

Not preloaded. User-invocable. Verifier agent receives it via orchestrator spawn prompt for `/maxsim:debug` tasks ("Investigate this failing test using systematic hypothesis testing").

### Key Behavioral Rules

- REPRODUCE before any hypothesis — reproducibility is not optional
- HYPOTHESIZE must produce an explicit written statement before any code changes
- ISOLATE to smallest case before fixing
- One variable changed per hypothesis test — never stack changes
- FIX step requires a failing test first (ties to TDD)

### Estimated Line Count

~80 lines (current is 80, only the heading text changes)

---

## Skill 3: `brainstorming`

### Frontmatter

```yaml
---
name: brainstorming
description: >-
  Multi-approach exploration before design decisions. Generates 3+ approaches
  with tradeoff analysis before selecting. Use when facing architectural
  choices, library selection, design decisions, or any problem with multiple
  viable solutions.
---
```

### Disposition

Keep exactly as-is. No changes needed.

### Section Outline

1. **Opening principle** — "The first idea is rarely the best idea."
2. **Process** — 6 numbered steps:
   - FRAME: Define problem, constraints, non-negotiables
   - RESEARCH CONTEXT: Read code, check STATE.md for prior decisions
   - PRESENT 3+ APPROACHES: Summary / How it works / Pros / Cons / Effort / Risk table per approach
   - DISCUSS AND REFINE: One question at a time, no assumed consensus
   - GET EXPLICIT APPROVAL: "Go with A" required; vague responses not sufficient
   - DOCUMENT THE DECISION: Record chosen approach, rejected alternatives, key decisions, risks
3. **Output Format** — markdown template with Problem Statement / Approaches table / Selected + Rationale
4. **Common Pitfalls** — 3-row table of excuses vs. reality
5. **Stop rule** — forbidden behaviors paragraph

### Agent Preload Assignment

Not preloaded. User-invocable on-demand. Description matching activates it for architectural or library decisions.

### Key Behavioral Rules

- Minimum 3 approaches presented — no exceptions
- One question at a time during framing and refinement
- Explicit approval required before proceeding — vague responses trigger a clarifying question
- Document decision including why alternatives were rejected

### Estimated Line Count

~102 lines (current is 102, no changes)

---

## Skill 4: `roadmap-writing`

### Frontmatter

```yaml
---
name: roadmap-writing
description: >-
  Phased planning with dependency graphs, success criteria, and requirement
  mapping. Produces roadmaps with observable truths as success criteria.
  Use when creating project roadmaps, breaking features into phases, or
  structuring multi-phase work.
---
```

### Disposition

Keep, with one change: remove the "MAXSIM Integration" section at the bottom. That section references `.planning/config.json`, `model_profile`, `normalizePhaseName()`, and `comparePhaseNum()` — these are implementation internals that have no place in a skill. The roadmap format and process content is correct and complete without it.

### Section Outline

1. **Opening principle** — "A roadmap without success criteria is a wish list."
2. **Process** — 7 numbered steps:
   - SCOPE: Read PROJECT.md, REQUIREMENTS.md, existing STATE.md, identify delivery target
   - DECOMPOSE: Phase properties table (independently deliverable, 1–3 days, clear boundary, ordered); phase numbering conventions (`01`, `01A`, `01.1`)
   - DEFINE: Phase template with Goal / Depends on / Requirements / Success Criteria / Plans fields; success criteria rules (testable, 2+ per phase, at least one command-verifiable)
   - CONNECT: Parallel vs. sequential suffixes, circular dependency check
   - MAP REQUIREMENTS: Coverage map format `REQUIREMENT-ID -> Phase N`; all requirements must map
   - MILESTONE: Group phases into user-visible release milestones
   - VALIDATE: Validation checklist table (7 checks)
3. **Roadmap Format** — full markdown template
4. **Common Pitfalls** — 5-row table
5. **Stop rule** — forbidden behaviors paragraph

### Agent Preload Assignment

Not preloaded. User-invocable on-demand. Planner agent may receive it as a suggested skill when roadmap creation is in scope.

### Key Behavioral Rules

- Every phase must have success criteria before the roadmap is finalized
- Success criteria must be testable (verifiable by command, test, or inspection)
- Every requirement ID must map to at least one phase or be explicitly marked out-of-scope
- Phase numbering must be sequential with no gaps larger than 1

### Estimated Line Count

~130 lines (remove ~8 lines from "MAXSIM Integration" section, net ~133 → ~125)

---

## Skill 5: `handoff-contract`

### Frontmatter

```yaml
---
name: handoff-contract
description: >-
  Structured return format for agent handoffs. Defines Key Decisions, Artifacts,
  Status, and Deferred Items sections that every agent must include when returning
  results. Use when completing any agent task, returning results to orchestrator,
  or transitioning between workflow stages.
user-invocable: false
---
```

### Disposition

Keep exactly as-is. This skill is stable, complete, and correct.

### Section Outline

1. **Opening principle** — every agent return must use this format; orchestrator depends on it
2. **Required Return Sections** — 4 subsections:
   - KEY DECISIONS: Format block; include technology choices, scope adjustments, ambiguous-requirement interpretations; omit routine details
   - ARTIFACTS: Format block with Created/Modified/Deleted paths; absolute paths; every touched file
   - STATUS: 3-value table (`complete` / `blocked` / `partial`) with orchestrator action per value
   - DEFERRED ITEMS: Format block with categorized deferred work; categories: feature, bug, refactor, investigation

### Agent Preload Assignment

Preloaded by **all four agents**: executor, planner, researcher, verifier.

### Key Behavioral Rules

- All four sections are mandatory — none may be omitted
- `complete` status requires verification evidence; do not mark complete without passing gates
- Artifacts must be absolute paths from project root
- Deferred items must be categorized — uncategorized entries are not valid

### Estimated Line Count

~71 lines (current is 71, no changes)

---

## Skill 6: `commit-conventions`

### Frontmatter

```yaml
---
name: commit-conventions
description: >-
  Commit message format using conventional commits with scope. Defines atomic
  commit rules, breaking change markers, and co-author attribution for
  AI-assisted work. Use when creating git commits, reviewing commit messages,
  or establishing commit conventions for a project.
user-invocable: false
---
```

### Disposition

Keep exactly as-is.

### Section Outline

1. **Opening principle** — consistent commits enable automated versioning and clear history
2. **Conventional Commit Format** — format string + example; body as bullet points
3. **Types** — 6-row table: feat / fix / chore / docs / test / refactor with version bump triggers
4. **Breaking Changes** — `!` suffix syntax, major version bump trigger
5. **Scope** — examples: phase work `feat(04-01):`, module `fix(install):`, component `feat(dashboard):`
6. **Atomic Commits** — DO/DO NOT list
7. **Co-Author Attribution** — `Co-Authored-By: Claude <noreply@anthropic.com>` line
8. **Commit Message Guidelines** — subject under 72 chars, imperative mood, why over what

### Agent Preload Assignment

Preloaded by **executor** agent only. Other agents do not commit.

### Key Behavioral Rules

- Subject line: imperative mood ("add" not "added"), under 72 characters
- One logical change per commit — no bundles
- Breaking changes require `!` — never document them only in the body
- Co-author line required for all AI-assisted commits

### Estimated Line Count

~76 lines (current is 76, no changes)

---

## Skill 7: `maxsim-batch`

### Frontmatter

```yaml
---
name: maxsim-batch
description: >-
  Parallel worktree execution for independent work units. Isolates agents in
  separate git worktrees for conflict-free parallel implementation. Use when
  executing multiple independent plans, batch processing, or parallelizable
  tasks.
---
```

### Disposition

Keep exactly as-is.

### Section Outline

1. **Opening principle** — decompose, isolate, parallelize
2. **When to Use** — 3+ independent units with no shared file modifications; per-unit independent verification; do not use for fewer than 3 units or sequential dependencies
3. **Process** — 5 numbered steps:
   - DECOMPOSE: List units, check file overlap, check runtime dependencies, check independent testability; merge or serialize overlapping units
   - PLAN: Per-unit spec (description, acceptance criteria, file ownership, base branch, instructions)
   - SPAWN: Create worktree per unit, spawn agent per worktree; each agent: read source → implement → test → commit → push → create PR
   - TRACK: Status table (unit / status / PR); statuses: pending / in-progress / done / failed
   - MERGE: Collect PRs; failure handling (spawn fix agent in same worktree, handle merge conflicts as decomposition errors, escalate after 3 failures)
4. **Limits** — up to 30 parallel agents, typically 3–10; fast-forward preferred; each unit independently mergeable
5. **Common Pitfalls** — 3-item list
6. **Verification checklist** — 5-item checklist before reporting completion

### Agent Preload Assignment

Not preloaded. User-invocable on-demand. The executor agent receives it as a suggested skill when the orchestrator detects 3+ independent work units.

### Key Behavioral Rules

- Minimum 3 independent units to justify worktree overhead
- Zero file overlap between units — any overlap is a decomposition error
- Each unit must have its own PR
- No PR may depend on another PR being merged first

### Estimated Line Count

~87 lines (current is 87, no changes)

---

## Skill 8: `code-review`

### Frontmatter

```yaml
---
name: code-review
description: >-
  Code quality review covering security, interfaces, error handling, test
  coverage, conventions, and spec compliance. Produces structured findings
  with severity and evidence. Use when reviewing pull requests, completed
  implementations, or code changes.
---
```

### Disposition

Keep, with one addition: add a "SPEC COMPLIANCE" dimension (dimension 3 in the ordered list) that checks implementation against the plan's `must_haves`, `done` criteria, and requirement IDs. This integrates the spec-review functionality previously documented only in the SDD skill. The description gains "spec compliance" in the first sentence.

### Section Outline

1. **Opening principle** — "Shipping unreviewed code is shipping unknown risk."
2. **Review Dimensions** — 7 dimensions in order (was 6; add SPEC COMPLIANCE as #3):
   - SCOPE: Diff against starting point, list all changed files including generated/config/minor
   - SECURITY: Injection / Auth / Authorization / Data exposure / Dependencies table; any security issue blocks
   - SPEC COMPLIANCE *(new)*: Does implementation match plan's `must_haves`? Are all `done` criteria met? Were only specified files modified? Are requirement IDs addressed?
   - INTERFACES: Signatures match docs, return types accurate, error types complete, breaking changes documented
   - ERROR HANDLING: External calls wrapped, error messages have context, no silent swallowing, edge cases handled
   - TESTS: New public functions have tests, success and failure paths covered, edge cases tested, behavior not implementation
   - CONVENTIONS: Naming consistent, complexity justified, non-obvious logic commented
3. **Review Output Format** — structured output block: REVIEW SCOPE / SECURITY / SPEC COMPLIANCE / INTERFACES / ERROR HANDLING / TEST COVERAGE / CONVENTIONS / VERDICT
4. **Severity Reference** — Blocker / High / Medium with examples; Blocker + High block approval
5. **Spec Review vs Code Review** — table distinguishing the two (update to note spec compliance is now built-in, not separate)
6. **Common Pitfalls** — 4-row table
7. **See also** — `maxsim-simplify`

### Agent Preload Assignment

Not preloaded. User-invocable on-demand. Verifier agent receives it via orchestrator spawn prompt for code review tasks ("Review these files for code quality, security, spec compliance, and conventions").

### Key Behavioral Rules

- Security issues are always blocking — no exceptions, no deferral
- Spec compliance check requires reading the plan's `must_haves` block — not inferred from the code alone
- Blocker and High severity block the APPROVED verdict
- Every dimension must be checked — skipping a dimension invalidates the review

### Estimated Line Count

~115 lines (current is 105; adds ~10 lines for SPEC COMPLIANCE dimension and updated output format)

---

## Skill 9: `verification` *(NEW — merge)*

### Source Skills Being Replaced

- `verification-before-completion` (currently 72 lines, user-invocable: true)
- `evidence-collection` (currently 88 lines, user-invocable: false)
- `verification-gates` (currently 170 lines, user-invocable: false)

### Rationale for Merge

All three skills share the same core subject — evidence-based verification — but were split across invocability tiers. Users encountered `verification-before-completion` but couldn't access the stronger gate framework. Agents loaded `evidence-collection` and `verification-gates` separately, creating redundant content. The merge produces one authoritative skill with clear layering: collection process → claim format → gate types → retry/escalation.

### Frontmatter

```yaml
---
name: verification
description: >-
  Evidence-based verification with hard gates, retry logic, and escalation
  protocol. Defines what counts as evidence, the 5-step collection process,
  four gate types, and anti-rationalization enforcement. Use when claiming
  work is done, tests pass, builds succeed, bugs are fixed, or before any
  completion checkpoint.
---
```

### Section Outline

1. **Opening principle** — "Evidence before claims, always. No exceptions."
2. **The 5-Step Collection Process**
   - IDENTIFY: What command proves this claim? Pick most direct verification.
   - RUN: Execute fresh in THIS turn — not a previous run, not a different command
   - READ: Full output, exit codes, warnings in verbose output
   - CHECK: Does output actually confirm the claim? A passing build ≠ passing tests
   - CITE: Include evidence in your response using the block format
3. **Evidence Block Format** — `CLAIM / EVIDENCE / OUTPUT / VERDICT` block; one block per claim
4. **What Counts as Evidence** — table: Tests pass / Build succeeds / Bug fixed / Task complete / No regressions / File created / Content correct / API responds — with Requires and Not Sufficient columns
5. **Gate Types** — 4 gates (from `verification-gates`):
   - INPUT VALIDATION GATE: Before starting work; check files, env vars, state; structured error on failure
   - PRE-ACTION GATE: Before destructive actions; state what will change; abort on failure
   - COMPLETION GATE: Hard gate; fresh evidence required; "close enough" is failure; partial success is failure
   - QUALITY GATE: After implementation; test suite + build + lint output required
6. **Anti-Rationalization** — forbidden phrases list: "should work", "probably passes", "I'm confident that...", "based on my analysis...", "it's reasonable to assume...", "close enough", "minor issue", "I already verified this"
7. **Retry Protocol** — max 2 retries (3 total attempts); evidence block per retry includes attempt number, what changed, fresh output
8. **Escalation Format** — structured `GATE FAILURE — ESCALATION` block with gate type, attempts, evidence history, recommended action
9. **Verification Checklist** — 7-item checklist for completion claims
10. **Common Pitfalls** — consolidated table from all three source skills (8 rows)

### Agent Preload Assignment

Preloaded by **verifier** agent (replacing `verification-gates` + `evidence-collection`). Also preloaded by **executor** agent (replacing `evidence-collection`). Researcher gains it on-demand.

### Cross-References

- `tdd` references this skill in its "See also"
- `systematic-debugging` references this skill in its "See also"
- `code-review` uses this skill's evidence block format for its output

### Key Behavioral Rules

- Evidence from prior turns is stale — always re-run in the current turn
- Tool output only — reasoning, analysis, and confidence are not evidence
- Completion Gate is a hard gate — no rationalization bypasses it
- After 3rd failure, escalate with full history — do not attempt a 4th fix silently
- One evidence block per claim; group only when the same command verifies multiple claims

### Estimated Line Count

~200 lines (merges 330 total source lines; deduplicates the evidence table and pitfalls which appeared in all three; target is comprehensive but under 500)

---

## Skill 10: `github-operations` *(NEW — merge)*

### Source Skills Being Replaced

- `github-artifact-protocol` (currently 67 lines, no frontmatter — protocol-only format)
- `github-tools-guide` (currently 90 lines, no frontmatter — command reference format)

### Rationale for Merge

Both skills address the same domain: GitHub Issues as MAXSIM's artifact store. The protocol skill defines what to write and when; the tools guide defines how to write it. They are always used together — an agent reading the protocol needs the CLI commands to execute it. Splitting them creates incomplete skill activations. The merge produces one complete operational reference.

### Frontmatter

```yaml
---
name: github-operations
description: >-
  GitHub Issues operations for MAXSIM artifact storage: artifact types,
  comment conventions, issue lifecycle, and CLI command reference. Use when
  reading from or writing to GitHub Issues, managing phase artifacts, posting
  comments, or tracking board state.
user-invocable: false
---
```

### Section Outline

1. **Opening principle** — GitHub Issues is MAXSIM's single source of truth for phase artifacts; no local artifact files
2. **Artifact Types and Comment Conventions** — table: artifact type / comment type / CLI command / HTML comment header format; covers: context, research, plan, summary, verification, UAT, completion
3. **Issue Lifecycle State Machine** — Phase Issues: To Do → In Progress → In Review → Done; Task Sub-Issues: To Do → In Progress → Done (with Done → In Progress re-open path on review failure)
4. **CLI Command Reference** — all commands via `node ~/.claude/maxsim/bin/maxsim-tools.cjs github <command>`:
   - Setup: `setup`
   - Phase lifecycle: `create-phase`, `create-task`, `batch-create-tasks`, `post-plan-comment`
   - Comments: `post-comment` (types: research / context / summary / verification / uat / general), `post-completion`
   - Issue operations: `get-issue`, `list-sub-issues`, `close-issue`, `reopen-issue`, `bounce-issue`, `move-issue`, `detect-external-edits`
   - Board operations: `query-board`, `add-to-board`, `search-issues`, `sync-check`
   - Progress: `phase-progress`, `all-progress`, `detect-interrupted`
   - Convenience: `status`, `sync`, `overview`
5. **Text Arguments** — tmpfile pattern for large body/plan-content arguments; `--raw` flag for JSON output
6. **Write Order (WIRE-01)** — build in memory → POST → success or abort entirely (no partial state)
7. **Rollback Pattern (WIRE-07)** — on partial failure: close partials with `not_planned`, post `[MAXSIM-ROLLBACK]` comment, report what succeeded/failed, offer targeted retry
8. **External Edit Detection (WIRE-06)** — body hash stored in `github-issues.json`; on read compare live hash; warn on mismatch; do not auto-incorporate
9. **What Stays Local** — list of files that remain local (config.json, PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, github-issues.json, codebase/)
10. **Output Format** — JSON schema when `--raw`: `{"ok": true, "result": "...", "rawValue": {...}}`

### Agent Preload Assignment

Not preloaded by default. Listed as `available_skills` in executor, planner, and verifier agent definitions. Activates when those agents are performing GitHub artifact operations.

### Key Behavioral Rules

- Use `--body-file` with a tmpfile for any content longer than a single line
- Rollback on batch partial failure — never leave partial state in GitHub
- External edits detected via hash comparison — do not silently overwrite
- `--raw` flag required for machine-readable output in agent pipelines

### Estimated Line Count

~160 lines (merges 157 source lines; adds section headers, improves organization; deduplicates overlap; target ~160)

---

## Skill 11: `research` *(NEW — merge)*

### Source Skills Being Replaced

- `research-methodology` (currently 138 lines, user-invocable: false)
- `tool-priority-guide` (currently 81 lines, user-invocable: false)

### Rationale for Merge

Tool priority is not a standalone skill — it is an operational constraint that shapes how research and all other work is conducted. Merging it into `research` gives researchers the complete picture: how to structure research AND which tools to use to execute it. The merged skill avoids forcing agents to load two skills for what is effectively one task domain. Tool priority content applies beyond research, but the `research` skill is the highest-leverage preload point — executor and verifier inherit the tool rules from their own operational context.

### Frontmatter

```yaml
---
name: research
description: >-
  Structured research process with source priority, confidence levels, and
  Claude Code tool selection. Defines investigation process, source evaluation,
  output templates, and preferred tools for file, search, web, and command
  operations. Use when researching libraries, APIs, architecture patterns, or
  any domain requiring external knowledge gathering.
user-invocable: false
---
```

### Section Outline

1. **Opening principle** — systematic investigation produces findings with known confidence; ad-hoc research produces noise
2. **Tool Priority Reference** (from `tool-priority-guide`)
   - File reading: Read tool > cat/head/tail; why: permissions, large files, binary formats, line-numbered output
   - File writing: Write tool (new files) / Edit tool (modifications) > echo/sed/awk; why: atomic, preserves encoding, diff view
   - Searching: Grep tool > grep/rg Bash; Glob tool > find/ls; why: optimized permissions, structured output
   - Web content: WebFetch tool > curl; why: auth, redirects, HTML parsing
   - When Bash IS right: build/test commands, git operations, dependency install, file existence checks (`test -f`), chained operations
   - Quick reference box: Read → Read tool; Write → Write/Edit tool; Search → Grep tool; Find files → Glob tool; Fetch URL → WebFetch tool; Run commands → Bash tool
3. **Research Process** — 5 numbered steps:
   - DEFINE QUESTIONS: Write explicit questions before researching; clear "answered" state per question; avoid open-ended exploration
   - IDENTIFY SOURCES: Priority-ordered source table (official docs / codebase / CLI help / package registries / reputable blogs / community forums) with tool column
   - EVALUATE SOURCES: Confidence levels (HIGH / MEDIUM / LOW) with criteria; source evaluation checklist (primary vs. secondary, date, matches tool behavior, multiple sources agree)
   - CROSS-REFERENCE: 2+ independent sources for architecture decisions; verify against actual tool behavior; note disagreements; mark single-source as LOW
   - STRUCTURE OUTPUT: Research findings format with Confidence / Sources / Finding / Implications / Open questions
4. **Research Output Template** — full markdown template: Domain Research / Key Findings / Standard Stack table / Don't Hand-Roll table / Common Pitfalls / Open Questions / Sources (PRIMARY/SECONDARY)
5. **Time Boxing** — Quick lookup 5 min / Standard research 30 min / Deep investigation 60 min; document unanswerable questions as open questions
6. **Common Research Mistakes** — 6-row table: AI knowledge only / single blog post / skip version checks / assume current codebase correct / no source recording / research without questions

### Agent Preload Assignment

Preloaded by **researcher** agent. Listed as an on-demand skill for planner agent.

### Key Behavioral Rules

- Define explicit questions before starting — no open-ended exploration
- Official documentation beats codebase which beats community sources
- Single-source findings are always LOW confidence
- Time-box research — document unanswerable questions and move on
- Use dedicated Claude Code tools (Read, Grep, Glob, WebFetch) over Bash equivalents

### Estimated Line Count

~190 lines (merges 219 source lines; deduplicates source priority table which appeared in both; target ~190)

---

## Skill 12: `project-memory` *(NEW)*

### Rationale for Creation

The existing `memory-management` skill defines a local-file-based persistence model (CLAUDE.md, STATE.md, LESSONS.md). In v5, MAXSIM uses GitHub Issues as the single source of truth for project artifacts. A new skill is needed that: (1) establishes GitHub Issues as the canonical store for cross-session learnings, (2) defines what categories of knowledge to persist, (3) specifies the GitHub-native write pattern, and (4) explains the relationship between local files and GitHub state. This replaces `memory-management` in the 15-skill target set.

### Frontmatter

```yaml
---
name: project-memory
description: >-
  Cross-session knowledge persistence using GitHub Issues and local planning
  files. Defines what to capture, where to store it, when to write, and how
  to retrieve it in future sessions. Use when encountering recurring patterns,
  making architectural decisions, discovering environment quirks, or at session
  end before context resets.
---
```

### Section Outline

1. **Opening principle** — "Context dies with each session. Patterns not saved are patterns lost."
2. **What to Persist** — trigger / threshold / what to save table:

   | Trigger | Threshold | Where to Save |
   |---------|-----------|---------------|
   | Same error encountered | 2+ occurrences | GitHub Issue (label: lessons) + CLAUDE.md on 3rd occurrence |
   | Same debugging path followed | 2+ times | GitHub Issue (label: lessons) |
   | Architectural decision made | Once (if significant) | GitHub Issue (label: decision) via `state add-decision` |
   | Non-obvious convention discovered | Once | CLAUDE.md |
   | Tooling/framework quirk with workaround | Once | GitHub Issue (label: lessons) |
   | Project-specific pattern confirmed | 2+ uses | CLAUDE.md |

   **Do NOT save:** Session-specific context, speculative conclusions, temporary workarounds, obvious patterns, information already present in CLAUDE.md or prior GitHub Issues.

3. **Storage Locations** — table: location / content / when loaded / write method:

   | Location | Content | Loaded When | Write Method |
   |----------|---------|-------------|--------------|
   | GitHub Issue (label: `maxsim:lesson`) | Cross-session lessons, recurring patterns, error fixes | MAXSIM execution startup via `github search-issues --labels maxsim:lesson` | `github post-comment --type context` on the lessons issue |
   | GitHub Issue (label: `maxsim:decision`) | Architectural decisions with rationale | During planning, research, and execution | `state add-decision` tool or direct GitHub comment |
   | CLAUDE.md | Project conventions, build commands, immediate-visibility patterns | Every Claude Code session | Edit tool |
   | STATE.md | Current blockers, progress metrics, session continuity | Every MAXSIM session startup | `state` CLI tool |

4. **Write Process** — 4 steps:
   - DETECT: Recognize a trigger from the table above
   - CHECK: Read existing memory locations before writing to avoid duplicates
   - WRITE: Add to appropriate location using the write method
   - VERIFY: Re-read to confirm entry is written correctly and is actionable

5. **Entry Format** — for GitHub Issues: `[YYYY-MM-DD] [{phase}-{plan}] {actionable lesson}` as a comment on the persistent lessons issue; for CLAUDE.md: prose or bullet points; for STATE.md: use `state add-decision` format

6. **Error Escalation Pattern**

   ```
   Error seen once    → Note it, move on
   Error seen twice   → Post to GitHub lessons issue
   Error seen 3+      → Post to GitHub lessons issue AND add to CLAUDE.md
   ```

7. **Retrieval in New Sessions** — startup sequence: `github search-issues --labels maxsim:lesson --state open` to load lessons; read STATE.md for session continuity; check ROADMAP.md for phase context

8. **Common Pitfalls** — 5-row table:

   | Pitfall | Fix |
   |---------|-----|
   | Encountering same error twice without saving | Stop and write now |
   | Making same architectural decision as a prior session | Search GitHub decisions first |
   | Solving a problem you already solved | Check lessons issue before debugging |
   | Leaving session without memory update | Review what was learned before closing |
   | Saving speculative conclusions | Only save confirmed patterns with evidence |

### Agent Preload Assignment

Not preloaded. User-invocable on-demand. Executor agent may receive it via orchestrator when the spawn prompt identifies a recurring pattern or architectural decision scenario.

### Key Behavioral Rules

- GitHub Issues is the primary store for cross-session learnings — not only local files
- CLAUDE.md is for high-frequency patterns only (every session loads it)
- Do not save speculative conclusions — only evidence-backed patterns
- Check existing memory before writing — no duplicate entries
- Verify writes immediately — memory not confirmed written is not saved

### Estimated Line Count

~110 lines

---

## Skill 13: `using-maxsim` *(UPDATE for v6)*

### Frontmatter

```yaml
---
name: using-maxsim
description: >-
  Routes work through MAXSIM's spec-driven workflow: checks planning state,
  determines active phase, dispatches to the correct MAXSIM command. Use when
  starting work sessions, resuming work, or choosing which MAXSIM command to run.
---
```

### Disposition

Update to accurately reflect the v6 command surface (13 commands) and the 15-skill target set. The current skill references outdated skill names (`verification-before-completion`, `sdd`, `memory-management`) that do not exist in the target state. The routing table and agent model sections are correct. The skills table needs to be updated.

### Section Outline

1. **Opening principle** — "MAXSIM is a spec-driven development system. Work flows through phases, plans, and tasks — not ad-hoc coding."
2. **Hard constraint** — "No implementation without a plan." Decision tree: no `.planning/` → init; no current phase → plan; plan exists → execute.
3. **Routing** — before starting any task:
   - Check for `.planning/` directory
   - Check STATE.md for last checkpoint
   - Check current phase in ROADMAP.md
   - Route using the command table
4. **Command Surface (13 commands)** — updated routing table:

   | Situation | Command |
   |-----------|---------|
   | No `.planning/` directory | `/maxsim:init` |
   | No ROADMAP.md or empty roadmap | `/maxsim:init` |
   | Active phase has no PLAN.md | `/maxsim:plan N` |
   | Active phase has PLAN.md, not started | `/maxsim:execute N` |
   | Phase complete, needs verification | `/maxsim:execute N` (auto-verifies) |
   | Bug found during execution | `/maxsim:debug` |
   | Quick standalone task | `/maxsim:quick` |
   | Check overall status | `/maxsim:progress` |
   | Don't know what to do next | `/maxsim:go` |
   | Change workflow settings | `/maxsim:settings` |
   | Need command reference | `/maxsim:help` |
   | Optimize code against a metric | `/maxsim:improve` |
   | Iteratively fix errors until zero remain | `/maxsim:fix-loop` |
   | Autonomous bug hunting with hypothesis testing | `/maxsim:debug-loop` |
   | Security audit (STRIDE + OWASP + red-team) | `/maxsim:security` |

5. **Agent Model (4 agents)** — keep existing table (executor / planner / researcher / verifier) — this is correct in the current skill
6. **Skills** *(UPDATE — replace old skill names with v6 target names)*:

   | Skill | When It Activates |
   |-------|-------------------|
   | `systematic-debugging` | Investigating bugs, test failures, or unexpected behavior |
   | `tdd` | Implementing business logic, APIs, data transformations |
   | `verification` | Claiming work is done, tests pass, builds succeed, bugs are fixed |
   | `project-memory` | Recurring patterns, architectural decisions, session-end knowledge capture |
   | `brainstorming` | Facing architectural choices or design decisions |
   | `roadmap-writing` | Creating or restructuring a project roadmap |
   | `maxsim-simplify` | Reviewing code for duplication, dead code, or complexity |
   | `code-review` | Reviewing implementation for security, interfaces, spec compliance |
   | `maxsim-batch` | Parallelizing work across 3+ independent worktree units |

7. **Common Pitfalls** — keep existing 5-bullet list
8. **See also** — `verification`

### Agent Preload Assignment

Not preloaded. User-invocable on-demand (this is the orientation/routing skill for users).

### Key Behavioral Rules

- Check the routing table before starting any task — do not proceed ad-hoc
- Explicit user approval required before working outside the current phase
- STATE.md checkpoints from previous sessions must be acknowledged before proceeding
- The 13-command surface is complete — there is no other entry point for MAXSIM work

### Estimated Line Count

~85 lines (current is 79; adds 6 lines for updated skills table entries)

---

## Skill 14: `maxsim-simplify`

### Frontmatter

```yaml
---
name: maxsim-simplify
description: >-
  Maintainability optimization covering duplication, dead code, complexity, and
  naming. Produces structured findings with before/after metrics. Use when
  reviewing code for simplification, during refactoring passes, or when
  codebase complexity is increasing.
---
```

### Disposition

Keep exactly as-is.

### Section Outline

1. **Opening principle** — "Every line of code is a liability. Remove what does not earn its place."
2. **Scope** — only touched files unless explicitly asked for broader refactoring; incremental improvement, not full rewrite
3. **Dimensions** — 4 dimensions:
   - DUPLICATION: Shared helper candidates, duplicated utilities, similar implementations; rule of three
   - DEAD CODE: Unused imports/variables/functions/parameters; commented-out code; unreachable branches; stale feature flags
   - COMPLEXITY: Wrapper/adapter/indirection justification; single-case generics; class-vs-function; defensive programming for impossible conditions
   - NAMING: Self-documenting names; nested logic with early returns; control flow clarity
4. **Process** — 5 steps: DIFF → SCAN → RECORD → FIX → VERIFY
5. **Output Format** — `DIMENSION / FILE / FINDING / SEVERITY / FIX` block per finding
6. **Common Rationalizations** — 4-row table of excuses vs. why they fail
7. **Stop rule** — forbidden behaviors paragraph
8. **Verification checklist** — 6-item checklist before reporting completion
9. **See also** — `code-review`

### Agent Preload Assignment

Not preloaded. User-invocable on-demand. Verifier agent may receive it as a suggested skill in the spawn prompt for post-implementation quality passes.

### Key Behavioral Rules

- Scope is touched files only unless explicitly expanded
- Rule of three: extract if pattern appears 3+ times
- Simplification must not change behavior — tests must pass after every change
- "Might be needed later" is never a reason to keep dead code

### Estimated Line Count

~91 lines (current is 91, no changes)

---

## Skill 15: `autoresearch` *(NEW)*

### Rationale for Creation

v6 introduces four autonomous loop commands (`/maxsim:improve`, `/maxsim:fix-loop`, `/maxsim:debug-loop`, `/maxsim:security`) that share a common constraint-driven iteration pattern: modify, verify, keep or discard, repeat. Rather than embedding the loop protocol in each command's agent prompt, a dedicated skill centralizes the iteration mechanics, decision rules, and results-logging format. Six reference workflows in `references/` provide domain-specific protocols that the skill dispatches to based on the command invoked.

### Frontmatter

```yaml
---
name: autoresearch
description: >-
  Autonomous optimization loop with reference workflows. Powers /maxsim:improve,
  /maxsim:fix-loop, /maxsim:debug-loop, /maxsim:security. Used when running
  autonomous optimization, error repair, bug hunting, or security audit loops.
---
```

### Section Outline

1. **When to Activate** — trigger table mapping each of the 4 commands plus general "repeated iteration with measurable outcomes" trigger
2. **Subcommands** — routing table: `/maxsim:improve` (default loop), `/maxsim:debug-loop` → `references/debug.md`, `/maxsim:fix-loop` → `references/fix.md`, `/maxsim:security` → `references/security.md`
3. **Interactive Setup Gate** — required context per command: improve (Goal, Scope, Metric, Direction, Verify), debug-loop (Issue/Symptom, Scope), fix-loop (Target, Scope), security (Scope, Depth)
4. **Bounded Iterations** — `Iterations: N` for bounded runs; default is unbounded (loop until interrupted); early completion on goal achieved
5. **Setup Phase** — inline config extraction or interactive 2-batch collection; dry-run verify command; 7 setup steps (read scope, define goal, define scope, define guard, create results log, establish baseline, confirm and begin)
6. **The Loop** — `LOOP (FOREVER or N times)`: Review → Ideate → Modify (ONE change) → Commit → Verify → Guard → Decide (keep/discard/revert/crash-fix) → Log → Repeat; references `references/loop-protocol.md`
7. **Critical Rules** — 8 rules: loop until done, read before write, one change per iteration, mechanical verification only, automatic rollback, simplicity wins, git is memory (`experiment:` prefix, `git revert` not `git reset --hard`), when stuck think harder
8. **Principles Reference** — points to `references/core-principles.md` (7 generalizable principles)
9. **Adapting to Different Domains** — table mapping domain (backend, frontend, performance, refactoring, security, debugging, fixing) to metric, scope, verify command, and guard
10. **Debug Loop Summary** — autonomous bug-hunting: scientific method, hypothesis testing, classify as confirmed/disproven/inconclusive; references `references/debug.md`
11. **Fix Loop Summary** — autonomous error repair: detect, prioritize (build > types > tests > lint), fix ONE, commit, verify, guard, decide, log; references `references/fix.md`
12. **Security Audit Summary** — STRIDE + OWASP + red-team adversarial analysis; 4 red-team lenses; code evidence required; composite metric; `--diff`, `--fix`, `--fail-on` flags; references `references/security.md`
13. **Results Logging** — TSV format per `references/results-logging.md`; valid statuses: baseline, keep, keep (reworked), discard, crash, no-op, hook-blocked

### Reference Workflows (6 files in `references/`)

| File | Purpose |
|------|---------|
| `loop-protocol.md` | Core iteration protocol: review, ideate, modify, commit, verify, guard, decide, log |
| `debug.md` | Debug loop: scientific method with hypothesis testing and classification |
| `fix.md` | Fix loop: error detection, prioritization, atomic repair, verification |
| `security.md` | Security audit: STRIDE + OWASP + red-team adversarial analysis |
| `results-logging.md` | TSV results log format and protocol for all loop types |
| `core-principles.md` | 7 generalizable principles behind autonomous iteration |

### Agent Preload Assignment

Not preloaded. User-invocable on-demand. Activates when any of the 4 autonomous loop commands is invoked (`/maxsim:improve`, `/maxsim:fix-loop`, `/maxsim:debug-loop`, `/maxsim:security`).

### Key Behavioral Rules

- One change per iteration — atomic changes for clear causality
- Mechanical verification only — no subjective judgments, use metrics
- Automatic rollback on failure — `git revert` (not `git reset --hard`) preserves experiment history
- Every experiment committed with `experiment:` prefix before verification
- Results log updated after every iteration — no silent iterations
- Bounded loops stop after N iterations and print a final summary
- Security audit is read-only by default — `--fix` flag required to auto-remediate

### Estimated Line Count

~169 lines (index.md body, excluding reference files)

---

## Summary Table

| # | Skill Name | user-invocable | Preloaded By | Disposition | Target Lines |
|---|-----------|---------------|-------------|-------------|-------------|
| 1 | `tdd` | true | none | Keep, fix See also | ~78 |
| 2 | `systematic-debugging` | true | none | Keep, fix "5-Step" → "6-Step" | ~80 |
| 3 | `brainstorming` | true | none | Keep as-is | ~102 |
| 4 | `roadmap-writing` | true | none | Keep, remove MAXSIM Integration section | ~125 |
| 5 | `handoff-contract` | false | executor, planner, researcher, verifier | Keep as-is | ~71 |
| 6 | `commit-conventions` | false | executor | Keep as-is | ~76 |
| 7 | `maxsim-batch` | true | none | Keep as-is | ~87 |
| 8 | `code-review` | true | none | Add SPEC COMPLIANCE dimension | ~115 |
| 9 | `verification` | true | executor, verifier | NEW merge of 3 skills | ~200 |
| 10 | `github-operations` | false | none (available_skills) | NEW merge of 2 skills | ~160 |
| 11 | `research` | false | researcher | NEW merge of 2 skills | ~190 |
| 12 | `project-memory` | true | none | NEW skill | ~110 |
| 13 | `using-maxsim` | true | none | Update skills table for v6 | ~85 |
| 14 | `maxsim-simplify` | true | none | Keep as-is | ~91 |
| 15 | `autoresearch` | true | none | NEW skill | ~169 |

**Total estimated lines across all 15 skills:** ~1,739 lines
**Maximum allowed (15 × 500):** 7,500 lines
**All skills well within the 500-line body limit.**

---

## Skills Being Retired

The following skills exist in the current codebase but are not in the 15-skill target set:

| Skill | Reason for Retirement |
|-------|----------------------|
| `verification-before-completion` | Merged into `verification` |
| `evidence-collection` | Merged into `verification` |
| `verification-gates` | Merged into `verification` |
| `github-artifact-protocol` | Merged into `github-operations` |
| `github-tools-guide` | Merged into `github-operations` |
| `research-methodology` | Merged into `research` |
| `tool-priority-guide` | Merged into `research` |
| `memory-management` | Replaced by `project-memory` (GitHub-native model) |
| `sdd` | Functionality absorbed into executor agent definition and code-review skill |
| `agent-system-map` | Functionality covered by `using-maxsim` skill + AGENTS.md |
| `input-validation` | Absorbed into individual agent startup protocols |

---

## Cross-Reference Map

Dependencies between skills (skill A references skill B):

```
tdd                  → verification (See also)
systematic-debugging → verification (See also)
code-review          → maxsim-simplify (See also)
maxsim-simplify      → code-review (See also)
using-maxsim         → verification (See also)
verification         → (none — terminal reference)
research             → (none — terminal reference)
github-operations    → (none — terminal reference)
handoff-contract     → (none — terminal reference)
commit-conventions   → (none — terminal reference)
```

No circular references exist in the target state.

---

## Implementation Notes

### Files to Create

New skills require new directories under `templates/skills/`:

```
templates/skills/verification/index.md       (new — merge)
templates/skills/github-operations/index.md  (new — merge)
templates/skills/research/index.md           (new — merge)
templates/skills/project-memory/index.md     (new)
```

### Files to Update

```
templates/skills/tdd/index.md                       (update See also)
templates/skills/systematic-debugging/index.md      (fix "5-Step" → "6-Step", update See also)
templates/skills/roadmap-writing/index.md           (remove MAXSIM Integration section)
templates/skills/code-review/index.md               (add SPEC COMPLIANCE dimension)
templates/skills/using-maxsim/index.md              (update skills table)
templates/agents/AGENTS.md                          (update preloaded skills references)
templates/agents/executor.md                        (update: evidence-collection → verification)
templates/agents/researcher.md                      (update: research-methodology → research)
templates/agents/verifier.md                        (update: verification-gates + evidence-collection → verification)
```

### Files to Delete (after new skills verified)

```
templates/skills/verification-before-completion/    (merged into verification)
templates/skills/evidence-collection/               (merged into verification)
templates/skills/verification-gates/                (merged into verification)
templates/skills/github-artifact-protocol/          (merged into github-operations)
templates/skills/github-tools-guide/                (merged into github-operations)
templates/skills/research-methodology/              (merged into research)
templates/skills/tool-priority-guide/               (merged into research)
templates/skills/memory-management/                 (replaced by project-memory)
templates/skills/sdd/                               (retired)
templates/skills/agent-system-map/                  (retired)
templates/skills/input-validation/                  (absorbed into agents)
```

### Agent Preload Update Summary

| Agent | Current Preloads | Target Preloads |
|-------|-----------------|-----------------|
| executor | handoff-contract, evidence-collection, commit-conventions | handoff-contract, **verification**, commit-conventions |
| planner | handoff-contract, input-validation | handoff-contract |
| researcher | handoff-contract, evidence-collection | handoff-contract, **research** |
| verifier | verification-gates, evidence-collection, handoff-contract | **verification**, handoff-contract |
